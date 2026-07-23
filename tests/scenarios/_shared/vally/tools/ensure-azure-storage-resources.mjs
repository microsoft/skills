#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";

function resolveAzInvocation() {
  if (process.env.AZURE_CLI_PATH?.trim()) {
    return { command: process.env.AZURE_CLI_PATH.trim(), args: [] };
  }

  if (process.platform !== "win32") {
    return { command: "az", args: [] };
  }

  const whereCmd = spawnSync("where.exe", ["az.cmd"], { encoding: "utf8" });
  if (whereCmd.status === 0) {
    const cmdPath = whereCmd.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (cmdPath) {
      const pythonPath = resolvePath(dirname(cmdPath), "..", "python.exe");
      if (existsSync(pythonPath)) {
        return { command: pythonPath, args: ["-IBm", "azure.cli"] };
      }

      return { command: cmdPath, args: [] };
    }
  }

  const whereExe = spawnSync("where.exe", ["az.exe"], { encoding: "utf8" });
  if (whereExe.status === 0) {
    const exePath = whereExe.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (exePath) {
      return { command: exePath, args: [] };
    }
  }

  return { command: "az.cmd", args: [] };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error,
  };
}

function fail(message, detail = "") {
  console.error(`[azure-provision] ${message}`);
  if (detail) {
    console.error(detail.trim());
  }
  process.exit(1);
}

function info(message) {
  console.log(`[azure-provision] ${message}`);
}

function sleepSeconds(seconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}

function parseJsonOutput(result, failureMessage) {
  if (!result.ok) {
    fail(failureMessage, result.stderr || result.error?.message || result.stdout);
  }

  try {
    return JSON.parse(result.stdout || "null");
  } catch (error) {
    fail(failureMessage, error instanceof Error ? error.message : String(error));
  }
}

function runAz(args) {
  return run(azInvocation.command, [...azInvocation.args, ...args]);
}

