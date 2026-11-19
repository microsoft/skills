#!/usr/bin/env node
// Offline Azure RBAC evaluator for Document Intelligence and Content Understanding data-plane calls on a
// Foundry / Azure AI services resource. Reads exported role assignments, role definitions and account JSON;
// never contacts Azure and never prints IDs, keys, scopes or principal names.
// Exit codes: 0 = report written to stdout or --help, 1 = file/read/JSON error, 2 = usage/argument error.
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonFile } from "./json-file.mjs";

const MAX_JSON_BYTES = 64 * 1024 * 1024;
const MMI = "Microsoft.CognitiveServices/accounts/MultiModalIntelligence";
const FR = "Microsoft.CognitiveServices/accounts/FormRecognizer";

// Each operation lists the data actions it needs. `anyOf` groups accept any one action in the group.
export const OPERATIONS = {
  "cu-analyze": {
    plane: "data",
    allOf: [[`${MMI}/analyzers:analyze/action`, `${MMI}/analyzers:analyzebinary/action`], [`${MMI}/analyzerresults/read`]],
    detail: "Content Understanding analyze/analyzeBinary and GET result",
  },
  "cu-author": {
    plane: "data",
    allOf: [[`${MMI}/analyzers/write`], [`${MMI}/labelingProjects/write`]],
    detail: "Create or update Content Understanding analyzers and Studio labeling projects",
  },
  "cu-defaults-write": {
    plane: "data",
    allOf: [[`${MMI}/defaults/write`]],
    detail: "Set Content Understanding resource model-deployment defaults",
  },
  "cu-delete-result": {
    plane: "data",
    allOf: [[`${MMI}/analyzerresults/delete`]],
    detail: "Delete a Content Understanding analysis result before the retention period ends",
  },
  "di-analyze": {
    plane: "data",
    allOf: [[`${FR}/documentmodels:analyze/action`], [`${FR}/documentmodels/analyzeresults/read`]],
    detail: "Document Intelligence v4 analyze and GET analyze result",
  },
  "di-build": {
    plane: "data",
    allOf: [[`${FR}/documentmodels:build/action`, `${FR}/documentmodels:build/write`]],
    detail: "Document Intelligence v4 build (train) a custom model",
  },
  "list-keys": {
    plane: "control",
    allOf: [["Microsoft.CognitiveServices/accounts/listKeys/action"]],
    detail: "List account keys (key-based calls bypass role checks when local auth is enabled)",
  },
  "account-read": {
    plane: "control",
    allOf: [["Microsoft.CognitiveServices/accounts/read"]],
    detail: "Read the resource (portal and Studio resource discovery)",
  },
};

function usage() {
  return [
    "Usage: node check-foundry-tools-access.mjs --assignments <file.json> [--assignments <file.json> ...]",
    "         [--definitions <file.json> ...] (--account <account.json> | --resource-id <resource-id>)",
    "         [--operation cu-analyze|cu-author|cu-defaults-write|cu-delete-result|di-analyze|di-build|list-keys|account-read ...]",
    "",
    "Evaluates exported Azure role assignments for one caller against a Foundry / Azure AI services resource offline.",
    "Inputs: `az role assignment list --all --include-inherited --include-groups --assignee <caller> -o json`",
    "(or Azure MCP role assignment output collected per scope), `az role definition list -o json`, and",
    "`az cognitiveservices account show -o json`. Prints role names, scope types and verdicts only.",
    "Exit codes: 0 = report written or --help, 1 = file/read/JSON error, 2 = usage/argument error.",
  ].join("\n");
}

const lower = (value) => (typeof value === "string" ? value.toLowerCase() : "");
const guidTail = (value) => {
  const match = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i.exec(String(value ?? ""));
  return match ? match[1].toLowerCase() : "";
};

function pick(obj, ...names) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const name of names) {
    if (obj[name] !== undefined && obj[name] !== null) return obj[name];
    if (obj.properties && obj.properties[name] !== undefined && obj.properties[name] !== null) return obj.properties[name];
  }
  return undefined;
}

