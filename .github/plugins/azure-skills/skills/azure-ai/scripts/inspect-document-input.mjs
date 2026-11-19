#!/usr/bin/env node
// Local allowlist preflight inspector for Azure AI Document Intelligence inputs and labels.
// Exit codes: 0 = report written to stdout or --help, 1 = file/read/size/JSON error, 2 = usage/argument error.
import { realpathSync } from "node:fs";
import { open } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SPEC_VERSION = "2024-11-30";
const MAX_INSPECT_BYTES = 600 * 1024 * 1024;
const MAX_LABELS_BYTES = 10 * 1024 * 1024;
const MAX_OCR_BYTES = 500 * 1024 * 1024;
const F0_MAX_BYTES = 4 * 1024 * 1024;
const S0_MAX_BYTES = 500 * 1024 * 1024;
const TIERS = new Set(["F0", "S0"]);
// custom = custom extraction (template/neural); classifier = custom classification.
const MODEL_KINDS = new Set(["read", "layout", "prebuilt", "custom", "classifier"]);
const SCAN_CHUNK_BYTES = 1024 * 1024;
const EXT_TO_FORMAT = new Map([
  [".pdf", "pdf"],
  [".png", "png"],
  [".jpg", "jpeg"],
  [".jpeg", "jpeg"],
  [".bmp", "bmp"],
  [".tif", "tiff"],
  [".tiff", "tiff"],
  [".heic", "heif"],
  [".heif", "heif"],
  [".docx", "docx"],
  [".pptx", "pptx"],
  [".xlsx", "xlsx"],
  [".html", "html"],
  [".htm", "html"],
]);
const DIRECT_FORMATS = new Set(["pdf", "png", "jpeg", "bmp", "tiff", "heif"]);
// v4 input tables list Office as DOCX, XLSX, PPTX and HTML (read, layout, custom classification).
// Legacy binary Office (OLE2 .doc/.xls/.ppt) is not listed.
const OFFICE_HTML_FORMATS = new Set(["docx", "pptx", "xlsx", "html"]);
const OOXML_EXTENSIONS = new Set([".docx", ".xlsx", ".pptx"]);
const OLE2_ENCRYPTION_STREAMS = [
  Buffer.from("EncryptedPackage", "utf16le"),
  Buffer.from("EncryptionInfo", "utf16le"),
];

