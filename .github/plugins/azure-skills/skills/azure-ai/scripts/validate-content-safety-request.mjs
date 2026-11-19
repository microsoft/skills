#!/usr/bin/env node
// Local allowlist validator for standalone Azure AI Content Safety REST/SDK request payloads and images.
// Exit codes: 0 = report written to stdout or --help, 1 = file/read/size/JSON error, 2 = usage/argument error.
import { realpathSync } from "node:fs";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SPEC_VERSION = "2024-09-01";
const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_CHARS = 10000;
const MAX_SHIELD_DOCS = 5;
const OPERATIONS = new Set(["text-analyze", "image-analyze", "shield-prompt"]);
const CATEGORIES = new Set(["Hate", "SelfHarm", "Sexual", "Violence"]);
const TEXT_OUTPUT_TYPES = new Set(["FourSeverityLevels", "EightSeverityLevels"]);
const BLOCKLIST_NAME_RE = /^[0-9A-Za-z._~-]{1,64}$/;
const VALID_BMP_DIB_SIZES = new Set([12, 40, 52, 56, 64, 108, 124]);

async function readBoundedFile(filePath, maxBytes, encoding) {
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
    if (info.size > maxBytes) throw new Error("INPUT_TOO_LARGE");
    return encoding ? await handle.readFile(encoding) : await handle.readFile();
  } finally {
    await handle.close();
  }
}

function usage() {
  return [
    "Usage: node validate-content-safety-request.mjs --operation text-analyze|image-analyze|shield-prompt [--payload <request.json>] [--image <image-file>]",
    "",
    "Validates standalone Azure AI Content Safety (2024-09-01) payloads and images offline without emitting text, prompts, or image bytes.",
    "Exit codes: 0 = report written or --help, 1 = file/read/size/JSON error, 2 = usage/argument error.",
  ].join("\n");
}

function codePointLength(value) {
  return [...value].length;
}

