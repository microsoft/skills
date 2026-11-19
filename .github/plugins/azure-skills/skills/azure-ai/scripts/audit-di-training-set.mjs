#!/usr/bin/env node
// Offline label-coverage audit for an Azure AI Document Intelligence custom extraction training set
// (fields.json + <document>.labels.json + <document>.ocr.json in a local folder). Prints counts, file types
// and field names only; never label text, OCR content, values or file names.
// Exit codes: 0 = report written to stdout or --help, 1 = folder/read/JSON error, 2 = usage/argument error.
import { open, readdir, stat } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeJsonText, readJsonFile } from "./json-file.mjs";

const SPEC_VERSION = "2024-11-30";
const MAX_FILES = 20000;
const MAX_DEPTH = 8;
const MAX_LABELS_BYTES = 10 * 1024 * 1024;
const MAX_FIELDS_BYTES = 2 * 1024 * 1024;
const OCR_HEAD_BYTES = 256 * 1024;
const MIN_TRAINING_DOCS = 5;
const DOC_TYPES = new Map([
  [".pdf", "pdf"], [".jpg", "jpeg"], [".jpeg", "jpeg"], [".png", "png"], [".bmp", "bmp"],
  [".tif", "tiff"], [".tiff", "tiff"], [".heic", "heif"], [".heif", "heif"],
  [".docx", "docx"], [".xlsx", "xlsx"], [".pptx", "pptx"], [".html", "html"],
]);

function usage() {
  return [
    "Usage: node audit-di-training-set.mjs --dir <local-training-folder> [--api-version 2024-11-30] [--anonymize-fields]",
    "",
    "Audits a local copy of a Document Intelligence custom extraction training set offline: label coverage per",
    "field and file type, fields never labeled, labels missing from fields.json, missing OCR files and OCR",
    "apiVersion drift. Prints counts and field names only (--anonymize-fields replaces names with field-N).",
    "Exit codes: 0 = report written or --help, 1 = folder/read/JSON error, 2 = usage/argument error.",
  ].join("\n");
}

const readJson = (path, maxBytes) => readJsonFile(path, maxBytes);

async function readOcrApiVersion(path) {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(OCR_HEAD_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const head = decodeJsonText(buffer.subarray(0, bytesRead), { fatal: false, stream: true });
    const match = /"apiVersion"\s*:\s*"([0-9]{4}-[0-9]{2}-[0-9]{2}(?:-preview)?)"/.exec(head);
    return match ? match[1] : "not_found";
  } finally {
    await handle.close();
  }
}

async function listFiles(root) {
  const files = [];
  let truncated = false;
  let truncationReason;
  const walk = async (dir, depth) => {
    if (truncated) return;
    if (depth > MAX_DEPTH) {
      truncated = true;
      truncationReason = "depth";
      return;
    }
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= MAX_FILES) {
        truncated = true;
        truncationReason = "files";
        return;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else if (entry.isFile()) files.push(full);
    }
  };
  await walk(root, 0);
  return { files, truncated, truncationReason };
}

// fields.json: { fields: [{ fieldKey, fieldType, ... }], definitions: {...} }
export function readSchema(json) {
  const fields = Array.isArray(json?.fields) ? json.fields : [];
  return fields
    .map((f) => ({ key: typeof f?.fieldKey === "string" ? f.fieldKey : undefined, type: typeof f?.fieldType === "string" ? f.fieldType : "unknown" }))
    .filter((f) => f.key);
}

// Top-level field of a label path: table/array labels use "<field>/<row>/<column>".
export function topLevelField(label) {
  if (typeof label !== "string") return undefined;
  return label.split("/")[0].replace(/~1/g, "/").replace(/~0/g, "~");
}

export function summarizeLabels(json) {
  const labels = Array.isArray(json?.labels) ? json.labels : null;
  if (!labels) return { valid: false, withValue: new Set(), emptyValue: new Set() };
  const withValue = new Set();
  const emptyValue = new Set();
  for (const l of labels) {
    const field = topLevelField(l?.label);
    if (!field) continue;
    const values = Array.isArray(l?.value) ? l.value : [];
    if (values.length > 0) withValue.add(field);
    else emptyValue.add(field);
  }
  for (const f of withValue) emptyValue.delete(f);
  return { valid: true, withValue, emptyValue };
}

