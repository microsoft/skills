#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

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
  console.error(`[azure-preflight] ${message}`);
  if (detail) {
    console.error(detail.trim());
  }
  process.exit(1);
}

function readProvisioningMarker() {
  const markerPath = ".vally/state/azure-storage-provisioning.json";
  if (!existsSync(markerPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(markerPath, "utf8"));
  } catch {
    return null;
  }
}

const azVersion = run("az", ["version"]);
if (!azVersion.ok) {
  fail("Azure CLI (az) is required but was not found or failed to run.", azVersion.stderr || azVersion.error?.message || "");
}

const accountShow = run("az", ["account", "show", "--query", "id", "-o", "tsv"]);
if (!accountShow.ok) {
  fail(
    "No active Azure login context. Run az login locally, or ensure CI performs Azure login before evaluation.",
    accountShow.stderr
  );
}

const activeSubscription = accountShow.stdout.trim();
const expectedSubscription = (process.env.AZURE_SUBSCRIPTION_ID || "").trim();
if (expectedSubscription && activeSubscription !== expectedSubscription) {
  fail(
    `Active subscription '${activeSubscription}' does not match AZURE_SUBSCRIPTION_ID '${expectedSubscription}'.`
  );
}

const marker = readProvisioningMarker();
const accountName = (process.env.AZURE_STORAGE_ACCOUNT || marker?.accountName || "").trim();
const resourceGroup = (process.env.AZURE_RESOURCE_GROUP || marker?.resourceGroup || "").trim();

if (!accountName) {
  fail(
    "Could not resolve storage account name. Set AZURE_STORAGE_ACCOUNT or run provisioning to create .vally/state/azure-storage-provisioning.json."
  );
}

if (!resourceGroup) {
  fail(
    "Could not resolve resource group. Set AZURE_RESOURCE_GROUP or run provisioning to create .vally/state/azure-storage-provisioning.json."
  );
}

const accountExists = run("az", [
  "storage",
  "account",
  "show",
  "--name",
  accountName,
  "--resource-group",
  resourceGroup,
  "--only-show-errors",
  "--query",
  "id",
  "-o",
  "tsv",
]);
if (!accountExists.ok) {
  fail(
    `Storage account '${accountName}' was not found in resource group '${resourceGroup}' or is not accessible.`,
    accountExists.stderr
  );
}

const dataPlane = run("az", [
  "storage",
  "container",
  "list",
  "--account-name",
  accountName,
  "--auth-mode",
  "login",
  "--num-results",
  "1",
  "--only-show-errors",
  "-o",
  "none",
]);
if (!dataPlane.ok) {
  fail(
    "Data-plane validation failed. Ensure this identity has Storage Blob Data permissions on the storage account.",
    dataPlane.stderr
  );
}

console.log("[azure-preflight] Passed: Azure login context, storage account existence, and blob data-plane access are valid.");