function usage() {
  return [
    "Usage: node inspect-document-input.mjs --file <path> [--tier F0|S0] [--model-kind read|layout|prebuilt|custom|classifier] [--labels <labels.json>] [--ocr <ocr.json>]",
    "       node inspect-document-input.mjs --labels <labels.json> [--ocr <ocr.json>]",
    "",
    "Inspects local Document Intelligence inputs and custom label files offline without emitting text or field values.",
    "Exit codes: 0 = report written or --help, 1 = file/read/size/JSON error, 2 = usage/argument error.",
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
// Only a boolean leaves this function; file content is never returned.
async function fileContainsAny(handle, byteLength, needles) {
  const overlap = Math.max(...needles.map((n) => n.length));
  const buffer = Buffer.alloc(SCAN_CHUNK_BYTES + overlap);
  let carry = 0;
  let pos = 0;
  while (pos < byteLength) {
    const { bytesRead: read } = await handle.read(buffer, carry, SCAN_CHUNK_BYTES, pos);
    if (read <= 0) break;
    pos += read;
    const end = carry + read;
    const view = buffer.subarray(0, end);
    if (needles.some((needle) => view.indexOf(needle) !== -1)) return true;
    carry = Math.min(overlap, end);
    buffer.copy(buffer, 0, end - carry, end);
  }
  return false;
}

const VALID_BMP_DIB_SIZES = new Set([12, 40, 52, 56, 64, 108, 124]);
const HEIF_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"]);
const RASTER_DIMENSION_FORMATS = new Set(["png", "jpeg", "bmp", "tiff"]);
const MAX_TIFF_IFDS = 2500;
const MAX_JPEG_SEGMENTS = 4096;
const MAX_OVERLAP_PAIR_CHECKS = 250000;
const PDF_SCAN_OVERLAP = 64;
const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function parsePngDimensions(head) {
  if (head.length < 24 || head.toString("ascii", 12, 16) !== "IHDR") return undefined;
  const width = head.readUInt32BE(16);
  const height = head.readUInt32BE(20);
  if (width === 0 || height === 0) return undefined;
  return { width, height };
}

function parseBmpDimensions(head, byteLength) {
  if (head.length < 26) return undefined;
  // Verify BITMAPFILEHEADER reserved bytes (0) and known DIB header size so text starting with "BM" is not misread as BMP.
  if (head.readUInt32LE(6) !== 0) return undefined;
  const pixelOffset = head.readUInt32LE(10);
  const dibSize = head.readUInt32LE(14);
  if (!VALID_BMP_DIB_SIZES.has(dibSize) || pixelOffset < 14 + dibSize || pixelOffset > byteLength) {
    return undefined;
  }
  if (dibSize === 12) {
    const width = head.readUInt16LE(18);
    const height = head.readUInt16LE(20);
    return width > 0 && height > 0 ? { width, height } : undefined;
  }
  const rawWidth = head.readInt32LE(18);
  const rawHeight = head.readInt32LE(22);
  if (rawWidth <= 0 || rawHeight === 0 || rawHeight === -2147483648) return undefined;
  return { width: rawWidth, height: Math.abs(rawHeight) };
}

async function parseJpegDimensions(handle, head, byteLength) {
  const readBytes = async (pos, len) => {
    if (pos + len <= head.length) return head.subarray(pos, pos + len);
    return readSlice(handle, pos, len);
  };
  let offset = 2;
  let segments = 0;
  while (offset + 4 <= byteLength && segments < MAX_JPEG_SEGMENTS) {
    const probe = await readBytes(offset, Math.min(16, byteLength - offset));
    if (probe.length < 2) break;
    if (probe[0] !== 0xff) {
      offset += 1;
      continue;
    }
    let idx = 0;
    while (idx < probe.length && probe[idx] === 0xff) idx += 1;
    offset += idx;
    if (idx === probe.length) continue;
    const marker = probe[idx];
    offset += 1;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      continue;
    }
    // SOS (start of scan) or EOI reached before any SOF header.
    if (marker === 0xd9 || marker === 0xda) break;
    segments += 1;
    const segHead = await readBytes(offset, Math.min(9, byteLength - offset));
    if (segHead.length < 2) break;
    const segmentLength = segHead.readUInt16BE(0);
    if (segmentLength < 2) break;
    const isSof = (marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof && segHead.length >= 7 && segmentLength >= 7) {
      const height = segHead.readUInt16BE(3);
      const width = segHead.readUInt16BE(5);
      // Height 0 in JPEG indicates DNL (line count deferred until scan end); leave unknown rather than reporting 0 px.
      return width > 0 && height > 0 ? { width, height } : undefined;
    }
    if (offset + segmentLength > byteLength) break;
    offset += segmentLength;
  }
  return undefined;
}

async function parseTiffMetadata(handle, head, byteLength) {
  if (head.length < 8) return {};
  const little = head[0] === 0x49 && head[1] === 0x49;
  const readU16 = (buf, pos) => (little ? buf.readUInt16LE(pos) : buf.readUInt16BE(pos));
  const readU32 = (buf, pos) => (little ? buf.readUInt32LE(pos) : buf.readUInt32BE(pos));

  let ifdOffset = readU32(head, 4);
  const visited = new Set();
  let pageCount = 0;
  let truncatedScan = false;
  let firstDimensions;
  const outOfRangePages = [];

  // Read each IFD directly by file offset because libtiff/scanners commonly place IFDs at the end of large TIFFs.
  while (ifdOffset !== 0 && pageCount < MAX_TIFF_IFDS) {
    if (visited.has(ifdOffset)) {
      truncatedScan = true;
      break;
    }
    visited.add(ifdOffset);
    if (ifdOffset < 8 || ifdOffset + 2 > byteLength) {
      truncatedScan = true;
      break;
    }
    const countBuf = await readSlice(handle, ifdOffset, 2);
    if (countBuf.length < 2) {
      truncatedScan = true;
      break;
    }
    const entryCount = readU16(countBuf, 0);
    const bodyBytes = entryCount * 12 + 4;
    if (entryCount > 4096 || ifdOffset + 2 + bodyBytes > byteLength) {
      truncatedScan = true;
      break;
    }
    const entriesBuf = await readSlice(handle, ifdOffset + 2, bodyBytes);
    if (entriesBuf.length < bodyBytes) {
      truncatedScan = true;
      break;
    }
    let pageWidth;
    let pageHeight;
    for (let i = 0; i < entryCount; i += 1) {
      const entryPos = i * 12;
      const tag = readU16(entriesBuf, entryPos);
      const fieldType = readU16(entriesBuf, entryPos + 2);
      const valueCount = readU32(entriesBuf, entryPos + 4);
      if (valueCount !== 1 || (fieldType !== 3 && fieldType !== 4)) continue;
      const value = fieldType === 3 ? readU16(entriesBuf, entryPos + 8) : readU32(entriesBuf, entryPos + 8);
      if (tag === 256) pageWidth = value;
      if (tag === 257) pageHeight = value;
    }
    pageCount += 1;
    if (pageWidth !== undefined && pageHeight !== undefined) {
      if (!firstDimensions && pageWidth > 0 && pageHeight > 0) {
        firstDimensions = { width: pageWidth, height: pageHeight };
      }
      if (pageWidth < 50 || pageHeight < 50 || pageWidth > 10000 || pageHeight > 10000) {
        outOfRangePages.push({ page: pageCount, width: pageWidth, height: pageHeight });
      }
    }
    ifdOffset = readU32(entriesBuf, entryCount * 12);
  }
  if (ifdOffset !== 0 && pageCount >= MAX_TIFF_IFDS) truncatedScan = true;
  return {
    dimensions: firstDimensions,
    outOfRangePages,
    pageCount: pageCount > 0 ? pageCount : (truncatedScan ? undefined : 0),
    pageCountIncomplete: truncatedScan,
    pageCountBasis: truncatedScan ? "tiff_ifd_lower_bound" : "tiff_ifd_count",
  };
}

async function inspectZipKind(handle, head, byteLength) {
  const tailSize = Math.min(byteLength, 512 * 1024);
  const tail = byteLength > head.length
    ? await readSlice(handle, byteLength - tailSize, tailSize)
    : Buffer.alloc(0);
  const names = `${head.toString("latin1")}\0${tail.toString("latin1")}`;
  if (names.includes("word/document.xml")) return "docx";
  if (names.includes("ppt/presentation.xml")) return "pptx";
  if (names.includes("xl/workbook.xml")) return "xlsx";
  if (names.includes("META-INF/manifest.xml") || names.includes("content.xml")) return "odf";
  return "zip";
}

async function scanPdfStructure(handle, byteLength) {
  const buf = Buffer.alloc(SCAN_CHUNK_BYTES);
  let carry = "";
  let encrypted = false;
  let pageObjects = 0;
  let pos = 0;
  const pageRegex = /\/Type[\t\n\f\r ]{0,32}\/Page(?![A-Za-z])/g;
  const encryptRegex = /\/Encrypt(?![A-Za-z])/g;

  while (pos < byteLength) {
    const { bytesRead } = await handle.read(buf, 0, SCAN_CHUNK_BYTES, pos);
    if (bytesRead <= 0) break;
    pos += bytesRead;
    const atEof = pos >= byteLength;
    const combined = carry + buf.subarray(0, bytesRead).toString("latin1");
    // Only accept matches starting before the trailing overlap (unless at EOF) so matches + 1-char
    // negative lookaheads are evaluated on complete context and counted once across chunk boundaries.
    const acceptBefore = atEof ? combined.length : Math.max(0, combined.length - PDF_SCAN_OVERLAP);
    if (!encrypted) {
      encryptRegex.lastIndex = 0;
      for (let m = encryptRegex.exec(combined); m !== null; m = encryptRegex.exec(combined)) {
        if (m.index < acceptBefore) {
          encrypted = true;
          break;
        }
      }
    }
    pageRegex.lastIndex = 0;
    for (let m = pageRegex.exec(combined); m !== null; m = pageRegex.exec(combined)) {
      if (m.index < acceptBefore) pageObjects += 1;
    }
    carry = atEof ? "" : combined.slice(acceptBefore);
  }
  return {
    encrypted,
    estimatedPageCount: pageObjects > 0 ? pageObjects : undefined,
    pageCountBasis: pageObjects > 0 ? "pdf_page_object_estimate" : "unknown",
  };
}

function isHeifFtyp(head) {
  if (head.length < 12 || head.toString("ascii", 4, 8) !== "ftyp") return false;
  if (HEIF_BRANDS.has(head.toString("ascii", 8, 12))) return true;
  const boxSize = head.readUInt32BE(0);
  const end = Math.min(head.length, boxSize >= 16 ? boxSize : 64, 64);
  for (let pos = 16; pos + 4 <= end; pos += 4) {
    if (HEIF_BRANDS.has(head.toString("ascii", pos, pos + 4))) return true;
  }
  return false;
}

async function detectFormat(handle, head, byteLength, allowFullScan = true) {
  if (byteLength === 0) return { format: "empty" };
  if (head.length >= 5 && head.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { format: "pdf" };
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
    head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
  ) {
    return { format: "png", dimensions: parsePngDimensions(head) };
  }
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    const dimensions = allowFullScan
      ? await parseJpegDimensions(handle, head, byteLength)
      : await parseJpegDimensions(handle, head, head.length);
    return { format: "jpeg", dimensions };
  }
  if (head.length >= 2 && head[0] === 0x42 && head[1] === 0x4d) {
    const dimensions = parseBmpDimensions(head, byteLength);
    if (dimensions) return { format: "bmp", dimensions };
  }
  if (
    head.length >= 4 &&
    ((head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a && head[3] === 0x00) ||
      (head[0] === 0x4d && head[1] === 0x4d && head[2] === 0x00 && head[3] === 0x2a))
  ) {
    return { format: "tiff", ...(await parseTiffMetadata(handle, head, byteLength)) };
  }
  if (isHeifFtyp(head)) {
    return { format: "heif" };
  }
  if (head.length >= 6 && ["GIF87a", "GIF89a"].includes(head.toString("ascii", 0, 6))) {
    return { format: "gif" };
  }
  if (head.length >= 12 && head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") {
    return { format: "webp" };
  }
  if (
    head.length >= 8 &&
    head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0 &&
    head[4] === 0xa1 && head[5] === 0xb1 && head[6] === 0x1a && head[7] === 0xe1
  ) {
    // Encryption stream names live in the OLE2 directory, which can sit anywhere in the file.
    const inHead = OLE2_ENCRYPTION_STREAMS.some((needle) => head.indexOf(needle) !== -1);
    if (inHead || (allowFullScan && byteLength > head.length && await fileContainsAny(handle, byteLength, OLE2_ENCRYPTION_STREAMS))) {
      return { format: "ole2_encrypted", encrypted: true };
    }
    return { format: "ole2" };
  }
  if (head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) {
    return { format: await inspectZipKind(handle, head, byteLength) };
  }
  const sample = head.subarray(0, Math.min(head.length, 2048)).toString("utf8").replace(/^\uFEFF/, "").trimStart();
  if (/^(?:<!doctype\s+html\b|<html\b)/i.test(sample)) {
    return { format: "html" };
  }
  return { format: "unrecognized" };
}

