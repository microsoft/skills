#!/usr/bin/env node
// Local allowlist preflight validator for Azure AI Translator Document Translation files and glossaries.
// Exit codes: 0 = report written to stdout or --help, 1 = file/read/size error, 2 = usage/argument error.
import { realpathSync } from "node:fs";
import { open, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ASYNC_MAX_DOC_BYTES = 40 * 1024 * 1024;
const ASYNC_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ASYNC_MAX_BATCH_BYTES = 250 * 1024 * 1024;
const ASYNC_MAX_FILES = 1000;
const ASYNC_MAX_TARGETS = 10;
const ASYNC_MAX_GLOSSARY_BYTES = 10 * 1024 * 1024;
const SYNC_MAX_DOC_BYTES = 10 * 1024 * 1024;
const SYNC_MAX_GLOSSARY_BYTES = 1 * 1024 * 1024;
const SCAN_CHUNK_BYTES = 1024 * 1024;
const MODES = new Set(["async", "sync"]);

// Extension lists mirror the documented format tables (Document translation overview). The service's
// GET /translator/document/formats is authoritative at runtime, so a miss is a warning, not an error.
const MARKDOWN_EXTENSIONS = [".markdown", ".mdown", ".mkdn", ".md", ".mkd", ".mdwn", ".mdtxt", ".mdtext", ".rmd"];
const DOC_EXTENSIONS = new Set([
  ".pdf", ".csv", ".html", ".htm", ".odp", ".ods", ".odt", ...MARKDOWN_EXTENSIONS,
  ".mhtml", ".mht", ".xls", ".xlsx", ".msg", ".ppt", ".pptx", ".doc", ".docx",
  ".rtf", ".tsv", ".tab", ".txt", ".xlf",
]);
const SYNC_DOC_EXTENSIONS = new Set([
  ".txt", ".tsv", ".tab", ".csv", ".html", ".htm", ".mhtml", ".mht",
  ".pptx", ".xlsx", ".docx", ".msg", ".xlf",
]);
const PDF_ENCRYPT = Buffer.from("/Encrypt", "latin1");
const OLE2_ENCRYPTION_STREAMS = [
  Buffer.from("EncryptedPackage", "utf16le"),
  Buffer.from("EncryptionInfo", "utf16le"),
];
const PREVIEW_IMAGE_EXTENSIONS = new Set([".jpeg", ".png", ".bmp", ".webp"]);
const VALID_BMP_DIB_SIZES = new Set([12, 40, 52, 56, 64, 108, 124]);
const TEXT_EXTENSIONS = new Set([
  ".txt", ...MARKDOWN_EXTENSIONS, ".html", ".htm", ".tsv", ".tab", ".csv", ".xlf",
]);
// Batch and synchronous glossary tables list the same formats.
const GLOSSARY_EXTENSIONS = new Set([".tsv", ".tab", ".csv", ".xlf"]);
const FORMATS_HINT = "confirm with GET /translator/document/formats";

function usage() {
  return [
    "Usage: node validate-document-translation.mjs [--mode async|sync] [--document <file> ...] [--dir <folder>] [--glossary <file>] [--target-count <n>]",
    "",
    "Validates local Document Translation documents and glossaries offline without emitting document or glossary text.",
    "Exit codes: 0 = report written or --help, 1 = file/read/size error, 2 = usage/argument error.",
  ].join("\n");
}

async function openRegularFile(filePath) {
  let handle;
  try {
    handle = await open(filePath, "r");
  } catch (err) {
    if (err?.code === "EISDIR") throw new Error("NOT_A_FILE");
    throw err;
  }
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error("NOT_A_FILE");
    return { handle, size: info.size };
  } catch (err) {
    await handle.close();
    throw err;
  }
}

async function readSlice(handle, offset, length) {
  const buffer = Buffer.alloc(Math.max(0, length));
  if (buffer.length === 0) return buffer;
  const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
  return buffer.subarray(0, bytesRead);
}

function safeExtension(extension) {
  if (!extension) return "(none)";
  return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : "(other)";
}

