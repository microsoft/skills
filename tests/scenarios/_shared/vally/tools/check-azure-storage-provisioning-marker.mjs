#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";

function fail(message, detail = "") {
  console.error(`[azure-provision-check] ${message}`);
  if (detail) {
    console.error(detail.trim());
  }
  process.exit(1);
}

const markerPath = ".vally/state/azure-storage-provisioning.json";
if (!existsSync(markerPath)) {
  fail(
    "Missing provisioning marker. The stimulus must run: node .vally/tools/ensure-azure-storage-resources.mjs"
  );
}

let marker;
try {
  marker = JSON.parse(readFileSync(markerPath, "utf8"));
} catch (error) {
  fail("Provisioning marker is not valid JSON.", String(error));
}

if (marker.marker !== "azure-storage-provisioning-ran") {
  fail("Provisioning marker is invalid.");
}

const expectedAccount = (process.env.AZURE_STORAGE_ACCOUNT || "").trim();
const expectedResourceGroup = (process.env.AZURE_RESOURCE_GROUP || "").trim();

if (!marker.accountName || typeof marker.accountName !== "string") {
  fail("Provisioning marker is missing accountName.");
}

if (!marker.resourceGroup || typeof marker.resourceGroup !== "string") {
  fail("Provisioning marker is missing resourceGroup.");
}

if (expectedAccount && marker.accountName !== expectedAccount) {
  fail(
    `Provisioning marker account mismatch. Expected '${expectedAccount}', found '${marker.accountName || ""}'.`
  );
}

if (expectedResourceGroup && marker.resourceGroup !== expectedResourceGroup) {
  fail(
    `Provisioning marker resource group mismatch. Expected '${expectedResourceGroup}', found '${marker.resourceGroup || ""}'.`
  );
}

if (!marker.storageAccountId || typeof marker.storageAccountId !== "string") {
  fail("Provisioning marker is missing storageAccountId.");
}

if (!marker.timestampUtc || typeof marker.timestampUtc !== "string") {
  fail("Provisioning marker is missing timestampUtc.");
}

console.log("[azure-provision-check] Passed: provisioning marker is present and valid.");