function boundingRect(box) {
  if (!Array.isArray(box) || box.length < 4 || box.length % 2 !== 0) return undefined;
  const xs = [];
  const ys = [];
  for (let i = 0; i < box.length; i += 2) {
    const x = box[i];
    const y = box[i + 1];
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
      return undefined;
    }
    xs.push(x);
    ys.push(y);
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function rectsOverlap(a, b) {
  const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  return overlapX > 1e-6 && overlapY > 1e-6;
}

async function inspectLabels(labelsFile, ocrFile) {
  const { handle: labelsHandle, size: labelsSize } = await openRegularFile(labelsFile);
  const findings = [];
  let rawText;
  try {
    if (labelsSize > MAX_LABELS_BYTES) {
      findings.push({
        code: "LABELS_FILE_NOT_INSPECTED",
        severity: "warning",
        detail: `Labels file (${labelsSize} bytes) is larger than this inspector reads (10 MiB); it was not inspected.`,
      });
      return { byteLength: labelsSize, notInspected: true, findings };
    }
    rawText = await labelsHandle.readFile("utf8");
  } finally {
    await labelsHandle.close();
  }

  const raw = JSON.parse(rawText);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("INVALID_LABELS_JSON");
  }
  const labels = Array.isArray(raw.labels) ? raw.labels : undefined;
  if (!labels) {
    findings.push({
      code: "MISSING_LABELS_ARRAY",
      severity: "error",
      detail: "Top-level labels array is absent.",
    });
    return { byteLength: labelsSize, hasSchema: typeof raw.$schema === "string", findings };
  }

  const seenNames = new Set();
  let duplicateLabelCount = 0;
  const emptyValueIndices = [];
  let outOfBoundsBoxCount = 0;
  const regionsByPage = new Map();

  labels.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    if (typeof entry.label === "string") {
      if (seenNames.has(entry.label)) duplicateLabelCount += 1;
      seenNames.add(entry.label);
    }
    const values = Array.isArray(entry.value) ? entry.value : [];
    if (values.length === 0) emptyValueIndices.push(index);
    for (const val of values) {
      if (!val || typeof val !== "object") continue;
      const page = Number.isInteger(val.page) ? val.page : 1;
      const boxes = Array.isArray(val.boundingBoxes) ? val.boundingBoxes : [];
      for (const box of boxes) {
        const rect = boundingRect(box);
        if (!rect) continue;
        if (rect.minX < 0 || rect.minY < 0 || rect.maxX > 1 || rect.maxY > 1) {
          outOfBoundsBoxCount += 1;
        }
        const list = regionsByPage.get(page) ?? [];
        list.push({ labelIndex: index, rect });
        regionsByPage.set(page, list);
      }
    }
  });

  let overlappingPairCount = 0;
  let pairChecks = 0;
  let overlapCheckIncomplete = false;
  for (const list of regionsByPage.values()) {
    list.sort((a, b) => a.rect.minX - b.rect.minX);
    for (let i = 0; i < list.length && !overlapCheckIncomplete; i += 1) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j += 1) {
        // Sorted by minX: once b.minX meets or exceeds a.maxX, no subsequent box on this page can overlap a.
        if (list[j].rect.minX >= a.rect.maxX - 1e-6) break;
        pairChecks += 1;
        if (pairChecks > MAX_OVERLAP_PAIR_CHECKS) {
          overlapCheckIncomplete = true;
          break;
        }
        if (a.labelIndex !== list[j].labelIndex && rectsOverlap(a.rect, list[j].rect)) {
          overlappingPairCount += 1;
        }
      }
    }
    if (overlapCheckIncomplete) break;
  }

  if (duplicateLabelCount > 0) {
    findings.push({
      code: "DUPLICATE_LABEL_DEFINITIONS",
      severity: "warning",
      detail: `${duplicateLabelCount} duplicate label definition(s) found.`,
    });
  }
  if (emptyValueIndices.length > 0) {
    findings.push({
      code: "EMPTY_LABEL_VALUES",
      severity: "warning",
      detail: `${emptyValueIndices.length} label entry/entries contain no bounding-box values.`,
    });
  }
  if (outOfBoundsBoxCount > 0) {
    findings.push({
      code: "BOUNDING_BOX_OUT_OF_NORMALIZED_RANGE",
      severity: "warning",
      detail: `${outOfBoundsBoxCount} bounding box(es) have coordinates outside [0, 1].`,
    });
  }
  if (overlappingPairCount > 0) {
    findings.push({
      code: "OVERLAPPING_LABEL_REGIONS",
      severity: "warning",
      detail: `${overlappingPairCount} cross-label bounding-box overlap(s) detected; verify template/neural labeling intent.`,
    });
  }
  if (overlapCheckIncomplete) {
    findings.push({
      code: "LABEL_OVERLAP_CHECK_INCOMPLETE",
      severity: "warning",
      detail: `Stopped overlap scan after ${MAX_OVERLAP_PAIR_CHECKS} x-overlapping region pair checks; overlap count is a lower bound.`,
    });
  }

  let ocrSummary;
  if (ocrFile) {
    const { handle: ocrHandle, size: ocrSize } = await openRegularFile(ocrFile);
    let ocrText;
    try {
      if (ocrSize > MAX_OCR_BYTES) {
        findings.push({
          code: "OCR_FILE_NOT_INSPECTED",
          severity: "warning",
          detail: `OCR JSON (${ocrSize} bytes) is larger than this inspector reads (500 MiB); it was not inspected.`,
        });
        ocrSummary = { byteLength: ocrSize, notInspected: true };
      } else {
        ocrText = await ocrHandle.readFile("utf8");
      }
    } finally {
      await ocrHandle.close();
    }
    if (ocrText !== undefined) {
      const ocrJson = JSON.parse(ocrText);
      const validAnalyzeResult = isPlainObject(ocrJson) && isPlainObject(ocrJson.analyzeResult);
      const pages = validAnalyzeResult && Array.isArray(ocrJson.analyzeResult.pages)
        ? ocrJson.analyzeResult.pages.length
        : undefined;
      ocrSummary = {
        byteLength: ocrSize,
        hasAnalyzeResult: validAnalyzeResult,
        pageCount: pages,
      };
      if (!validAnalyzeResult) {
        findings.push({
          code: "INVALID_OCR_JSON_SHAPE",
          severity: "error",
          detail: "OCR JSON does not contain an analyzeResult object.",
        });
      }
    }
  }

  return {
    byteLength: labelsSize,
    hasSchema: typeof raw.$schema === "string",
    labelCount: labels.length,
    emptyValueCount: emptyValueIndices.length,
    duplicateLabelCount,
    outOfBoundsBoxCount,
    overlappingPairCount,
    overlapCheckIncomplete,
    ...(ocrSummary ? { ocr: ocrSummary } : {}),
    findings,
  };
}