function parseImageBuffer(buf) {
  if (buf.length === 0) return { format: "empty" };
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a &&
    buf.toString("ascii", 12, 16) === "IHDR"
  ) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { format: "png", ...(width > 0 && height > 0 ? { dimensions: { width, height } } : {}) };
  }
  if (buf.length >= 10 && ["GIF87a", "GIF89a"].includes(buf.toString("ascii", 0, 6))) {
    const width = buf.readUInt16LE(6);
    const height = buf.readUInt16LE(8);
    return { format: "gif", ...(width > 0 && height > 0 ? { dimensions: { width, height } } : {}) };
  }
  if (buf.length >= 26 && buf[0] === 0x42 && buf[1] === 0x4d && buf.readUInt32LE(6) === 0) {
    const pixelOffset = buf.readUInt32LE(10);
    const dibSize = buf.readUInt32LE(14);
    if (VALID_BMP_DIB_SIZES.has(dibSize) && pixelOffset >= 14 + dibSize && pixelOffset <= buf.length) {
      if (dibSize === 12) {
        const width = buf.readUInt16LE(18);
        const height = buf.readUInt16LE(20);
        return { format: "bmp", ...(width > 0 && height > 0 ? { dimensions: { width, height } } : {}) };
      }
      const rawWidth = buf.readInt32LE(18);
      const rawHeight = buf.readInt32LE(22);
      if (rawWidth > 0 && rawHeight !== 0 && rawHeight !== -2147483648) {
        return { format: "bmp", dimensions: { width: rawWidth, height: Math.abs(rawHeight) } };
      }
      return { format: "bmp" };
    }
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let offset = 2;
    while (offset + 4 <= buf.length) {
      if (buf[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (offset < buf.length && buf[offset] === 0xff) offset += 1;
      if (offset >= buf.length) break;
      const marker = buf[offset++];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
      if (offset + 2 > buf.length) break;
      const segLen = buf.readUInt16BE(offset);
      if (segLen < 2) break;
      const isSof = (marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof && offset + 7 <= buf.length && segLen >= 7) {
        const height = buf.readUInt16BE(offset + 3);
        const width = buf.readUInt16BE(offset + 5);
        return {
          format: "jpeg",
          ...(width > 0 && height > 0 ? { dimensions: { width, height } } : {}),
        };
      }
      if (offset + segLen > buf.length) break;
      offset += segLen;
    }
    return { format: "jpeg" };
  }
  if (
    buf.length >= 8 &&
    ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
      (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a))
  ) {
    const little = buf[0] === 0x49;
    const u16 = (p) => (little ? buf.readUInt16LE(p) : buf.readUInt16BE(p));
    const u32 = (p) => (little ? buf.readUInt32LE(p) : buf.readUInt32BE(p));
    const ifd = u32(4);
    if (ifd >= 8 && ifd + 2 <= buf.length) {
      const count = u16(ifd);
      if (count <= 4096 && ifd + 2 + count * 12 <= buf.length) {
        let width;
        let height;
        for (let i = 0; i < count; i += 1) {
          const pos = ifd + 2 + i * 12;
          const tag = u16(pos);
          const type = u16(pos + 2);
          const valCount = u32(pos + 4);
          if (valCount !== 1 || (type !== 3 && type !== 4)) continue;
          const val = type === 3 ? u16(pos + 8) : u32(pos + 8);
          if (tag === 256 && val > 0) width = val;
          if (tag === 257 && val > 0) height = val;
        }
        return {
          format: "tiff",
          ...(width !== undefined && height !== undefined ? { dimensions: { width, height } } : {}),
        };
      }
    }
    return { format: "tiff" };
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    let pos = 12;
    while (pos + 8 <= buf.length) {
      const chunk = buf.toString("ascii", pos, pos + 4);
      const cSize = buf.readUInt32LE(pos + 4);
      const body = pos + 8;
      if (chunk === "VP8X" && cSize >= 10 && body + 10 <= buf.length) {
        const width = 1 + buf.readUIntLE(body + 4, 3);
        const height = 1 + buf.readUIntLE(body + 7, 3);
        return { format: "webp", dimensions: { width, height } };
      }
      if (chunk === "VP8L" && cSize >= 5 && body + 5 <= buf.length && buf[body] === 0x2f) {
        const bits = buf.readUInt32LE(body + 1);
        const width = (bits & 0x3fff) + 1;
        const height = ((bits >> 14) & 0x3fff) + 1;
        return { format: "webp", dimensions: { width, height } };
      }
      if (
        chunk === "VP8 " &&
        cSize >= 10 &&
        body + 10 <= buf.length &&
        (buf[body] & 0x01) === 0 &&
        buf[body + 3] === 0x9d && buf[body + 4] === 0x01 && buf[body + 5] === 0x2a
      ) {
        const width = buf.readUInt16LE(body + 6) & 0x3fff;
        const height = buf.readUInt16LE(body + 8) & 0x3fff;
        return { format: "webp", ...(width > 0 && height > 0 ? { dimensions: { width, height } } : {}) };
      }
      pos = body + cSize + (cSize % 2);
    }
    return { format: "webp" };
  }
  return { format: "unrecognized" };
}

function checkCategories(categories, findings) {
  if (categories === undefined) return;
  if (!Array.isArray(categories)) {
    findings.push({
      code: "INVALID_CATEGORIES_ARRAY",
      severity: "error",
      detail: "'categories' must be an array when provided.",
    });
    return;
  }
  if (categories.length === 0) {
    // When categories aren't assigned the service returns its default set; an empty array is not documented.
    findings.push({
      code: "EMPTY_CATEGORIES_ARRAY",
      severity: "warning",
      detail: "'categories' is an empty array; omit it to get the default category set.",
    });
    return;
  }
  for (const cat of categories) {
    if (typeof cat !== "string" || !CATEGORIES.has(cat)) {
      findings.push({
        code: "UNSUPPORTED_HARM_CATEGORY",
        severity: "error",
        detail: "Unsupported category found; standalone Analyze Text/Image accepts Hate, SelfHarm, Sexual, Violence.",
      });
      break;
    }
  }
}