// Stream a file in 1 MiB windows (with overlap) and report whether any needle occurs.
// `accept(view, afterIndex, viewEnd, atEof)` can reject a hit (for example a longer PDF name).
// Only a boolean leaves this function; file content is never returned.
async function fileContainsAny(handle, byteLength, needles, accept = () => true) {
  const overlap = Math.max(...needles.map((n) => n.length)) + 1;
  const buffer = Buffer.alloc(SCAN_CHUNK_BYTES + overlap);
  let carry = 0;
  let pos = 0;
  while (pos < byteLength) {
    const { bytesRead: read } = await handle.read(buffer, carry, SCAN_CHUNK_BYTES, pos);
    if (read <= 0) break;
    pos += read;
    const end = carry + read;
    const view = buffer.subarray(0, end);
    const atEof = pos >= byteLength;
    for (const needle of needles) {
      for (let idx = view.indexOf(needle); idx !== -1; idx = view.indexOf(needle, idx + 1)) {
        if (accept(view, idx + needle.length, end, atEof)) return true;
      }
    }
    carry = Math.min(overlap, end);
    buffer.copy(buffer, 0, end - carry, end);
  }
  return false;
}

function hasOle2EncryptionStreams(handle, byteLength) {
  return fileContainsAny(handle, byteLength, OLE2_ENCRYPTION_STREAMS);
}