function sanitizeAlnumLower(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function resolveDefaults(subscriptionId) {
  const subSuffix = sanitizeAlnumLower(subscriptionId).slice(-8) || "local000";
  return {
    accountName: `vallysa${subSuffix}`.slice(0, 24),
    resourceGroup: `vally-rg-${subSuffix}`,
  };
}

const azInvocation = resolveAzInvocation();

const azVersion = runAz(["version"]);
if (!azVersion.ok) {
  fail("Azure CLI (az) is required but was not found or failed to run.", azVersion.stderr || azVersion.error?.message || "");
}

const accountShow = runAz(["account", "show", "--query", "id", "-o", "tsv"]);
if (!accountShow.ok) {
  fail(
    "No active Azure login context. Run az login locally, or ensure CI performs Azure login before evaluation.",
    accountShow.stderr
  );
}

const activeSubscription = accountShow.stdout.trim();
const defaults = resolveDefaults(activeSubscription);

const accountName = (process.env.AZURE_STORAGE_ACCOUNT || defaults.accountName).trim();
const resourceGroup = (process.env.AZURE_RESOURCE_GROUP || defaults.resourceGroup).trim();
const location = (process.env.AZURE_LOCATION || "eastus").trim();

if (!process.env.AZURE_STORAGE_ACCOUNT) {
  info(`AZURE_STORAGE_ACCOUNT not set; using generated default '${accountName}'.`);
}

if (!process.env.AZURE_RESOURCE_GROUP) {
  info(`AZURE_RESOURCE_GROUP not set; using generated default '${resourceGroup}'.`);
}

const rgExists = runAz(["group", "exists", "--name", resourceGroup, "-o", "tsv"]);
if (!rgExists.ok) {
  fail(`Failed checking resource group '${resourceGroup}'.`, rgExists.stderr);
}

if (rgExists.stdout.trim() !== "true") {
  info(`Creating resource group '${resourceGroup}' in '${location}'.`);
  const rgCreate = runAz([
    "group",
    "create",
    "--name",
    resourceGroup,
    "--location",
    location,
    "--only-show-errors",
    "-o",
    "none",
  ]);
  if (!rgCreate.ok) {
    fail(`Failed to create resource group '${resourceGroup}'.`, rgCreate.stderr);
  }
}

const accountShowResult = runAz([
  "storage",
  "account",
  "show",
  "--name",
  accountName,
  "--resource-group",
  resourceGroup,
  "--query",
  "id",
  "-o",
  "tsv",
  "--only-show-errors",
]);

let storageAccountId = "";
if (!accountShowResult.ok) {
  info(`Creating storage account '${accountName}' in resource group '${resourceGroup}'.`);
  const accountCreate = runAz([
    "storage",
    "account",
    "create",
    "--name",
    accountName,
    "--resource-group",
    resourceGroup,
    "--location",
    location,
    "--sku",
    "Standard_LRS",
    "--kind",
    "StorageV2",
    "--min-tls-version",
    "TLS1_2",
    "--allow-blob-public-access",
    "false",
    "--https-only",
    "true",
    "--only-show-errors",
    "--query",
    "id",
    "-o",
    "tsv",
  ]);
  if (!accountCreate.ok) {
    fail(`Failed to create storage account '${accountName}'.`, accountCreate.stderr);
  }
  storageAccountId = accountCreate.stdout.trim();
} else {
  storageAccountId = accountShowResult.stdout.trim();
}

if (!storageAccountId) {
  fail(`Could not resolve resource ID for storage account '${accountName}'.`);
}

const principalTypeResult = runAz(["account", "show", "--query", "user.type", "-o", "tsv"]);
if (!principalTypeResult.ok) {
  fail("Failed to determine active principal type.", principalTypeResult.stderr);
}

const principalTypeRaw = principalTypeResult.stdout.trim();
let assigneeObjectId = "";
let assigneePrincipalType = "";

if (principalTypeRaw.toLowerCase().includes("user")) {
  assigneePrincipalType = "User";
  const userObjectId = runAz(["ad", "signed-in-user", "show", "--query", "id", "-o", "tsv"]);
  if (!userObjectId.ok) {
    fail("Failed to resolve signed-in user object ID for role assignment.", userObjectId.stderr);
  }
  assigneeObjectId = userObjectId.stdout.trim();
} else {
  assigneePrincipalType = "ServicePrincipal";
  const spAppId = runAz(["account", "show", "--query", "user.name", "-o", "tsv"]);
  if (!spAppId.ok) {
    fail("Failed to resolve active service principal app ID for role assignment.", spAppId.stderr);
  }
  const spObjectId = runAz(["ad", "sp", "show", "--id", spAppId.stdout.trim(), "--query", "id", "-o", "tsv"]);
  if (!spObjectId.ok) {
    fail("Failed to resolve service principal object ID for role assignment.", spObjectId.stderr);
  }
  assigneeObjectId = spObjectId.stdout.trim();
}

if (!assigneeObjectId) {
  fail("Could not resolve assignee object ID for role assignment.");
}

const roleName = "Storage Blob Data Contributor";
const roleAssignments = parseJsonOutput(
  runAz([
    "role",
    "assignment",
    "list",
    "--assignee-object-id",
    assigneeObjectId,
    "--scope",
    storageAccountId,
    "--include-inherited",
    "-o",
    "json",
  ]),
  `Failed to check '${roleName}' role assignment.`
);

const hasRole = Array.isArray(roleAssignments)
  && roleAssignments.some((assignment) => assignment?.roleDefinitionName === roleName);

if (!hasRole) {
  info(`Assigning '${roleName}' at scope '${storageAccountId}'.`);
  const roleAssignmentArgs = [
  "role",
  "assignment",
  "create",
  "--assignee-object-id",
  assigneeObjectId,
  "--assignee-principal-type",
  assigneePrincipalType,
  "--role",
  roleName,
  "--scope",
  storageAccountId,
  "-o",
  "none",
  "--only-show-errors",
  ];

  const maxRoleAssignmentAttempts = 3;
  let createRole;
  for (let attempt = 1; attempt <= maxRoleAssignmentAttempts; attempt += 1) {
    createRole = runAz(roleAssignmentArgs);
    if (createRole.ok) {
      break;
    }

    info(
      `Attempt ${attempt}/${maxRoleAssignmentAttempts} to assign '${roleName}' failed: ${createRole.stderr.trim()}`
    );

    if (attempt < maxRoleAssignmentAttempts) {
      info("Sleeping 30 seconds to allow RBAC permissions to propagate before retrying.");
      sleepSeconds(30);
    }
  }

  if (!createRole.ok) {
    fail(
      `Failed to assign '${roleName}' after ${maxRoleAssignmentAttempts} attempts. Ensure this principal can manage RBAC assignments at storage account scope.`,
      createRole.stderr
    );
  }
}

const markerPath = ".vally/state/azure-storage-provisioning.json";
mkdirSync(dirname(markerPath), { recursive: true });
writeFileSync(
  markerPath,
  JSON.stringify(
    {
      marker: "azure-storage-provisioning-ran",
      accountName,
      resourceGroup,
      storageAccountId,
      principalType: assigneePrincipalType,
      assigneeObjectId,
      timestampUtc: new Date().toISOString(),
    },
    null,
    2
  ) + "\n",
  "utf8"
);

info("Provisioning/validation complete: resource group, storage account, and blob data role are in place.");