export async function inspectDocumentInput({
  file,
  tier = "S0",
  modelKind = "layout",
  labelsFile,
  ocrFile,
} = {}) {
  const normalizedTier = String(tier).toUpperCase();
  const normalizedModel = String(modelKind).toLowerCase();
  if (!TIERS.has(normalizedTier)) throw new Error("INVALID_TIER");
  if (!MODEL_KINDS.has(normalizedModel)) throw new Error("INVALID_MODEL_KIND");
  if (!file && !labelsFile) throw new Error("MISSING_INPUT");

  const findings = [];
  let documentReport;

  if (file) {
    const { handle, size: fileSize } = await openRegularFile(file);
    const overInspectLimit = fileSize > MAX_INSPECT_BYTES;

    const extension = extname(file).toLowerCase();
    const shownExtension = safeExtension(extension);
    const expectedFormat = EXT_TO_FORMAT.get(extension) ?? "unknown";
    let detected;
    let pdfDetails;
    try {
      const head = await readSlice(handle, 0, Math.min(fileSize, 256 * 1024));
      detected = await detectFormat(handle, head, fileSize, !overInspectLimit);
      if (detected.format === "pdf" && !overInspectLimit) {
        pdfDetails = await scanPdfStructure(handle, fileSize);
      }
    } finally {
      await handle.close();
    }
    if (overInspectLimit) {
      findings.push({
        code: "CONTENT_CHECKS_SKIPPED_OVER_LIMIT",
        severity: "info",
        detail: "File is larger than any tier accepts, so encryption and page-count scans were skipped.",
      });
    }

    const encrypted = Boolean(detected.encrypted || pdfDetails?.encrypted);
    const pageCount = detected.pageCount ?? pdfDetails?.estimatedPageCount;
    const pageCountBasis = detected.pageCountBasis ?? pdfDetails?.pageCountBasis ?? "not_applicable";

    if (detected.format === "empty") {
      findings.push({ code: "EMPTY_FILE", severity: "error", detail: "Input file is 0 bytes." });
    } else if (detected.format === "unrecognized") {
      findings.push({
        code: "UNRECOGNIZED_FORMAT",
        severity: "warning",
        detail: "File header did not match a recognized Document Intelligence signature; format remains unknown.",
      });
    } else if (detected.format === "ole2_encrypted" || encrypted) {
      findings.push({
        code: "PASSWORD_OR_ENCRYPTION_DETECTED",
        severity: "warning",
        detail: detected.format === "ole2_encrypted"
          ? "Office file is an encrypted package (password or rights protection); remove the protection before analysis."
          : "PDF has an /Encrypt dictionary (a password lock or permission restrictions). Password-locked PDFs must be unlocked before submission.",
      });
    }

    const legacyOffice = detected.format === "ole2";
    const matchesExpected =
      expectedFormat === "unknown" ||
      detected.format === expectedFormat ||
      // Encrypted OOXML is always wrapped in OLE2; a plain OLE2 file is reported below with a specific reason.
      ((legacyOffice || detected.format === "ole2_encrypted") && OOXML_EXTENSIONS.has(extension));
    if (!matchesExpected && detected.format !== "empty" && detected.format !== "unrecognized") {
      findings.push({
        code: "EXTENSION_FORMAT_MISMATCH",
        severity: "warning",
        detail: `Extension '${shownExtension}' expects ${expectedFormat}, but header bytes indicate ${detected.format}.`,
      });
    }

    if (legacyOffice) {
      findings.push({
        code: "UNSUPPORTED_DOCUMENT_FORMAT",
        severity: "warning",
        detail: OOXML_EXTENSIONS.has(extension)
          ? `'${shownExtension}' file is an OLE2 container, not an OOXML package (for example a renamed legacy .doc/.xls/.ppt). Save it as DOCX/XLSX/PPTX.`
          : "Legacy binary Office file (OLE2). The v4 input-format tables list DOCX, XLSX and PPTX; convert it to one of those.",
      });
    } else if (
      detected.format !== "empty" &&
      detected.format !== "unrecognized" &&
      detected.format !== "ole2_encrypted" &&
      !DIRECT_FORMATS.has(detected.format) &&
      !OFFICE_HTML_FORMATS.has(detected.format)
    ) {
      findings.push({
        code: "UNSUPPORTED_DOCUMENT_FORMAT",
        severity: "warning",
        detail: `Detected format '${detected.format}' is not in the documented v4.0 input formats (PDF, JPEG/PNG/BMP/TIFF/HEIF, DOCX/XLSX/PPTX, HTML).`,
      });
    }

    // Skip Office/HTML guidance when the bytes contradict the extension (for example an HTML error
    // page saved as .pdf): the mismatch finding above is the actionable signal.
    const isOfficeOrHtml = OFFICE_HTML_FORMATS.has(detected.format) && matchesExpected;
    if (isOfficeOrHtml && (normalizedModel === "prebuilt" || normalizedModel === "custom")) {
      findings.push({
        code: "FORMAT_UNSUPPORTED_FOR_MODEL_KIND",
        severity: "error",
        detail: `The v4.0 input-format tables do not list Office/HTML for '${normalizedModel}' models; use prebuilt-read or prebuilt-layout, or convert to PDF.`,
      });
    } else if (isOfficeOrHtml && normalizedModel === "classifier") {
      findings.push({
        code: "FORMAT_SUPPORT_UNCLEAR_FOR_MODEL_KIND",
        severity: "warning",
        detail: "Learn pages disagree on Office/HTML input for custom classification; test with one file or convert to PDF.",
      });
    } else if (isOfficeOrHtml) {
      findings.push({
        code: "OFFICE_HTML_FEATURE_RESTRICTIONS",
        severity: "info",
        detail: `In API ${SPEC_VERSION}, Office/HTML results do not include bounding polygons or lines.`,
      });
    }

    const maxBytes = normalizedTier === "F0" ? F0_MAX_BYTES : S0_MAX_BYTES;
    if (fileSize > maxBytes) {
      findings.push({
        code: "EXCEEDS_TIER_SIZE_LIMIT",
        severity: "error",
        detail: `File size (${fileSize} bytes) exceeds ${normalizedTier} limit (${maxBytes} bytes).`,
      });
    }

    if (Array.isArray(detected.outOfRangePages) && detected.outOfRangePages.length > 0) {
      const firstBad = detected.outOfRangePages[0];
      findings.push({
        code: "IMAGE_DIMENSIONS_OUT_OF_RANGE",
        severity: "error",
        detail: `TIFF page ${firstBad.page} dimensions (${firstBad.width}x${firstBad.height} px) fall outside the documented 50x50 to 10000x10000 px range${detected.outOfRangePages.length > 1 ? ` (${detected.outOfRangePages.length} pages out of range)` : ""}.`,
      });
    } else if (detected.dimensions) {
      const { width, height } = detected.dimensions;
      if (width < 50 || height < 50 || width > 10000 || height > 10000) {
        findings.push({
          code: "IMAGE_DIMENSIONS_OUT_OF_RANGE",
          severity: "error",
          detail: `Image dimensions (${width}x${height} px) fall outside the documented 50x50 to 10000x10000 px range.`,
        });
      }
    }

    const dimensionsMissingForRaster =
      RASTER_DIMENSION_FORMATS.has(detected.format) &&
      !detected.dimensions &&
      !(Array.isArray(detected.outOfRangePages) && detected.outOfRangePages.length > 0);
    if (dimensionsMissingForRaster) {
      findings.push({
        code: "IMAGE_DIMENSIONS_NOT_DETERMINED",
        severity: "warning",
        detail: `Could not determine pixel dimensions for ${detected.format} input locally; the 50x50 to 10000x10000 px requirement was not verified.`,
      });
    }

    if (detected.pageCountIncomplete) {
      findings.push({
        code: "TIFF_PAGE_SCAN_INCOMPLETE",
        severity: "warning",
        detail: `TIFF IFD scan stopped after ${pageCount ?? 0} page(s) before reaching a terminal IFD; total page count and remaining page dimensions are incomplete.`,
      });
    }

    const pageEstimateLabel = detected.pageCountIncomplete ? `at least ${pageCount}` : `${pageCount}`;
    if (typeof pageCount === "number") {
      if (normalizedTier === "F0" && pageCount > 2) {
        findings.push({
          code: "F0_TWO_PAGE_LIMIT",
          severity: "warning",
          detail: `Free tier (F0) processes only the first 2 pages (local page estimate: ${pageEstimateLabel}).`,
        });
      } else if (normalizedTier === "S0" && pageCount > 2000) {
        findings.push({
          code: "EXCEEDS_MAX_PAGES",
          severity: "warning",
          detail: `Up to 2,000 pages can be processed; the local page estimate is ${pageEstimateLabel} (a heuristic that can overcount incrementally saved PDFs). Use the pages parameter to select a range if needed.`,
        });
      }
    }

    documentReport = {
      extension: shownExtension,
      byteLength: fileSize,
      detectedFormat: detected.format,
      encrypted,
      ...(detected.dimensions ? { dimensions: detected.dimensions } : {}),
      ...(dimensionsMissingForRaster ? { dimensionsIncomplete: true } : {}),
      ...(pageCount !== undefined ? { pageCount } : {}),
      ...(detected.pageCountIncomplete ? { pageCountIncomplete: true } : {}),
      pageCountBasis,
    };
  }

  let labelsReport;
  if (labelsFile) {
    labelsReport = await inspectLabels(labelsFile, ocrFile);
    findings.push(...labelsReport.findings);
  }

  const hasError = findings.some((f) => f.severity === "error");
  const incompleteOrUnrecognized =
    documentReport?.detectedFormat === "unrecognized" ||
    Boolean(documentReport?.dimensionsIncomplete) ||
    Boolean(documentReport?.pageCountIncomplete) ||
    Boolean(labelsReport?.notInspected) ||
    Boolean(labelsReport?.overlapCheckIncomplete) ||
    Boolean(labelsReport?.ocr?.notInspected);
  const status = hasError ? "failed_preflight" : incompleteOrUnrecognized ? "unknown" : findings.some((f) => f.severity === "warning") ? "passed_with_warnings" : "passed_local_checks";

  return {
    specVersion: SPEC_VERSION,
    tier: normalizedTier,
    modelKind: normalizedModel,
    status,
    ...(documentReport ? { document: documentReport } : {}),
    ...(labelsReport
      ? {
          labels: {
            byteLength: labelsReport.byteLength,
            hasSchema: labelsReport.hasSchema,
            labelCount: labelsReport.labelCount,
            emptyValueCount: labelsReport.emptyValueCount,
            duplicateLabelCount: labelsReport.duplicateLabelCount,
            outOfBoundsBoxCount: labelsReport.outOfBoundsBoxCount,
            overlappingPairCount: labelsReport.overlappingPairCount,
            ...(labelsReport.overlapCheckIncomplete ? { overlapCheckIncomplete: true } : {}),
            ...(labelsReport.ocr ? { ocr: labelsReport.ocr } : {}),
          },
        }
      : {}),
    findings,
  };
}

function parseCli(argv) {
  const opts = { tier: "S0", modelKind: "layout" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--file") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.file = resolve(argv[++i]);
    } else if (arg === "--tier") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.tier = argv[++i];
    } else if (arg === "--model-kind") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.modelKind = argv[++i];
    } else if (arg === "--labels") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.labelsFile = resolve(argv[++i]);
    } else if (arg === "--ocr") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.ocrFile = resolve(argv[++i]);
    } else {
      throw new Error("USAGE");
    }
  }
  if (opts.ocrFile && !opts.labelsFile) throw new Error("USAGE");
  if (!opts.file && !opts.labelsFile) throw new Error("USAGE");
  if (!TIERS.has(String(opts.tier).toUpperCase()) || !MODEL_KINDS.has(String(opts.modelKind).toLowerCase())) {
    throw new Error("USAGE");
  }
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
    const report = await inspectDocumentInput(opts);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (err) {
    const code = err instanceof SyntaxError
      ? "INVALID_JSON"
      : (err?.code || (typeof err?.message === "string" && /^[A-Z0-9_]+$/.test(err.message) ? err.message : "READ_ERROR"));
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