// Inspect PDF dictionary structure in streaming chunks while ignoring comments (%...), literal
// strings ((...)), hex strings (<...>), and stream...endstream bodies so visible text such as
// `(A PDF /Encrypt example)` is not misread as encryption. Returns "encrypted" when a trailer or
// /Type /XRef dictionary declares /Encrypt (other than null), "unverified_marker" when /Encrypt
// appears in an object dictionary of a PDF with no trailer/XRef dictionary, or "none".
async function classifyPdfEncryption(handle, byteLength) {
  // Fast pre-check: if the raw byte sequence "/Encrypt" never occurs anywhere in the file, skip parsing.
  const hasRawToken = await fileContainsAny(handle, byteLength, [PDF_ENCRYPT], (view, after, end, atEof) => {
    if (after >= end) return atEof;
    const next = view[after];
    return !((next >= 0x41 && next <= 0x5a) || (next >= 0x61 && next <= 0x7a));
  });
  if (!hasRawToken) return "none";

  const buf = Buffer.alloc(SCAN_CHUNK_BYTES);
  let pos = 0;
  let state = "normal"; // normal | comment | literal | hex | stream
  let parenDepth = 0;
  let escaped = false;
  let dictDepth = 0;
  let topDictBuffer = "";
  let currentDictIsTrailer = false;
  let tokenBuf = "";
  let lastWord = "";
  let afterDictClose = "";
  let streamTail = "";
  let pendingLt = false;
  let hasTrailerOrXref = false;
  let confirmedEncrypted = false;
  let anyDictEncryptKey = false;

  const flushWord = () => {
    if (!tokenBuf) return;
    lastWord = tokenBuf;
    if (dictDepth === 1 && topDictBuffer.length < 65536) {
      topDictBuffer += ` ${tokenBuf} `;
    }
    tokenBuf = "";
  };

  const finishTopDict = () => {
    const hasEncryptKey = /\/Encrypt(?![A-Za-z0-9_])(?![\t\n\f\r ]+null(?![A-Za-z0-9_]))/.test(topDictBuffer);
    const isXrefDict = /\/Type[\t\n\f\r ]*\/XRef(?![A-Za-z0-9_])/.test(topDictBuffer);
    if (currentDictIsTrailer || isXrefDict) {
      hasTrailerOrXref = true;
      if (hasEncryptKey) confirmedEncrypted = true;
    } else if (hasEncryptKey) {
      anyDictEncryptKey = true;
    }
    topDictBuffer = "";
    currentDictIsTrailer = false;
    afterDictClose = "";
  };

  while (pos < byteLength && !confirmedEncrypted) {
    const { bytesRead } = await handle.read(buf, 0, SCAN_CHUNK_BYTES, pos);
    if (bytesRead <= 0) break;
    pos += bytesRead;
    const atEof = pos >= byteLength;
    let chunk = buf.subarray(0, bytesRead).toString("latin1");
    if (pendingLt) {
      chunk = `<${chunk}`;
      pendingLt = false;
    }

    let i = 0;
    while (i < chunk.length) {
      const ch = chunk[i];

      if (state === "stream") {
        // Look for `endstream` across chunk boundaries.
        const windowStr = streamTail + chunk.slice(i);
        const endIdx = windowStr.search(/(?:^|[\r\n\t\f ])endstream(?=[\r\n\t\f /<>()[\]%]|$)/);
        if (endIdx === -1) {
          streamTail = windowStr.slice(-16);
          break;
        }
        const matched = windowStr.slice(endIdx).match(/^(?:[\r\n\t\f ])?endstream/);
        const consumedInWindow = endIdx + (matched ? matched[0].length : 9);
        const advance = consumedInWindow - streamTail.length;
        streamTail = "";
        state = "normal";
        lastWord = "endstream";
        i += Math.max(1, advance);
        continue;
      }

      if (state === "comment") {
        if (ch === "\r" || ch === "\n") state = "normal";
        i += 1;
        continue;
      }

      if (state === "literal") {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === "(") {
          parenDepth += 1;
        } else if (ch === ")") {
          parenDepth -= 1;
          if (parenDepth === 0) {
            state = "normal";
            if (dictDepth === 1 && topDictBuffer.length < 65536) topDictBuffer += " () ";
          }
        }
        i += 1;
        continue;
      }

      if (state === "hex") {
        if (ch === ">") {
          state = "normal";
          if (dictDepth === 1 && topDictBuffer.length < 65536) topDictBuffer += " <> ";
        }
        i += 1;
        continue;
      }

      // state === "normal"
      if (ch === "%") {
        flushWord();
        afterDictClose = "";
        state = "comment";
        i += 1;
        continue;
      }
      if (ch === "(") {
        flushWord();
        afterDictClose = "";
        state = "literal";
        parenDepth = 1;
        escaped = false;
        i += 1;
        continue;
      }
      if (ch === "<") {
        if (i + 1 >= chunk.length && !atEof) {
          pendingLt = true;
          break;
        }
        if (chunk[i + 1] === "<") {
          flushWord();
          afterDictClose = "";
          if (dictDepth === 0) {
            currentDictIsTrailer = lastWord === "trailer";
            topDictBuffer = "";
          } else if (dictDepth === 1 && topDictBuffer.length < 65536) {
            topDictBuffer += " <<>> ";
          }
          dictDepth += 1;
          lastWord = "";
          i += 2;
          continue;
        }
        flushWord();
        afterDictClose = "";
        state = "hex";
        i += 1;
        continue;
      }
      if (ch === ">" && chunk[i + 1] === ">") {
        flushWord();
        if (dictDepth > 0) {
          dictDepth -= 1;
          if (dictDepth === 0) {
            finishTopDict();
            afterDictClose = ">>";
          }
        }
        i += 2;
        continue;
      }
      if (ch === ">" && i + 1 >= chunk.length && !atEof && dictDepth > 0) {
        // Defer a lone trailing `>` in case the next chunk starts with `>`.
        // Handled simply by re-reading 1 byte via overlap: adjust pos back by 1.
        pos -= 1;
        break;
      }

      const isDelimiter = /[\s/<>()[\]{}%]/.test(ch);
      if (ch === "/") {
        flushWord();
        tokenBuf = "/";
        i += 1;
        continue;
      }
      if (isDelimiter) {
        const completed = tokenBuf;
        flushWord();
        if (dictDepth === 0 && afterDictClose === ">>") {
          if (completed === "stream" && (ch === "\r" || ch === "\n")) {
            if (ch === "\r" && chunk[i + 1] === "\n") i += 1;
            afterDictClose = "";
            streamTail = "";
            state = "stream";
            i += 1;
            continue;
          }
          if (completed !== "" && completed !== "stream") {
            afterDictClose = "";
          }
        }
        i += 1;
        continue;
      }
      tokenBuf += ch;
      i += 1;
    }
  }
  flushWord();
  if (dictDepth > 0 && topDictBuffer) finishTopDict();

  if (confirmedEncrypted) return "encrypted";
  if (!hasTrailerOrXref && anyDictEncryptKey) return "unverified_marker";
  return "none";
}

