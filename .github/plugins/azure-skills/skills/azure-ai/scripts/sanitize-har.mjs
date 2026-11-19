#!/usr/bin/env node
// Offline HAR summarizer for Azure AI Studio and portal traces (Document Intelligence Studio, Content
// Understanding Studio, Microsoft Foundry portal). Keeps method, masked host class, templated path,
// api-version, status, timing, correlation IDs and error codes. Drops bodies, cookies, auth headers, query
// strings, IP addresses and error messages. Never writes files; prints a JSON summary to stdout.
// Exit codes: 0 = report written to stdout or --help, 1 = file/read/JSON error, 2 = usage/argument error.
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonFile } from "./json-file.mjs";

const MAX_HAR_BYTES = 512 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const MAX_BODY_PARSE = 64 * 1024;
const REQUEST_HEADERS = new Set(["x-ms-client-request-id"]);
const RESPONSE_HEADERS = new Set(["apim-request-id", "x-ms-request-id", "x-ms-client-request-id", "x-ms-error-code", "x-ms-region", "retry-after"]);
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_PATH_ACTIONS = new Set([
  "analyze", "analyzebinary", "analyzebinaryinline", "analyzeinline", "authorizecopy",
  "build", "classify", "compose", "copy", "copyto", "grantcopyauthorization", "cancel",
]);
const SAFE_BODY_STATUSES = new Set([
  "canceled", "cancelled", "failed", "notstarted", "partiallysucceeded", "running", "succeeded",
]);
const SAFE_AUTH_ERRORS = new Set([
  "access_denied", "insufficient_scope", "interaction_required", "invalid_client", "invalid_request",
  "invalid_token", "login_required", "unauthorized_client",
]);
// Path segments that are API vocabulary and safe to keep; anything else becomes {id}.
const PATH_WORDS = new Set([
  "documentintelligence", "formrecognizer", "documentmodels", "documentclassifiers", "analyzeresults", "analyzebatchresults",
  "operations", "info", "contentunderstanding", "analyzers", "analyzerresults", "classifiers", "classifierresults",
  "defaults", "labelingprojects", "labels", "schema", "datasets", "files", "test", "train", "reference", "stats", "ocr", "document",
  "persondirectories", "faces", "persons", "results", "images", "api", "projects", "openai", "deployments", "models",
  "subscriptions", "resourcegroups", "providers", "microsoft.cognitiveservices", "accounts", "privateendpointconnections",
  "listkeys", "usages", "skus", "v1", "v2.0", "v2", "oauth2", "token", "authorize", "pdf", "figures",
]);

function usage() {
  return [
    "Usage: node sanitize-har.mjs --har <trace.har> [--all-hosts]",
    "",
    "Summarizes a browser HAR offline for sharing with support or a teammate. Keeps request method, host class",
    "(resource names masked), templated path, api-version, status, timings, correlation IDs (apim-request-id,",
    "x-ms-request-id, x-ms-client-request-id, Operation-Location result ID) and JSON error codes. Drops bodies,",
    "cookies, Authorization/key headers, query strings, IP addresses and error messages. Default keeps Azure AI,",
    "Azure Resource Manager, sign-in and Blob Storage hosts; --all-hosts keeps every host as a masked class.",
    "Exit codes: 0 = report written or --help, 1 = file/read/JSON error, 2 = usage/argument error.",
  ].join("\n");
}

// Map a host to a non-identifying class; resource-specific labels are masked.
export function hostClass(host) {
  const h = String(host ?? "").toLowerCase();
  const rules = [
    [/\.cognitiveservices\.azure\.com$/, "<resource>.cognitiveservices.azure.com"],
    [/\.services\.ai\.azure\.com$/, "<resource>.services.ai.azure.com"],
    [/\.openai\.azure\.com$/, "<resource>.openai.azure.com"],
    [/^documentintelligence\.ai\.azure\.com$/, "documentintelligence.ai.azure.com"],
    [/^formrecognizer\.appliedai\.azure\.com$/, "formrecognizer.appliedai.azure.com"],
    [/^contentunderstanding\.ai\.azure\.com$/, "contentunderstanding.ai.azure.com"],
    [/^(?:.+\.)?ai\.azure\.com$/, "ai.azure.com"],
    [/^management\.azure\.com$/, "management.azure.com"],
    [/^login\.microsoftonline\.com$/, "login.microsoftonline.com"],
    [/\.blob\.core\.windows\.net$/, "<storage>.blob.core.windows.net"],
    [/\.(?:api\.)?cognitive\.microsoft\.com$/, "<region>.api.cognitive.microsoft.com"],
  ];
  for (const [re, label] of rules) if (re.test(h)) return { label, known: true };
  return { label: "<other-host>", known: false };
}