export async function auditTrainingSet({ dir, apiVersion = SPEC_VERSION, anonymizeFields = false }) {
  const root = resolve(dir);
  const info = await stat(root);
  if (!info.isDirectory()) throw Object.assign(new Error("NOT_A_DIRECTORY"), { code: "NOT_A_DIRECTORY" });
  const { files, truncated, truncationReason } = await listFiles(root);
  const findings = [];

  const fieldsFiles = files.filter((f) => basename(f).toLowerCase() === "fields.json");
  const labelFiles = new Map();
  const ocrFiles = new Map();
  const sourceDocuments = new Map();
  for (const f of files) {
    const lowered = f.toLowerCase();
    if (lowered.endsWith(".labels.json")) labelFiles.set(f.slice(0, -".labels.json".length), f);
    else if (lowered.endsWith(".ocr.json")) ocrFiles.set(f.slice(0, -".ocr.json".length), f);
    else if (DOC_TYPES.has(extname(lowered))) sourceDocuments.set(f, f);
  }

  let schema = [];
  let schemaStatus = "missing";
  if (fieldsFiles.length > 0) {
    try {
      schema = readSchema(await readJson(fieldsFiles[0], MAX_FIELDS_BYTES));
      schemaStatus = schema.length ? "ok" : "no_fields";
    } catch {
      schemaStatus = "unreadable";
    }
  }
  if (fieldsFiles.length > 1) {
    findings.push({ code: "MULTIPLE_FIELDS_JSON", severity: "warning", detail: `${fieldsFiles.length} fields.json files found under the folder; only the first was used. Point --dir at a single project folder.` });
  }
  if (schemaStatus !== "ok") {
    findings.push({ code: "FIELDS_JSON_NOT_USABLE", severity: "warning", detail: `fields.json is ${schemaStatus}; coverage is computed from label files only.` });
  }

  const documents = new Map();
  for (const [key, path] of sourceDocuments) documents.set(key, { path, hasSource: true });
  for (const key of labelFiles.keys()) {
    const current = documents.get(key);
    documents.set(key, current ?? { path: labelFiles.get(key), hasSource: false });
  }

  const byType = {};
  const perField = new Map();
  const ensureField = (name) => {
    if (!perField.has(name)) perField.set(name, { labeled: 0, emptyOnly: 0, byType: {} });
    return perField.get(name);
  };
  for (const f of schema) ensureField(f.key);

  let labeledDocs = 0;
  let invalidLabelFiles = 0;
  let missingOcr = 0;
  let missingSourceDocuments = 0;
  let unlabeledDocs = 0;
  const ocrVersions = {};
  const matchingPath = (map, key) => {
    if (map.has(key)) return map.get(key);
    const folded = key.toLowerCase();
    const matches = [...map.entries()].filter(([candidate]) => candidate.toLowerCase() === folded);
    return matches.length === 1 ? matches[0][1] : undefined;
  };
  for (const [key, document] of documents) {
    const type = DOC_TYPES.get(extname(key).toLowerCase()) ?? "unknown";
    byType[type] = byType[type] ?? { documents: 0, labeled: 0 };
    byType[type].documents += 1;
    if (!document.hasSource) missingSourceDocuments += 1;
    const labelPath = matchingPath(labelFiles, key);
    if (!labelPath) {
      unlabeledDocs += 1;
      continue;
    }
    let summary;
    try {
      summary = summarizeLabels(await readJson(labelPath, MAX_LABELS_BYTES));
    } catch {
      summary = { valid: false };
    }
    if (!summary.valid) {
      invalidLabelFiles += 1;
      continue;
    }
    labeledDocs += 1;
    byType[type].labeled += 1;
    for (const field of summary.withValue) {
      const entry = ensureField(field);
      entry.labeled += 1;
      entry.byType[type] = (entry.byType[type] ?? 0) + 1;
    }
    for (const field of summary.emptyValue) ensureField(field).emptyOnly += 1;
    const ocrPath = matchingPath(ocrFiles, key);
    if (!ocrPath) missingOcr += 1;
    else {
      try {
        const v = await readOcrApiVersion(ocrPath);
        ocrVersions[v] = (ocrVersions[v] ?? 0) + 1;
      } catch {
        ocrVersions.unreadable = (ocrVersions.unreadable ?? 0) + 1;
      }
    }
  }

  const schemaKeys = new Set(schema.map((f) => f.key));
  const names = [...perField.keys()];
  const alias = new Map(names.map((n, i) => [n, anonymizeFields ? `field-${i + 1}` : n]));
  const fields = names.map((name) => {
    const e = perField.get(name);
    return {
      field: alias.get(name),
      inFieldsJson: schemaStatus === "ok" ? schemaKeys.has(name) : "unknown",
      labeledDocuments: e.labeled,
      unlabeledDocuments: documents.size - e.labeled,
      emptyValueOnlyDocuments: e.emptyOnly,
      labeledByFileType: e.byType,
    };
  });

  if (labeledDocs < MIN_TRAINING_DOCS) {
    findings.push({ code: "TOO_FEW_LABELED_DOCUMENTS", severity: "error", detail: `${labeledDocs} labeled document(s); custom models need a labeled dataset of at least ${MIN_TRAINING_DOCS} documents.` });
  }
  const never = fields.filter((f) => f.inFieldsJson === true && f.labeledDocuments === 0);
  if (never.length) {
    findings.push({ code: "FIELD_NEVER_LABELED", severity: "warning", detail: `${never.length} field(s) in fields.json have no labeled value in any document: ${never.map((f) => f.field).join(", ")}.` });
  }
  const partial = fields.filter((f) => f.labeledDocuments > 0 && f.unlabeledDocuments > 0);
  if (partial.length) {
    findings.push({
      code: "FIELD_PARTIALLY_LABELED",
      severity: "warning",
      detail: `${partial.length} field(s) are labeled in some documents but not others. Confirm the value is truly absent in the unlabeled documents: the model learns from labels, and values that are mostly empty in the training set are expected to come back empty with high confidence.`,
    });
  }
  const notInSchema = fields.filter((f) => f.inFieldsJson === false);
  if (notInSchema.length) {
    findings.push({ code: "LABEL_NOT_IN_FIELDS_JSON", severity: "warning", detail: `${notInSchema.length} label name(s) are not defined in fields.json (renamed or removed fields): ${notInSchema.map((f) => f.field).join(", ")}.` });
  }
  if (invalidLabelFiles) {
    findings.push({ code: "LABEL_FILE_UNREADABLE", severity: "warning", detail: `${invalidLabelFiles} label file(s) could not be parsed or have no labels array.` });
  }
  if (missingSourceDocuments) {
    findings.push({ code: "SOURCE_DOCUMENT_MISSING", severity: "warning", detail: `${missingSourceDocuments} label file(s) have no matching source document in the supplied folder; coverage is based on labels only and content/file validation cannot be completed.` });
  }
  if (missingOcr) {
    findings.push({ code: "OCR_FILE_MISSING", severity: "warning", detail: `${missingOcr} labeled document(s) have no matching .ocr.json layout file.` });
  }
  const versionKeys = Object.keys(ocrVersions).filter((v) => v !== "not_found" && v !== "unreadable");
  if (versionKeys.length > 1) {
    findings.push({ code: "OCR_API_VERSION_MIXED", severity: "warning", detail: `OCR files were produced by ${versionKeys.length} different layout API versions.` });
  }
  if (versionKeys.some((v) => v !== apiVersion)) {
    findings.push({ code: "OCR_API_VERSION_DIFFERS", severity: "warning", detail: `Some OCR files were produced by a layout API version other than ${apiVersion}; regenerate them with the API version you build with.` });
  }
  if (truncated) {
    findings.push({
      code: "FILE_SCAN_TRUNCATED",
      severity: "warning",
      detail: truncationReason === "depth"
        ? `Stopped at directory depth ${MAX_DEPTH}; counts are incomplete.`
        : `Stopped after ${MAX_FILES} files; counts are incomplete.`,
    });
  }

  const hasError = findings.some((f) => f.severity === "error");
  const status = hasError ? "failed_preflight" : truncated ? "unknown" : findings.some((f) => f.severity === "warning") ? "passed_with_warnings" : "passed_local_checks";
  return {
    specVersion: apiVersion,
    status,
    dataset: {
      documents: documents.size,
      labeledDocuments: labeledDocs,
      documentsWithoutLabels: unlabeledDocs,
      sourceDocuments: sourceDocuments.size,
      labelsWithoutSourceDocuments: missingSourceDocuments,
      byFileType: byType,
      fieldsJson: schemaStatus,
      schemaFieldCount: schema.length,
      ocrApiVersions: ocrVersions,
    },
    fields,
    findings,
  };
}

function parseCli(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--dir") {
      if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error("USAGE");
      opts.dir = argv[++i];
    } else if (arg === "--api-version") {
      if (!/^\d{4}-\d{2}-\d{2}(-preview)?$/.test(argv[i + 1] ?? "")) throw new Error("USAGE");
      opts.apiVersion = argv[++i];
    } else if (arg === "--anonymize-fields") opts.anonymizeFields = true;
    else throw new Error("USAGE");
  }
  if (!opts.dir) throw new Error("USAGE");
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
    const report = await auditTrainingSet(opts);
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