function detectBinarySignature(head) {
  if (head.length === 0) return "empty";
  if (head.length >= 5 && head.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) return "zip";
  if (
    head.length >= 8 &&
    head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0 &&
    head[4] === 0xa1 && head[5] === 0xb1 && head[6] === 0x1a && head[7] === 0xe1
  ) {
    return "ole2";
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
  ) {
    return "png";
  }
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (
    head.length >= 26 &&
    head[0] === 0x42 && head[1] === 0x4d &&
    head.readUInt32LE(6) === 0 &&
    VALID_BMP_DIB_SIZES.has(head.readUInt32LE(14))
  ) {
    return "bmp";
  }
  if (head.length >= 12 && head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  if (head.length >= 2 && ((head[0] === 0xff && head[1] === 0xfe) || (head[0] === 0xfe && head[1] === 0xff))) {
    return "utf16_bom";
  }
  return "text_or_other";
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  let afterClosingQuote = false;
  let quoteErrorRow;

  let lineNumber = 1;
  let rowLine = 1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") {
          cell += "\"";
          i += 1;
        } else {
          inQuotes = false;
          afterClosingQuote = true;
        }
      } else {
        if (ch === "\n") lineNumber += 1;
        cell += ch;
      }
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      afterClosingQuote = false;
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push({ line: rowLine, cells: row });
      row = [];
      cell = "";
      afterClosingQuote = false;
      lineNumber += 1;
      rowLine = lineNumber;
    } else if (ch === "\n") {
      row.push(cell);
      rows.push({ line: rowLine, cells: row });
      row = [];
      cell = "";
      afterClosingQuote = false;
      lineNumber += 1;
      rowLine = lineNumber;
    } else if (afterClosingQuote) {
      quoteErrorRow ??= rowLine;
      cell += ch;
    } else if (ch === "\"") {
      if (cell.length === 0) {
        inQuotes = true;
      } else {
        quoteErrorRow ??= rowLine;
        cell += ch;
      }
    } else {
      cell += ch;
    }
  }
  if (inQuotes) quoteErrorRow ??= rowLine;
  if (row.length > 0 || cell.length > 0 || afterClosingQuote) {
    row.push(cell);
    rows.push({ line: rowLine, cells: row });
  }
  return { rows, quoteErrorRow };
}