export function templatePath(pathname) {
  const segments = String(pathname ?? "").split("/").filter(Boolean);
  return `/${segments
    .map((seg) => {
      let decoded = seg;
      try {
        decoded = decodeURIComponent(seg);
      } catch {
        // keep raw
      }
      const [name, action, ...rest] = decoded.split(":");
      const safeName = PATH_WORDS.has(name.toLowerCase()) ? name : GUID.test(name) ? "{guid}" : "{id}";
      const safeAction = rest.length === 0 && action && SAFE_PATH_ACTIONS.has(action.toLowerCase()) ? action.toLowerCase() : undefined;
      return safeAction ? `${safeName}:${safeAction}` : safeName;
    })
    .join("/")}`;
}

function headerMap(headers) {
  const map = new Map();
  for (const h of Array.isArray(headers) ? headers : []) {
    if (typeof h?.name === "string" && typeof h?.value === "string") map.set(h.name.toLowerCase(), h.value);
  }
  return map;
}

function resultIdFrom(location) {
  try {
    const url = new URL(location);
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    return GUID.test(last) ? last : undefined;
  } catch {
    return undefined;
  }
}

function errorCodes(content, responseStatus, pathname) {
  const text = typeof content?.text === "string" ? content.text : "";
  if (!text || text.length > MAX_BODY_PARSE || !/json/i.test(String(content?.mimeType ?? ""))) return undefined;
  const isOperationPath = /^\/(?:documentintelligence|formrecognizer|contentunderstanding)(?:\/|$)/i.test(pathname);
  if (responseStatus < 400 && !isOperationPath) return undefined;
  let body;
  try {
    body = JSON.parse(content.encoding === "base64" ? Buffer.from(text, "base64").toString("utf8") : text);
  } catch {
    return undefined;
  }
  const codes = [];
  const bodyStatus = typeof body?.status === "string" && SAFE_BODY_STATUSES.has(body.status.toLowerCase())
    ? body.status
    : undefined;
  if (responseStatus >= 400 || ["failed", "canceled", "cancelled"].includes(bodyStatus?.toLowerCase())) {
    let node = body?.error;
    for (let depth = 0; node && depth < 5; depth += 1) {
      if (typeof node.code === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(node.code)) codes.push(node.code);
      node = node.innererror ?? node.innerError;
    }
  }
  if (bodyStatus) codes.push(`status:${bodyStatus}`);
  return codes.length ? codes : undefined;
}