export async function validateContentSafetyRequest({ operation, payloadFile, imageFile } = {}) {
  const op = String(operation ?? "").toLowerCase();
  if (!OPERATIONS.has(op)) throw new Error("INVALID_OPERATION");
  if (!payloadFile && !imageFile) throw new Error("MISSING_INPUT");
  if (op !== "image-analyze" && !payloadFile) throw new Error("MISSING_PAYLOAD");

  const findings = [];
  let payload;
  if (payloadFile) {
    payload = JSON.parse(await readBoundedFile(payloadFile, MAX_PAYLOAD_BYTES, "utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("INVALID_PAYLOAD_JSON");
    }
  }

  let details = {};

  if (op === "text-analyze") {
    const hasText = typeof payload.text === "string";
    const charCount = hasText ? codePointLength(payload.text) : 0;
    if (!hasText || payload.text.trim().length === 0) {
      findings.push({ code: "MISSING_OR_EMPTY_TEXT", severity: "error", detail: "Analyze Text requires a non-empty 'text' string." });
    } else if (charCount > MAX_TEXT_CHARS) {
      findings.push({
        code: "EXCEEDS_TEXT_CHAR_LIMIT",
        severity: "error",
        detail: `'text' length (${charCount} characters) exceeds the ${MAX_TEXT_CHARS}-character Analyze Text limit.`,
      });
    }
    checkCategories(payload.categories, findings);

    const outputType = payload.outputType ?? "FourSeverityLevels";
    if (!TEXT_OUTPUT_TYPES.has(outputType)) {
      findings.push({
        code: "INVALID_TEXT_OUTPUT_TYPE",
        severity: "error",
        detail: "'outputType' must be 'FourSeverityLevels' (0,2,4,6) or 'EightSeverityLevels' (0..7).",
      });
    }

    if (payload.blocklistNames !== undefined) {
      if (!Array.isArray(payload.blocklistNames)) {
        findings.push({ code: "INVALID_BLOCKLIST_NAMES", severity: "error", detail: "'blocklistNames' must be an array of strings." });
      } else {
        const bad = payload.blocklistNames.some((n) => typeof n !== "string" || !BLOCKLIST_NAME_RE.test(n));
        if (bad) {
          findings.push({
            code: "INVALID_BLOCKLIST_NAME_CHARACTERS",
            severity: "error",
            detail: "One or more blocklistNames violate allowed characters (0-9, A-Z, a-z, -, ., _, ~; max 64 chars).",
          });
        }
      }
    }

    if (payload.haltOnBlocklistHit !== undefined && typeof payload.haltOnBlocklistHit !== "boolean") {
      findings.push({
        code: "INVALID_HALT_ON_BLOCKLIST_HIT_TYPE",
        severity: "error",
        detail: "'haltOnBlocklistHit' must be a boolean when provided.",
      });
    } else if (payload.haltOnBlocklistHit === true && Array.isArray(payload.blocklistNames) && payload.blocklistNames.length > 0) {
      findings.push({
        code: "HALT_ON_BLOCKLIST_HIT_OMITS_CATEGORIES",
        severity: "info",
        detail: "haltOnBlocklistHit is true: when a blocklist item matches, categoriesAnalysis is intentionally skipped.",
      });
    }

    details = {
      textCodePoints: charCount,
      outputType: TEXT_OUTPUT_TYPES.has(outputType) ? outputType : "invalid",
      blocklistCount: Array.isArray(payload.blocklistNames) ? payload.blocklistNames.length : 0,
      haltOnBlocklistHit: payload.haltOnBlocklistHit === undefined
        ? false
        : (typeof payload.haltOnBlocklistHit === "boolean" ? payload.haltOnBlocklistHit : "invalid"),
    };
  } else if (op === "image-analyze") {
    let imgBuf;
    let sourceKind = "none";
    if (imageFile) {
      imgBuf = await readBoundedFile(imageFile, MAX_PAYLOAD_BYTES);
      sourceKind = "file";
    } else if (typeof payload?.image?.content === "string") {
      const trimmed = payload.image.content.trim();
      if (trimmed.startsWith("data:")) {
        findings.push({
          code: "DATA_URI_PREFIX_IN_BASE64",
          severity: "warning",
          detail: "image.content starts with a 'data:...' URI prefix; pass raw base64 bytes only.",
        });
      }
      const b64 = trimmed.replace(/^data:[^,]*,/, "");
      // Node decodes base64url and stray characters leniently; the service expects standard base64.
      if (/[-_]/.test(b64)) {
        findings.push({
          code: "BASE64URL_ALPHABET_IN_CONTENT",
          severity: "warning",
          detail: "image.content uses URL-safe base64 characters ('-' or '_'); encode with the standard base64 alphabet ('+', '/').",
        });
      } else if (/[^A-Za-z0-9+/=\s]/.test(b64)) {
        findings.push({
          code: "INVALID_BASE64_CHARACTERS",
          severity: "warning",
          detail: "image.content contains characters outside the base64 alphabet; local decoding may not match the service.",
        });
      }
      imgBuf = Buffer.from(b64, "base64");
      sourceKind = "payload_base64";
    } else if (typeof payload?.image?.blobUrl === "string" && payload.image.blobUrl.trim() !== "") {
      sourceKind = "payload_blob_url";
      findings.push({
        code: "REMOTE_BLOB_IMAGE_NOT_INSPECTED",
        severity: "info",
        detail: "image.blobUrl is remote; image bytes, format, and pixel dimensions were not checked locally.",
      });
    } else {
      findings.push({
        code: "MISSING_IMAGE_CONTENT",
        severity: "error",
        detail: "Analyze Image requires image.content (base64), image.blobUrl, or --image <file>.",
      });
    }

    if (payload) {
      checkCategories(payload.categories, findings);
      if (payload.outputType !== undefined && payload.outputType !== "FourSeverityLevels") {
        findings.push({
          code: "UNSUPPORTED_IMAGE_OUTPUT_TYPE",
          severity: "error",
          detail: "Analyze Image supports only 'FourSeverityLevels' (0,2,4,6); 'EightSeverityLevels' is text-only.",
        });
      }
    }

    let parsedImg;
    if (imgBuf) {
      if (imgBuf.length > MAX_IMAGE_BYTES) {
        findings.push({
          code: "EXCEEDS_IMAGE_SIZE_LIMIT",
          severity: "error",
          detail: `Image size (${imgBuf.length} bytes) exceeds the 4 MB Analyze Image limit.`,
        });
      }
      parsedImg = parseImageBuffer(imgBuf);
      if (parsedImg.format === "empty") {
        findings.push({ code: "EMPTY_IMAGE", severity: "error", detail: "Image byte buffer is empty." });
      } else if (parsedImg.format === "unrecognized") {
        findings.push({
          code: "UNSUPPORTED_OR_UNRECOGNIZED_IMAGE_FORMAT",
          severity: "warning",
          detail: "Image bytes did not match JPEG, PNG, GIF, BMP, TIFF, or WEBP.",
        });
      } else if (!parsedImg.dimensions) {
        findings.push({
          code: "IMAGE_DIMENSIONS_NOT_DETERMINED",
          severity: "warning",
          detail: `Could not determine pixel dimensions for ${parsedImg.format} image locally; dimension limits were not verified.`,
        });
      }
      if (parsedImg.dimensions) {
        const { width, height } = parsedImg.dimensions;
        // Learn pages disagree on the maximum: the 2024-09-01 REST/SDK ImageData says 2048x2048,
        // the input-requirements table says 7200x7200. Only values outside both are errors.
        if (width < 50 || height < 50 || width > 7200 || height > 7200) {
          findings.push({
            code: "IMAGE_DIMENSIONS_OUT_OF_RANGE",
            severity: "error",
            detail: `Image dimensions (${width}x${height} px) are outside the documented 50x50 minimum and 7200x7200 maximum.`,
          });
        } else if (width > 2048 || height > 2048) {
          findings.push({
            code: "IMAGE_DIMENSIONS_ABOVE_2048",
            severity: "warning",
            detail: `Image dimensions (${width}x${height} px) exceed 2048x2048, the maximum stated by the 2024-09-01 API reference (another page states 7200x7200); resize if the request fails.`,
          });
        }
      }
    }

    details = {
      imageSource: sourceKind,
      ...(imgBuf ? { byteLength: imgBuf.length } : {}),
      ...(parsedImg ? { detectedFormat: parsedImg.format } : {}),
      ...(parsedImg?.dimensions ? { dimensions: parsedImg.dimensions } : {}),
    };
  } else if (op === "shield-prompt") {
    const hasPrompt = typeof payload.userPrompt === "string";
    const promptChars = hasPrompt ? codePointLength(payload.userPrompt) : 0;
    const docs = Array.isArray(payload.documents) ? payload.documents : undefined;
    let docTotalChars = 0;

    if (payload.userPrompt !== undefined && typeof payload.userPrompt !== "string") {
      findings.push({ code: "INVALID_USER_PROMPT_TYPE", severity: "error", detail: "'userPrompt' must be a string." });
    }
    if (promptChars > MAX_TEXT_CHARS) {
      findings.push({
        code: "EXCEEDS_USER_PROMPT_CHAR_LIMIT",
        severity: "error",
        detail: `'userPrompt' (${promptChars} characters) exceeds the ${MAX_TEXT_CHARS}-character Prompt Shields limit.`,
      });
    }

    if (payload.documents !== undefined && !docs) {
      findings.push({ code: "INVALID_DOCUMENTS_ARRAY", severity: "error", detail: "'documents' must be an array of strings." });
    } else if (docs) {
      if (docs.length > MAX_SHIELD_DOCS) {
        findings.push({
          code: "EXCEEDS_DOCUMENTS_COUNT_LIMIT",
          severity: "error",
          detail: `'documents' contains ${docs.length} items; Prompt Shields accepts at most ${MAX_SHIELD_DOCS} documents per request.`,
        });
      }
      let nonStringDoc = false;
      for (const doc of docs) {
        if (typeof doc !== "string") {
          nonStringDoc = true;
        } else {
          docTotalChars += codePointLength(doc);
        }
      }
      if (nonStringDoc) {
        findings.push({ code: "NON_STRING_DOCUMENT_ENTRY", severity: "error", detail: "Every element in 'documents' must be a string." });
      }
      if (docTotalChars > MAX_TEXT_CHARS) {
        findings.push({
          code: "EXCEEDS_DOCUMENTS_TOTAL_CHAR_LIMIT",
          severity: "error",
          detail: `Combined 'documents' length (${docTotalChars} characters) exceeds the ${MAX_TEXT_CHARS}-character total limit.`,
        });
      }
    }

    const nonEmptyDocs = docs ? docs.some((d) => typeof d === "string" && d.trim().length > 0) : false;
    if ((!hasPrompt || payload.userPrompt.trim().length === 0) && !nonEmptyDocs) {
      findings.push({
        code: "EMPTY_SHIELD_PROMPT_INPUT",
        severity: "warning",
        detail: "Provide a non-empty 'userPrompt' and/or at least one non-empty string in 'documents'.",
      });
    }

    details = {
      userPromptCodePoints: promptChars,
      documentCount: docs ? docs.length : 0,
      documentsTotalCodePoints: docTotalChars,
    };
  }

  const hasError = findings.some((f) => f.severity === "error");
  const unverifiedImage =
    op === "image-analyze" &&
    (details.imageSource === "payload_blob_url" ||
      details.detectedFormat === "unrecognized" ||
      (details.detectedFormat && details.detectedFormat !== "empty" && !details.dimensions));
  const status = hasError
    ? "failed_preflight"
    : unverifiedImage
      ? "unknown"
      : findings.some((f) => f.severity === "warning") ? "passed_with_warnings" : "passed_local_checks";

  return {
    specVersion: SPEC_VERSION,
    operation: op,
    status,
    details,
    findings,
  };
}

function parseCli(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--operation") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.operation = argv[++i];
    } else if (arg === "--payload") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.payloadFile = resolve(argv[++i]);
    } else if (arg === "--image") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.imageFile = resolve(argv[++i]);
    } else {
      throw new Error("USAGE");
    }
  }
  const op = String(opts.operation ?? "").toLowerCase();
  if (!OPERATIONS.has(op)) throw new Error("USAGE");
  if (!opts.payloadFile && !opts.imageFile) throw new Error("USAGE");
  if (op !== "image-analyze" && !opts.payloadFile) throw new Error("USAGE");
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
    const report = await validateContentSafetyRequest(opts);
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