async function inspectGlossary(glossaryPath, mode) {
  const { handle, size } = await openRegularFile(glossaryPath);
  const maxBytes = mode === "sync" ? SYNC_MAX_GLOSSARY_BYTES : ASYNC_MAX_GLOSSARY_BYTES;
  const rawExtension = extname(glossaryPath).toLowerCase();
  const extension = safeExtension(rawExtension);
  const findings = [];

  let rawBytes;
  try {
    if (!GLOSSARY_EXTENSIONS.has(rawExtension)) {
      findings.push({
        code: "UNSUPPORTED_GLOSSARY_EXTENSION",
        severity: "warning",
        detail: `Glossary extension '${extension}' is not in the documented glossary formats (.tsv, .tab, .csv, .xlf); ${FORMATS_HINT}?type=glossary.`,
      });
    }
    if (size === 0) {
      findings.push({ code: "EMPTY_GLOSSARY", severity: "error", detail: "Glossary file is 0 bytes." });
      return { extension, byteLength: 0, findings };
    }
    if (size > maxBytes) {
      findings.push({
        code: "EXCEEDS_GLOSSARY_SIZE_LIMIT",
        severity: "error",
        detail: `Glossary size (${size} bytes) exceeds ${mode} limit (${maxBytes} bytes).`,
      });
      return { extension, byteLength: size, findings };
    }
    if (!GLOSSARY_EXTENSIONS.has(rawExtension) && rawExtension !== ".xliff") {
      return { extension, byteLength: size, notInspected: true, findings };
    }
    rawBytes = await handle.readFile();
  } finally {
    await handle.close();
  }

  if (
    rawBytes.length >= 2 &&
    ((rawBytes[0] === 0xff && rawBytes[1] === 0xfe) || (rawBytes[0] === 0xfe && rawBytes[1] === 0xff))
  ) {
    findings.push({
      code: "GLOSSARY_UTF16_ENCODING",
      severity: "warning",
      detail: "Glossary starts with a UTF-16 BOM; save glossaries as UTF-8.",
    });
    return { extension, byteLength: size, utf8Valid: false, findings };
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);
  } catch {
    findings.push({
      code: "GLOSSARY_INVALID_UTF8",
      severity: "warning",
      detail: "Glossary contains invalid UTF-8 byte sequences.",
    });
    return { extension, byteLength: size, utf8Valid: false, findings };
  }

  // TextDecoder strips a leading BOM, so check the raw bytes.
  const hasUtf8Bom = rawBytes.length >= 3 && rawBytes[0] === 0xef && rawBytes[1] === 0xbb && rawBytes[2] === 0xbf;
  const clean = text.startsWith("\uFEFF") ? text.slice(1) : text;

  if (extension === ".xlf" || extension === ".xliff") {
    const hasXliffRoot = /<xliff\b/i.test(clean);
    const hasSource = /<source\b/i.test(clean);
    const hasTarget = /<target\b/i.test(clean);
    if (!hasXliffRoot || !hasSource || !hasTarget) {
      findings.push({
        code: "INVALID_XLIFF_GLOSSARY_STRUCTURE",
        severity: "warning",
        detail: "XLIFF glossary must include <xliff>, <source>, and <target> elements.",
      });
    }
    return {
      extension,
      byteLength: size,
      utf8Valid: true,
      hasUtf8Bom,
      findings,
    };
  }

  let parsedRows;
  if (extension === ".csv") {
    const csv = parseCsvRows(clean);
    if (csv.quoteErrorRow !== undefined) {
      findings.push({
        code: "MALFORMED_CSV_QUOTES",
        severity: "warning",
        detail: `Unclosed or unescaped CSV quote starting at row ${csv.quoteErrorRow}.`,
      });
    }
    parsedRows = csv.rows;
  } else {
    const rawLines = clean.split(/\r?\n/);
    parsedRows = rawLines
      .map((lineText, idx) => ({ line: idx + 1, raw: lineText }))
      .filter((item, idx, arr) => !(idx === arr.length - 1 && item.raw === ""))
      .map((item) => ({ line: item.line, cells: item.raw.split("\t") }));
  }

  const malformedRows = [];
  const emptyCellRows = [];
  const blankRows = [];
  const duplicateSourceRows = [];
  const seenExact = new Set();
  const seenLower = new Set();
  let caseOnlyCollisions = 0;
  let validEntries = 0;

  for (const row of parsedRows) {
    if (row.cells.length === 1 && row.cells[0].trim() === "") {
      blankRows.push(row.line);
      continue;
    }
    if (row.cells.length !== 2) {
      malformedRows.push(row.line);
      continue;
    }
    const [src, tgt] = row.cells;
    if (src.trim() === "" || tgt.trim() === "") {
      emptyCellRows.push(row.line);
      continue;
    }
    if (seenExact.has(src)) {
      duplicateSourceRows.push(row.line);
    } else {
      if (seenLower.has(src.toLowerCase())) caseOnlyCollisions += 1;
      seenExact.add(src);
      seenLower.add(src.toLowerCase());
      validEntries += 1;
    }
  }

  if (malformedRows.length > 0) {
    findings.push({
      code: "GLOSSARY_COLUMN_COUNT_MISMATCH",
      severity: "warning",
      detail: `${malformedRows.length} row(s) do not have exactly 2 columns (first rows: ${malformedRows.slice(0, 10).join(", ")}).`,
    });
  }
  if (emptyCellRows.length > 0) {
    findings.push({
      code: "GLOSSARY_EMPTY_CELL",
      severity: "warning",
      detail: `${emptyCellRows.length} row(s) have an empty source or target cell (first rows: ${emptyCellRows.slice(0, 10).join(", ")}).`,
    });
  }
  if (blankRows.length > 0) {
    // No documented rule rejects blank lines; report them for cleanup only.
    findings.push({
      code: "GLOSSARY_BLANK_ROWS",
      severity: "info",
      detail: `${blankRows.length} blank row(s) (first rows: ${blankRows.slice(0, 10).join(", ")}).`,
    });
  }
  if (duplicateSourceRows.length > 0) {
    findings.push({
      code: "GLOSSARY_DUPLICATE_SOURCE_TERMS",
      severity: "warning",
      detail: `${duplicateSourceRows.length} duplicate case-sensitive source entry/entries detected (first rows: ${duplicateSourceRows.slice(0, 10).join(", ")}).`,
    });
  }
  if (caseOnlyCollisions > 0) {
    findings.push({
      code: "GLOSSARY_CASE_ONLY_VARIATIONS",
      severity: "info",
      detail: `${caseOnlyCollisions} source entry/entries differ only by letter case; partial-sentence glossary matching is case-sensitive.`,
    });
  }
  if (validEntries === 0 && findings.length === 0) {
    findings.push({ code: "GLOSSARY_NO_VALID_ENTRIES", severity: "warning", detail: "Glossary contains no valid term pairs." });
  }

  return {
    extension,
    byteLength: size,
    utf8Valid: true,
    hasUtf8Bom,
    rowCount: parsedRows.length,
    validEntryCount: validEntries,
    malformedRowCount: malformedRows.length,
    emptyCellRowCount: emptyCellRows.length,
    blankRowCount: blankRows.length,
    duplicateSourceCount: duplicateSourceRows.length,
    findings,
  };
}