export function summarizeHar(har, { allHosts = false } = {}) {
  const entries = Array.isArray(har?.log?.entries) ? har.log.entries : null;
  if (!entries) throw Object.assign(new Error("NOT_A_HAR"), { code: "NOT_A_HAR" });
  const out = [];
  const statusClasses = {};
  const hostCounts = {};
  let skippedHosts = 0;
  let parseFailures = 0;
  for (const entry of entries) {
    let url;
    try {
      url = new URL(entry?.request?.url);
    } catch {
      parseFailures += 1;
      continue;
    }
    const host = hostClass(url.hostname);
    if (!host.known && !allHosts) {
      skippedHosts += 1;
      continue;
    }
    const status = Number(entry?.response?.status ?? 0);
    const statusClass = status === 0 ? "0 (no response: blocked, CORS, DNS or cancelled)" : `${Math.floor(status / 100)}xx`;
    statusClasses[statusClass] = (statusClasses[statusClass] ?? 0) + 1;
    hostCounts[host.label] = (hostCounts[host.label] ?? 0) + 1;
    if (out.length >= MAX_ENTRIES) continue;
    const req = headerMap(entry?.request?.headers);
    const res = headerMap(entry?.response?.headers);
    const ids = {};
    const safe = (value) => (typeof value === "string" && /^[A-Za-z0-9._:-]{1,100}$/.test(value) ? value : undefined);
    for (const name of REQUEST_HEADERS) if (safe(req.get(name))) ids[`request.${name}`] = req.get(name);
    for (const name of RESPONSE_HEADERS) if (safe(res.get(name))) ids[name] = res.get(name);
    const opLocation = res.get("operation-location");
    const resultId = opLocation ? resultIdFrom(opLocation) : undefined;
    if (resultId) ids["operation-location.resultId"] = resultId;
    const wwwAuth = res.get("www-authenticate");
    const authErrorValue = wwwAuth ? /error="([a-z_]{1,40})"/i.exec(wwwAuth)?.[1]?.toLowerCase() : undefined;
    const authError = authErrorValue && SAFE_AUTH_ERRORS.has(authErrorValue) ? authErrorValue : undefined;
    const apiVersion = url.searchParams.get("api-version");
    const codes = errorCodes(entry?.response?.content, status, url.pathname);
    out.push({
      started: typeof entry?.startedDateTime === "string" ? entry.startedDateTime : undefined,
      method: /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(entry?.request?.method ?? "")
        ? entry.request.method.toUpperCase()
        : "UNKNOWN",
      host: host.label,
      path: templatePath(url.pathname),
      ...(apiVersion && /^[0-9a-z.-]{1,30}$/i.test(apiVersion) ? { apiVersion } : {}),
      status,
      timeMs: Number.isFinite(entry?.time) ? Math.round(entry.time) : undefined,
      ...(Object.keys(ids).length ? { ids } : {}),
      ...(codes ? { errorCodes: codes } : {}),
      ...(authError ? { wwwAuthenticateError: authError } : {}),
      ...(req.has("authorization") ? { authScheme: /^bearer\s/i.test(req.get("authorization")) ? "bearer" : "other" } : {}),
      ...(req.has("ocp-apim-subscription-key") || req.has("api-key") ? { keyHeaderPresent: true } : {}),
    });
  }
  const findings = [];
  if (statusClasses["0 (no response: blocked, CORS, DNS or cancelled)"]) {
    findings.push({ code: "NO_RESPONSE_ENTRIES", severity: "warning", detail: "Some requests have status 0 (no response recorded). Check the browser console for CORS, DNS, proxy or blocked-request errors on those hosts." });
  }
  if (out.some((e) => e.status === 401)) findings.push({ code: "HTTP_401_PRESENT", severity: "info", detail: "401 responses present: compare authScheme, wwwAuthenticateError and errorCodes per host." });
  if (out.some((e) => e.status === 403)) findings.push({ code: "HTTP_403_PRESENT", severity: "info", detail: "403 responses present: role, network rule or disabled key auth can each produce 403; read errorCodes." });
  if (entries.length > out.length + skippedHosts + parseFailures) {
    findings.push({ code: "ENTRIES_TRUNCATED", severity: "warning", detail: `Only the first ${MAX_ENTRIES} kept entries are listed; counts cover all entries.` });
  }
  findings.push({ code: "RAW_HAR_SENSITIVE", severity: "info", detail: "The original HAR can contain cookies, tokens, keys, SAS URLs and document content. Share this summary instead and delete the raw file when done." });
  return {
    tool: "sanitize-har",
    status: "summarized",
    counts: { entries: entries.length, kept: out.length, skippedOtherHosts: skippedHosts, unparsable: parseFailures, byStatusClass: statusClasses, byHost: hostCounts },
    entries: out,
    findings,
  };
}

function parseCli(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--har") {
      if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error("USAGE");
      opts.har = resolve(argv[++i]);
    } else if (arg === "--all-hosts") opts.allHosts = true;
    else throw new Error("USAGE");
  }
  if (!opts.har) throw new Error("USAGE");
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
    const report = summarizeHar(readJsonFile(opts.har, MAX_HAR_BYTES), opts);
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