// Accepts az CLI, ARM REST (`value[].properties`), Az PowerShell (`Scope`, `RoleDefinitionId`) and generic
// MCP envelopes by walking the JSON for objects that carry a scope plus a role reference.
export function extractAssignments(json) {
  const out = [];
  const seen = new Set();
  const visit = (node, depth) => {
    if (depth > 8 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    const scope = pick(node, "scope", "Scope");
    const roleDefinitionId = pick(node, "roleDefinitionId", "RoleDefinitionId");
    const roleDefinitionName = pick(node, "roleDefinitionName", "RoleDefinitionName");
    if (typeof scope === "string" && (roleDefinitionId || roleDefinitionName)) {
      const principalId = lower(pick(node, "principalId", "ObjectId", "principalObjectId"));
      const key = `${lower(scope)}|${guidTail(roleDefinitionId) || lower(roleDefinitionName)}|${principalId}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          scope: scope.replace(/\/+$/, ""),
          roleGuid: guidTail(roleDefinitionId),
          roleName: typeof roleDefinitionName === "string" ? roleDefinitionName : "",
          principalId,
          principalType: String(pick(node, "principalType", "ObjectType") ?? "unknown"),
          hasCondition: Boolean(pick(node, "condition", "Condition")),
        });
      }
      return;
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") visit(value, depth + 1);
    }
  };
  visit(json, 0);
  return out;
}

// Accepts az CLI (`name` GUID, `roleName`, `permissions[]`), ARM REST (`properties.permissions`) and
// Az PowerShell (`Id`, `Name`, `Actions`, `DataActions`, ...).
export function extractDefinitions(json) {
  const out = [];
  const visit = (node, depth) => {
    if (depth > 6 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    const roleName = pick(node, "roleName", "RoleName");
    const permissions = pick(node, "permissions");
    const psActions = node.Actions ?? node.DataActions;
    if ((typeof roleName === "string" && Array.isArray(permissions)) || (typeof node.Name === "string" && Array.isArray(psActions))) {
      const perms = Array.isArray(permissions)
        ? permissions
        : [{ actions: node.Actions, notActions: node.NotActions, dataActions: node.DataActions, notDataActions: node.NotDataActions }];
      const merged = { actions: [], notActions: [], dataActions: [], notDataActions: [] };
      for (const p of perms) {
        for (const key of Object.keys(merged)) {
          const list = p?.[key] ?? p?.[key[0].toUpperCase() + key.slice(1)];
          if (Array.isArray(list)) merged[key].push(...list.filter((x) => typeof x === "string"));
        }
      }
      out.push({
        guid: guidTail(node.name) || guidTail(node.id) || guidTail(node.Id),
        roleName: typeof roleName === "string" ? roleName : node.Name,
        ...merged,
      });
      return;
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") visit(value, depth + 1);
    }
  };
  visit(json, 0);
  return out;
}

const patternCache = new Map();
export function actionMatches(pattern, action) {
  let re = patternCache.get(pattern);
  if (!re) {
    const escaped = pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    re = new RegExp(`^${escaped}$`, "i");
    patternCache.set(pattern, re);
  }
  return re.test(action);
}

function grants(definition, action, plane) {
  const allow = plane === "data" ? definition.dataActions : definition.actions;
  const deny = plane === "data" ? definition.notDataActions : definition.notActions;
  return allow.some((p) => actionMatches(p, action)) && !deny.some((p) => actionMatches(p, action));
}

function normalizeScope(scope) {
  return lower(scope).replace(/\/+$/, "");
}

// Classify an assignment scope relative to the target account resource ID.
export function classifyScope(scope, accountId) {
  const s = normalizeScope(scope);
  const t = normalizeScope(accountId);
  if (s === "/" || s === "") return { type: "root", applies: true };
  if (s.startsWith("/providers/microsoft.management/managementgroups/")) return { type: "management-group", applies: false };
  if (s === t) return { type: "resource", applies: true };
  if (t.startsWith(`${s}/`)) {
    if (/^\/subscriptions\/[^/]+$/.test(s)) return { type: "subscription", applies: true };
    if (/^\/subscriptions\/[^/]+\/resourcegroups\/[^/]+$/.test(s)) return { type: "resource-group", applies: true };
    return { type: "ancestor", applies: true };
  }
  if (s.startsWith(`${t}/projects/`)) return { type: "foundry-project", applies: false };
  if (s.startsWith(`${t}/`)) return { type: "child-resource", applies: false };
  return { type: "unrelated", applies: false };
}

function dataReach(definition) {
  if (!definition) return "unknown";
  const cu = grants(definition, `${MMI}/analyzers:analyze/action`, "data");
  const di = grants(definition, `${FR}/documentmodels:analyze/action`, "data");
  if (cu && di) return "di-and-cu";
  if (cu) return "cu-only";
  if (di) return "di-only";
  return definition.dataActions.length === 0 ? "none" : "other-services-only";
}

export function evaluateAccess({ assignments = [], definitions = [], account, resourceId, operations } = {}) {
  const findings = [];
  const accountId = typeof resourceId === "string" && resourceId ? resourceId : pick(account, "id");
  if (typeof accountId !== "string" || !/\/providers\/microsoft\.cognitiveservices\/accounts\/[^/]+$/i.test(accountId.replace(/\/+$/, ""))) {
    throw new Error("TARGET_RESOURCE_REQUIRED");
  }
  const byGuid = new Map();
  const byName = new Map();
  for (const d of definitions) {
    if (d.guid) byGuid.set(d.guid, d);
    if (d.roleName) byName.set(lower(d.roleName), d);
  }
  const resolveDefinition = (a) => byGuid.get(a.roleGuid) ?? byName.get(lower(a.roleName));

  const rows = assignments.map((a) => {
    const where = classifyScope(a.scope, accountId);
    const definition = resolveDefinition(a);
    return { a, where, definition, name: definition?.roleName || a.roleName || "(unnamed role)" };
  });

  const scopeTypes = {};
  for (const r of rows) scopeTypes[r.where.type] = (scopeTypes[r.where.type] ?? 0) + 1;
  const principals = new Set(rows.map((r) => r.a.principalId).filter(Boolean));
  const missingDefinitions = [...new Set(rows.filter((r) => !r.definition && r.where.type !== "unrelated").map((r) => r.name))];

  const wanted = operations?.length ? operations : Object.keys(OPERATIONS);
  const results = wanted.map((op) => {
    const spec = OPERATIONS[op];
    const applying = rows.filter((r) => r.where.applies);
    const managementGroups = rows.filter((r) => r.where.type === "management-group");
    const projectOnly = rows.filter((r) => r.where.type === "foundry-project");
    const satisfiedBy = (candidates) =>
      spec.allOf.every((group) => group.some((action) => candidates.some((r) => r.definition && grants(r.definition, action, spec.plane))));
    const grantingRows = (candidates) =>
      candidates.filter((r) => r.definition && spec.allOf.some((group) => group.some((action) => grants(r.definition, action, spec.plane))));
    if (satisfiedBy(applying)) {
      const via = grantingRows(applying);
      return {
        operation: op,
        plane: spec.plane,
        verdict: via.some((r) => r.a.hasCondition) ? "allowed_with_condition" : "allowed",
        matchingRoles: via.map((r) => ({ role: r.name, scopeType: r.where.type })),
        detail: spec.detail,
      };
    }
    if (applying.some((r) => !r.definition)) {
      return { operation: op, plane: spec.plane, verdict: "unknown_definitions_missing", matchingRoles: [], detail: spec.detail };
    }
    if (managementGroups.some((r) => !r.definition)) {
      return { operation: op, plane: spec.plane, verdict: "unknown_definitions_missing", matchingRoles: [], detail: spec.detail };
    }
    if (satisfiedBy(managementGroups)) {
      return {
        operation: op,
        plane: spec.plane,
        verdict: "unknown_management_group_ancestry",
        matchingRoles: grantingRows(managementGroups).map((r) => ({ role: r.name, scopeType: r.where.type })),
        detail: spec.detail,
      };
    }
    if (satisfiedBy(projectOnly)) {
      return {
        operation: op,
        plane: spec.plane,
        verdict: "blocked_project_scope_only",
        matchingRoles: grantingRows(projectOnly).map((r) => ({ role: r.name, scopeType: r.where.type })),
        detail: spec.detail,
      };
    }
    if (applying.length > 0) {
      return {
        operation: op,
        plane: spec.plane,
        verdict: spec.plane === "data" ? "blocked_no_data_action" : "blocked_no_action",
        matchingRoles: [],
        detail: spec.detail,
      };
    }
    return { operation: op, plane: spec.plane, verdict: "blocked_not_assigned", matchingRoles: [], detail: spec.detail };
  });

  const localAuthDisabled = pick(account, "disableLocalAuth");
  const keyAuth = localAuthDisabled === true ? "disabled" : localAuthDisabled === false ? "enabled" : "unknown";
  const customSubdomain = account ? (pick(account, "customSubDomainName") ? "present" : "missing") : "unknown";
  const kind = typeof pick(account, "kind") === "string" ? pick(account, "kind") : "unknown";

  for (const r of results) {
    if (r.verdict === "blocked_project_scope_only") {
      findings.push({
        code: "PROJECT_SCOPE_ONLY",
        severity: "error",
        detail: `${r.operation}: the role that contains this data action is assigned only at a Foundry project scope. Document Intelligence and Content Understanding authorize at the resource scope and assignments do not inherit upward; assign a role at the resource (or a parent) scope.`,
      });
    } else if (r.verdict === "blocked_no_data_action") {
      findings.push({
        code: "NO_DATA_ACTION",
        severity: "error",
        detail: `${r.operation}: roles that apply to this resource carry no matching data action (Owner, Contributor, Foundry Account Owner and Cognitive Services Contributor have none). Microsoft Entra calls are denied; key calls only work while local auth is enabled.`,
      });
    } else if (r.verdict === "blocked_not_assigned" || r.verdict === "blocked_no_action") {
      findings.push({
        code: "NOT_ASSIGNED",
        severity: "error",
        detail: `${r.operation}: no assignment in the input grants this at the resource or a parent scope.`,
      });
    } else if (r.verdict === "unknown_management_group_ancestry") {
      findings.push({
        code: "MANAGEMENT_GROUP_ANCESTRY_UNKNOWN",
        severity: "warning",
        detail: `${r.operation}: a potentially granting role is assigned at management-group scope, but the export does not prove that this management group contains the target subscription. Verify ancestry before treating it as allowed.`,
      });
    } else if (r.verdict === "unknown_definitions_missing") {
      findings.push({
        code: "DEFINITIONS_MISSING",
        severity: "warning",
        detail: `${r.operation}: at least one applicable role has no definition in the input; add \`az role definition list -o json\` output with --definitions.`,
      });
    } else if (r.verdict === "allowed_with_condition") {
      findings.push({
        code: "CONDITIONAL_ASSIGNMENT",
        severity: "warning",
        detail: `${r.operation}: granted through an assignment with a condition; conditions are not evaluated offline.`,
      });
    }
  }

  if (!["subscription", "resource-group", "management-group", "root", "ancestor"].some((t) => scopeTypes[t])) {
    findings.push({
      code: "PARENT_SCOPES_NOT_SEEN",
      severity: "warning",
      detail: "No subscription or resource-group assignments are in the input. If the export excluded inherited assignments (for example a per-scope MCP query), collect the parent scopes too or use `az role assignment list --all --include-inherited --include-groups`.",
    });
  }
  if (principals.size > 1) {
    findings.push({
      code: "MULTIPLE_PRINCIPALS",
      severity: "warning",
      detail: `The input holds assignments for ${principals.size} principals; the verdicts assume all of them apply to the caller (for example the user plus its groups).`,
    });
  }
  if (keyAuth === "disabled" && results.some((r) => r.plane === "data" && !r.verdict.startsWith("allowed"))) {
    findings.push({
      code: "LOCAL_AUTH_DISABLED",
      severity: "warning",
      detail: "disableLocalAuth is true: keys are rejected, so blocked data-plane operations cannot fall back to key auth.",
    });
  }
  if (customSubdomain === "missing") {
    findings.push({
      code: "CUSTOM_SUBDOMAIN_MISSING",
      severity: "warning",
      detail: "The account has no custom subdomain; Microsoft Entra ID authentication requires one.",
    });
  }
  if (assignments.length === 0) {
    findings.push({ code: "NO_ASSIGNMENTS", severity: "warning", detail: "The input contains no role assignments." });
  }
  findings.push({
    code: "OFFLINE_LIMITS",
    severity: "info",
    detail: "Deny assignments, PIM-eligible (inactive) assignments, conditions and propagation delay are not evaluated; confirm with the portal Check access or a real call.",
  });

  const hasError = findings.some((f) => f.severity === "error");
  const hasUnknown = results.some((r) => r.verdict.startsWith("unknown"));
  const status = hasError ? "failed_preflight" : hasUnknown ? "unknown" : findings.some((f) => f.severity === "warning") ? "passed_with_warnings" : "passed_local_checks";

  return {
    tool: "check-foundry-tools-access",
    status,
    target: { kind, keyAuth, customSubdomain },
    coverage: {
      assignmentCount: rows.length,
      principalCount: principals.size,
      scopeTypes,
      definitionsLoaded: definitions.length,
      rolesWithoutDefinition: missingDefinitions,
    },
    roles: rows
      .filter((r) => r.where.type !== "unrelated")
      .map((r) => ({ role: r.name, scopeType: r.where.type, appliesToResource: r.where.applies, diCuDataReach: dataReach(r.definition) })),
    operations: results,
    findings,
  };
}