async function inspectOneDocument(docPath, index, mode) {
  const { handle, size } = await openRegularFile(docPath);

  const extension = extname(docPath).toLowerCase();
  const shownExtension = safeExtension(extension);
  const maxDocBytes = mode === "sync" ? SYNC_MAX_DOC_BYTES : ASYNC_MAX_DOC_BYTES;
  const withinLimit = size > 0 && size <= maxDocBytes;
  let signature;
  let pdfEncryptionState = "none";
  let textRaw;
  try {
    const head = await readSlice(handle, 0, Math.min(size, 64 * 1024));
    signature = detectBinarySignature(head);
    // Encryption streams can sit anywhere in the OLE2 directory; scan the whole (in-limit) file.
    if (signature === "ole2" && withinLimit && await hasOle2EncryptionStreams(handle, size)) {
      signature = "ole2_encrypted";
    } else if (signature === "pdf" && withinLimit) {
      pdfEncryptionState = await classifyPdfEncryption(handle, size);
    }
    if (TEXT_EXTENSIONS.has(extension) && withinLimit && signature !== "utf16_bom") {
      textRaw = await handle.readFile();
    }
  } finally {
    await handle.close();
  }
  const findings = [];

  const isDocExt = DOC_EXTENSIONS.has(extension);
  const isImageExt = PREVIEW_IMAGE_EXTENSIONS.has(extension);
  if (!isDocExt && !isImageExt) {
    findings.push({
      code: "UNSUPPORTED_DOCUMENT_EXTENSION",
      severity: "warning",
      documentIndex: index,
      detail: `Document #${index} extension '${shownExtension}' is not in the documented ${mode} format list; ${FORMATS_HINT}.`,
    });
  } else if (mode === "sync" && isDocExt && !SYNC_DOC_EXTENSIONS.has(extension)) {
    findings.push({
      code: "UNSUPPORTED_IN_SYNC_MODE",
      severity: "warning",
      documentIndex: index,
      detail: `Document #${index} ('${shownExtension}') is in the batch format list but not the synchronous list (txt, tsv/tab, csv, html/htm, mhtml/mht, docx, xlsx, pptx, msg, xlf).`,
    });
  }
  if (isImageExt) {
    if (mode === "sync") {
      findings.push({
        code: "IMAGE_UNSUPPORTED_IN_SYNC_MODE",
        severity: "warning",
        documentIndex: index,
        detail: `Document #${index} (${shownExtension}) is an image; image translation is documented for batch translation (2025-12-01-preview) only.`,
      });
    } else if (size > ASYNC_MAX_IMAGE_BYTES) {
      findings.push({
        code: "EXCEEDS_IMAGE_SIZE_LIMIT",
        severity: "error",
        documentIndex: index,
        detail: `Document #${index} (${size} bytes) exceeds the 5 MB image translation limit.`,
      });
    } else {
      findings.push({
        code: "PREVIEW_IMAGE_FORMAT",
        severity: "info",
        documentIndex: index,
        detail: `Document #${index} (${shownExtension}) requires preview Document Translation image support (2025-12-01-preview).`,
      });
    }
  }

  if (size === 0) {
    findings.push({
      code: "EMPTY_DOCUMENT",
      severity: "error",
      documentIndex: index,
      detail: `Document #${index} is 0 bytes.`,
    });
  } else if (size > maxDocBytes) {
    findings.push({
      code: "EXCEEDS_DOCUMENT_SIZE_LIMIT",
      severity: "error",
      documentIndex: index,
      detail: `Document #${index} (${size} bytes) exceeds ${mode} limit (${maxDocBytes} bytes).`,
    });
  }

  if (signature === "ole2_encrypted") {
    findings.push({
      code: "ENCRYPTED_OFFICE_DOCUMENT",
      severity: "error",
      documentIndex: index,
      detail: `Document #${index} is an encrypted Office package; secured (password-encrypted or copy-restricted) documents can't be translated.`,
    });
  } else if (signature === "pdf") {
    if (pdfEncryptionState === "encrypted") {
      findings.push({
        code: "ENCRYPTED_PDF_DOCUMENT",
        severity: "error",
        documentIndex: index,
        detail: `Document #${index} is an encrypted PDF (/Encrypt in trailer/XRef); secured (password-encrypted or copy-restricted) documents can't be translated.`,
      });
    } else if (pdfEncryptionState === "unverified_marker") {
      findings.push({
        code: "POSSIBLE_PDF_ENCRYPTION_MARKER",
        severity: "warning",
        documentIndex: index,
        detail: `Document #${index} contains an /Encrypt dictionary entry without a trailer/XRef section; verify the PDF is not password-encrypted or copy-restricted.`,
      });
    }
    if (extension && extension !== ".pdf") {
      findings.push({
        code: "DOCUMENT_EXTENSION_MISMATCH",
        severity: "warning",
        documentIndex: index,
        detail: `Document #${index} has '${shownExtension}' extension, but header bytes indicate PDF.`,
      });
    }
  } else if ([".docx", ".pptx", ".xlsx", ".odt", ".ods", ".odp"].includes(extension) && size > 0 && signature !== "zip") {
    findings.push({
      code: "DOCUMENT_EXTENSION_MISMATCH",
      severity: "warning",
      documentIndex: index,
      detail: `Document #${index} has '${shownExtension}' extension, but header bytes are '${signature}' rather than a ZIP/OOXML container.`,
    });
  } else if (extension === ".pdf" && size > 0 && signature !== "pdf") {
    findings.push({
      code: "DOCUMENT_EXTENSION_MISMATCH",
      severity: "warning",
      documentIndex: index,
      detail: `Document #${index} has '.pdf' extension, but header bytes indicate '${signature}'.`,
    });
  }

  if (TEXT_EXTENSIONS.has(extension) && withinLimit) {
    if (signature === "utf16_bom") {
      findings.push({
        code: "TEXT_DOCUMENT_UTF16_BOM",
        severity: "warning",
        documentIndex: index,
        detail: `Document #${index} uses UTF-16 BOM; prefer UTF-8 to avoid encoding rejections.`,
      });
    } else if (textRaw) {
      try {
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(textRaw);
        if (decoded.trim().length === 0) {
          findings.push({
            code: "WHITESPACE_ONLY_DOCUMENT",
            severity: "warning",
            documentIndex: index,
            detail: `Document #${index} contains only whitespace.`,
          });
        }
        if ((extension === ".xlf" || extension === ".xliff") && (!/<xliff\b/i.test(decoded) || !/<source\b/i.test(decoded))) {
          findings.push({
            code: "INVALID_XLIFF_DOCUMENT_STRUCTURE",
            severity: "warning",
            documentIndex: index,
            detail: `Document #${index} is missing required <xliff> or <source> elements.`,
          });
        }
      } catch {
        findings.push({
          code: "DOCUMENT_INVALID_UTF8",
          severity: "warning",
          documentIndex: index,
          detail: `Document #${index} contains invalid UTF-8 byte sequences.`,
        });
      }
    }
  }

  if (size > maxDocBytes && signature !== "empty") {
    findings.push({
      code: "CONTENT_CHECKS_SKIPPED_OVER_LIMIT",
      severity: "info",
      documentIndex: index,
      detail: `Document #${index} exceeds the ${mode} size limit, so encryption and encoding checks were skipped.`,
    });
  }

  return {
    documentIndex: index,
    extension: shownExtension,
    byteLength: size,
    detectedSignature: signature,
    findings,
  };
}

