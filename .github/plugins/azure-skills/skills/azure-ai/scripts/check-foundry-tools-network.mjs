#!/usr/bin/env node
// Read-only network preflight for a Foundry / Azure AI services resource used by Document Intelligence and
// Content Understanding. Reads exported account JSON; optionally resolves the resource host names from this
// machine and opens a TLS handshake (no HTTP request, no credentials). Prints labels and counts, never IPs,
// host names, resource IDs or rule values.
// Exit codes: 0 = report written to stdout or --help, 1 = file/read/JSON error, 2 = usage/argument error.
import { lookup as dnsLookup, resolveCname } from "node:dns/promises";
import { realpathSync } from "node:fs";
import { isIP } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonFile } from "./json-file.mjs";

const MAX_JSON_BYTES = 16 * 1024 * 1024;
const CONNECT_TIMEOUT_MS = 5000;
export const HOST_SUFFIXES = {
  cognitiveservices: "cognitiveservices.azure.com",
  openai: "openai.azure.com",
  "services.ai": "services.ai.azure.com",
};

function usage() {
  return [
    "Usage: node check-foundry-tools-network.mjs --account <account.json> [--client-ip <public-egress-ip>] [--resolve] [--connect]",
    "",
    "Checks `az cognitiveservices account show -o json` network settings offline. --resolve looks up the",
    "cognitiveservices, openai and services.ai host names of the resource from this machine; --connect also",
    "opens a TLS handshake on port 443 (no HTTP request). Prints labels and counts only.",
    "Exit codes: 0 = report written or --help, 1 = file/read/JSON error, 2 = usage/argument error.",
  ].join("\n");
}

const prop = (account, name) => account?.properties?.[name] ?? account?.[name];