function parseCli(argv) {
  const opts = { assignmentFiles: [], definitionFiles: [], operations: [] };
  const next = (i) => {
    if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error("USAGE");
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--assignments") opts.assignmentFiles.push(resolve(next(i++)));
    else if (arg === "--definitions") opts.definitionFiles.push(resolve(next(i++)));
    else if (arg === "--account") opts.accountFile = resolve(next(i++));
    else if (arg === "--resource-id") opts.resourceId = next(i++);
    else if (arg === "--operation") opts.operations.push(...next(i++).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
    else throw new Error("USAGE");
  }
  if (opts.assignmentFiles.length === 0 || (!opts.accountFile && !opts.resourceId)) throw new Error("USAGE");
  if (opts.operations.some((op) => !OPERATIONS[op])) throw new Error("USAGE");
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
    const assignments = opts.assignmentFiles.flatMap((f) => extractAssignments(readJsonFile(f, MAX_JSON_BYTES)));
    const definitions = opts.definitionFiles.flatMap((f) => extractDefinitions(readJsonFile(f, MAX_JSON_BYTES)));
    const account = opts.accountFile ? readJsonFile(opts.accountFile, MAX_JSON_BYTES) : undefined;
    const report = evaluateAccess({ assignments, definitions, account, resourceId: opts.resourceId, operations: opts.operations });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (err) {
    const code = err instanceof SyntaxError
      ? "INVALID_JSON"
      : (err?.code || (typeof err?.message === "string" && /^[A-Z0-9_]+$/.test(err.message) ? err.message : "READ_ERROR"));
    process.stderr.write(`${JSON.stringify({ error: String(code) })}\n`);
    process.exit(code === "TARGET_RESOURCE_REQUIRED" ? 2 : 1);
  }
}

try {
  if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    await main();
  }
} catch {
  // Imported as module
}