export async function validateDocumentTranslation({
  mode = "async",
  documents = [],
  directory,
  glossaryFile,
  targetCount = 1,
} = {}) {
  const normalizedMode = String(mode).toLowerCase();
  if (!MODES.has(normalizedMode)) throw new Error("INVALID_MODE");
  if (!Number.isInteger(targetCount) || targetCount < 1) throw new Error("INVALID_TARGET_COUNT");

  const docPaths = [...documents];
  if (directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (err) {
      if (err?.code === "ENOTDIR") throw new Error("NOT_A_DIRECTORY");
      throw err;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isFile() && !entry.name.startsWith(".")) {
        docPaths.push(join(directory, entry.name));
      }
    }
  }

  if (docPaths.length === 0 && !glossaryFile) throw new Error("MISSING_INPUT");

  const findings = [];
  const maxTargets = normalizedMode === "sync" ? 1 : ASYNC_MAX_TARGETS;
  if (targetCount > maxTargets) {
    findings.push({
      code: "EXCEEDS_TARGET_LANGUAGE_LIMIT",
      severity: "error",
      detail: `Target language count (${targetCount}) exceeds ${normalizedMode} limit (${maxTargets}).`,
    });
  }

  const maxFiles = normalizedMode === "sync" ? 1 : ASYNC_MAX_FILES;
  if (docPaths.length > maxFiles) {
    findings.push({
      code: "EXCEEDS_BATCH_FILE_COUNT_LIMIT",
      severity: "error",
      detail: `Document count (${docPaths.length}) exceeds ${normalizedMode} limit (${maxFiles}).`,
    });
  }

  const inspectedDocs = [];
  let totalBytes = 0;
  const inspectLimit = Math.min(docPaths.length, ASYNC_MAX_FILES + 1);
  for (let i = 0; i < inspectLimit; i += 1) {
    const docReport = await inspectOneDocument(docPaths[i], i + 1, normalizedMode);
    totalBytes += docReport.byteLength;
    findings.push(...docReport.findings);
    inspectedDocs.push({
      documentIndex: docReport.documentIndex,
      extension: docReport.extension,
      byteLength: docReport.byteLength,
      detectedSignature: docReport.detectedSignature,
    });
  }

  if (normalizedMode === "async" && totalBytes > ASYNC_MAX_BATCH_BYTES) {
    findings.push({
      code: "EXCEEDS_TOTAL_BATCH_SIZE_LIMIT",
      severity: "error",
      detail: `Total document bytes (${totalBytes}) exceed the 250 MB async batch limit.`,
    });
  }

  let glossarySummary;
  if (glossaryFile) {
    const glossary = await inspectGlossary(glossaryFile, normalizedMode);
    findings.push(...glossary.findings);
    const { findings: _ignored, ...rest } = glossary;
    glossarySummary = rest;
  }

  const hasError = findings.some((f) => f.severity === "error");
  const status = hasError
    ? "failed_preflight"
    : glossarySummary?.notInspected
      ? "unknown"
      : findings.some((f) => f.severity === "warning") ? "passed_with_warnings" : "passed_local_checks";

  return {
    mode: normalizedMode,
    targetLanguageCount: targetCount,
    status,
    ...(docPaths.length > 0
      ? {
          batch: {
            documentCount: docPaths.length,
            ...(inspectedDocs.length < docPaths.length ? { inspectedDocumentCount: inspectedDocs.length } : {}),
            totalDocumentBytes: totalBytes,
            documents: inspectedDocs,
          },
        }
      : {}),
    ...(glossarySummary ? { glossary: glossarySummary } : {}),
    findings,
  };
}