function ipv4ToInt(ip) {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

// Returns "private", "public", "loopback" or "unknown" for an address string.
export function classifyAddress(ip) {
  const v = isIP(ip);
  if (v === 4) {
    const n = ipv4ToInt(ip);
    const inRange = (base, bits) => (n >>> (32 - bits)) === (ipv4ToInt(base) >>> (32 - bits));
    if (inRange("127.0.0.0", 8)) return "loopback";
    if (inRange("10.0.0.0", 8) || inRange("172.16.0.0", 12) || inRange("192.168.0.0", 16) || inRange("100.64.0.0", 10)) return "private";
    return "public";
  }
  if (v === 6) {
    const lowered = ip.toLowerCase();
    if (lowered === "::1") return "loopback";
    if (/^f[cd]/.test(lowered) || /^fe[89ab]/.test(lowered)) return "private";
    return "public";
  }
  return "unknown";
}

// IPv4 CIDR or single address containment; returns false for malformed rules.
export function ipv4InRule(ip, rule) {
  const parsed = parseIpv4Rule(rule);
  if (isIP(ip) !== 4 || !parsed) return false;
  const { base, bits } = parsed;
  if (bits === 0) return true;
  return (ipv4ToInt(ip) >>> (32 - bits)) === (ipv4ToInt(base) >>> (32 - bits));
}

function parseIpv4Rule(rule) {
  if (typeof rule !== "string") return undefined;
  const parts = rule.trim().split("/");
  if (parts.length > 2 || isIP(parts[0]) !== 4) return undefined;
  const bitsText = parts[1];
  if (bitsText !== undefined && !/^(?:[0-9]|[12][0-9]|3[0-2])$/.test(bitsText)) return undefined;
  return { base: parts[0], bits: bitsText === undefined ? 32 : Number(bitsText) };
}

export function evaluateNetwork({ account, clientIp, dns = [] } = {}) {
  if (!account || typeof account !== "object") throw new Error("ACCOUNT_REQUIRED");
  const findings = [];
  const kind = typeof account.kind === "string" ? account.kind : "unknown";
  const subdomain = prop(account, "customSubDomainName");
  const publicNetworkAccess = prop(account, "publicNetworkAccess") ?? "unknown";
  const acls = prop(account, "networkAcls") ?? {};
  const defaultAction = acls.defaultAction ?? "unknown";
  const ipRules = Array.isArray(acls.ipRules) ? acls.ipRules.map((r) => (typeof r === "string" ? r : r?.value)).filter((r) => typeof r === "string") : [];
  const vnetRules = Array.isArray(acls.virtualNetworkRules) ? acls.virtualNetworkRules : [];
  const bypass = acls.bypass ?? "unknown";
  const peConnections = Array.isArray(prop(account, "privateEndpointConnections")) ? prop(account, "privateEndpointConnections") : [];
  const peStates = {};
  for (const c of peConnections) {
    const status = c?.properties?.privateLinkServiceConnectionState?.status ?? c?.privateLinkServiceConnectionState?.status ?? "Unknown";
    peStates[status] = (peStates[status] ?? 0) + 1;
  }
  const approvedPe = peStates.Approved ?? 0;
  const restrictOutbound = prop(account, "restrictOutboundNetworkAccess") === true;
  const allowedFqdnCount = Array.isArray(prop(account, "allowedFqdnList")) ? prop(account, "allowedFqdnList").length : 0;
  const publicDisabled = String(publicNetworkAccess).toLowerCase() === "disabled";
  const denyByDefault = String(defaultAction).toLowerCase() === "deny";

  if (!subdomain) {
    findings.push({
      code: "CUSTOM_SUBDOMAIN_MISSING",
      severity: "warning",
      detail: "No custom subdomain: Microsoft Entra ID authentication, virtual network rules and private endpoints need a custom subdomain endpoint.",
    });
  }
  const slashRules = ipRules.filter((r) => /\/(31|32)$/.test(r.trim()));
  if (slashRules.length) {
    findings.push({
      code: "IP_RULE_SMALL_PREFIX",
      severity: "warning",
      detail: `${slashRules.length} IP rule(s) use a /31 or /32 prefix; Learn documents these prefix sizes as unsupported and asks for individual address rules instead.`,
    });
  }
  const malformed = ipRules.filter((r) => !parseIpv4Rule(r));
  if (malformed.length) {
    findings.push({ code: "IP_RULE_NOT_IPV4", severity: "warning", detail: `${malformed.length} IP rule(s) are not IPv4 addresses or ranges; IP rules support IPv4 only.` });
  }
  const privateRules = ipRules.filter((r) => isIP(r.trim().split("/")[0]) === 4 && classifyAddress(r.trim().split("/")[0]) !== "public");
  if (privateRules.length) {
    findings.push({
      code: "IP_RULE_PRIVATE_RANGE",
      severity: "warning",
      detail: `${privateRules.length} IP rule(s) use private address ranges; IP rules apply to public internet addresses only (use virtual network rules or private endpoints for private traffic).`,
    });
  }
  if (ipRules.length > 100 || vnetRules.length > 100) {
    findings.push({ code: "NETWORK_RULE_LIMIT", severity: "warning", detail: "More than 100 IP or virtual network rules are configured; Learn documents up to 100 of each." });
  }
  if (publicDisabled && approvedPe === 0) {
    findings.push({
      code: "NO_APPROVED_PRIVATE_ENDPOINT",
      severity: "error",
      detail: "Public network access is disabled and no private endpoint connection is Approved, so no client can reach the data plane.",
    });
  }
  if ((peStates.Pending ?? 0) > 0) {
    findings.push({ code: "PRIVATE_ENDPOINT_PENDING", severity: "warning", detail: `${peStates.Pending} private endpoint connection(s) are Pending approval and carry no traffic yet.` });
  }
  if (restrictOutbound) {
    findings.push({
      code: "OUTBOUND_RESTRICTED",
      severity: "warning",
      detail: `restrictOutboundNetworkAccess is true (${allowedFqdnCount} allowed FQDN entries): service-side fetches of URL sources (for example a Blob SAS URL) must target an allowed FQDN.`,
    });
  }

  let clientIpCovered = "not_checked";
  if (clientIp !== undefined) {
    if (isIP(clientIp) !== 4) {
      clientIpCovered = "invalid_input";
      findings.push({ code: "CLIENT_IP_NOT_IPV4", severity: "warning", detail: "--client-ip must be the public IPv4 address that Azure sees for the caller." });
    } else if (classifyAddress(clientIp) !== "public") {
      clientIpCovered = "not_public";
      findings.push({
        code: "CLIENT_IP_NOT_PUBLIC",
        severity: "warning",
        detail: "--client-ip is a private address; IP rules match the public egress address (proxy, NAT or firewall), not a private client address.",
      });
    } else {
      clientIpCovered = ipRules.some((r) => ipv4InRule(clientIp, r)) ? "covered" : "not_covered";
      if (publicDisabled) {
        findings.push({
          code: "CLIENT_IP_PUBLIC_PATH_NOT_PROVEN",
          severity: "info",
          detail: "The supplied client IP describes a public egress path, not proof that the failing request used it. Public network access is disabled; compare effective DNS and connectivity for the private endpoint path.",
        });
      } else if (denyByDefault && clientIpCovered === "not_covered") {
        findings.push({ code: "CLIENT_IP_NOT_ALLOWED", severity: "error", detail: "Default action is Deny and the supplied public egress IP matches no IP rule." });
      }
    }
  }

  const hosts = dns.map((d) => ({ ...d }));
  for (const h of hosts) {
    if (h.result === "public" && approvedPe > 0) {
      findings.push({
        code: "HOST_RESOLVES_PUBLIC",
        severity: publicDisabled ? "error" : "warning",
        detail: `The ${h.label} host resolves to a public address from this machine although an approved private endpoint exists; check the privatelink zone for that host, its virtual network link and any DNS forwarder.`,
      });
    }
    if (h.result === "private" && approvedPe === 0) {
      findings.push({ code: "HOST_PRIVATE_WITHOUT_APPROVED_PE", severity: "warning", detail: `The ${h.label} host resolves privately but the account lists no Approved private endpoint; the DNS record may be stale.` });
    }
    if (h.result === "not_found" || h.result === "error") {
      findings.push({ code: "HOST_NOT_RESOLVED", severity: "warning", detail: `The ${h.label} host did not resolve from this machine (${h.result}).` });
    }
    if (h.tls === "failed" || h.tcp === "timeout" || h.tcp === "refused") {
      findings.push({ code: "HOST_NOT_REACHABLE", severity: "warning", detail: `The ${h.label} host resolved but the connection stage failed (tcp: ${h.tcp ?? "n/a"}, tls: ${h.tls ?? "n/a"}).` });
    }
  }
  if (dns.length === 0) {
    findings.push({ code: "DNS_NOT_CHECKED", severity: "info", detail: "Run with --resolve on the affected client to compare effective DNS with the configuration." });
  }

  const hasError = findings.some((f) => f.severity === "error");
  const status = hasError ? "failed_preflight" : findings.some((f) => f.severity === "warning") ? "passed_with_warnings" : "passed_local_checks";
  return {
    tool: "check-foundry-tools-network",
    status,
    account: {
      kind,
      customSubdomain: subdomain ? "present" : "missing",
      publicNetworkAccess,
      defaultAction,
      ipRuleCount: ipRules.length,
      virtualNetworkRuleCount: vnetRules.length,
      bypass,
      privateEndpointConnections: peStates,
      restrictOutboundNetworkAccess: restrictOutbound,
    },
    clientIp: clientIpCovered,
    hosts,
    findings,
  };
}

async function probeHost(label, host, doConnect) {
  const out = { label };
  try {
    const addresses = await dnsLookup(host, { all: true });
    const classes = [...new Set(addresses.map((a) => classifyAddress(a.address)))];
    out.result = classes.includes("public") ? "public" : classes.includes("private") ? "private" : classes[0] ?? "unknown";
  } catch (err) {
    out.result = err?.code === "ENOTFOUND" || err?.code === "ENODATA" ? "not_found" : "error";
    return out;
  }
  try {
    const chain = await resolveCname(host);
    out.privatelinkCname = chain.some((c) => c.toLowerCase().includes(".privatelink."));
  } catch {
    out.privatelinkCname = "unknown";
  }
  if (doConnect) {
    await new Promise((done) => {
      const socket = tlsConnect({ host, port: 443, servername: host, timeout: CONNECT_TIMEOUT_MS }, () => {
        out.tcp = "connected";
        out.tls = "handshake_ok";
        socket.end();
        done();
      });
      socket.on("timeout", () => {
        out.tcp = out.tcp ?? "timeout";
        socket.destroy();
        done();
      });
      socket.on("error", (err) => {
        out.tcp = err?.code === "ECONNREFUSED" ? "refused" : out.tcp ?? (err?.code === "ETIMEDOUT" ? "timeout" : "connected_or_unknown");
        out.tls = "failed";
        done();
      });
    });
  }
  return out;
}

function parseCli(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--account") {
      if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error("USAGE");
      opts.accountFile = resolve(argv[++i]);
    } else if (arg === "--client-ip") {
      if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error("USAGE");
      opts.clientIp = argv[++i].trim();
    } else if (arg === "--resolve") opts.resolve = true;
    else if (arg === "--connect") {
      opts.resolve = true;
      opts.connect = true;
    } else throw new Error("USAGE");
  }
  if (!opts.accountFile) throw new Error("USAGE");
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
    const account = readJsonFile(opts.accountFile, MAX_JSON_BYTES);
    const subdomain = prop(account, "customSubDomainName");
    const dns = [];
    if (opts.resolve && typeof subdomain === "string" && /^[a-z0-9][a-z0-9-]{0,62}$/i.test(subdomain)) {
      for (const [label, suffix] of Object.entries(HOST_SUFFIXES)) {
        dns.push(await probeHost(label, `${subdomain}.${suffix}`, opts.connect));
      }
    }
    const report = evaluateNetwork({ account, clientIp: opts.clientIp, dns });
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