function parseCli(argv) {
  const opts = { mode: "async", documents: [], targetCount: 1 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--mode") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.mode = argv[++i];
    } else if (arg === "--document") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.documents.push(resolve(argv[++i]));
    } else if (arg === "--dir") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.directory = resolve(argv[++i]);
    } else if (arg === "--glossary") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.glossaryFile = resolve(argv[++i]);
    } else if (arg === "--target-count") {
      if (!argv[i + 1] || !/^\d+$/.test(argv[i + 1])) throw new Error("USAGE");
      opts.targetCount = Number(argv[++i]);
    } else {
      throw new Error("USAGE");
    }
  }
  if (!MODES.has(String(opts.mode).toLowerCase()) || opts.targetCount < 1) throw new Error("USAGE");
  if (opts.documents.length === 0 && !opts.directory && !opts.glossaryFile) throw new Error("USAGE");
  return opts;
}

async function main() {
  let opts;
  try {
    opts = parseCli(process.argv.slice(2));
  } catch {
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }
  if (opts.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  try {
    const report = await validateDocumentTranslation(opts);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (err) {
    const code = err?.code || (typeof err?.message === "string" && /^[A-Z0-9_]+$/.test(err.message) ? err.message : "READ_ERROR");
    process.stderr.write(`${JSON.stringify({ error: String(code) })}\n`);
    process.exit(1);
  }
}

try {
  if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    await main();
  }
} catch {
  // Imported as module
}
