# IaC Patching — Bicep

## When to Use

Use this reference when the user chooses **"Patch my IaC"** instead of "Fix now" (CLI).
This patches Bicep files in the project's `infra/` folder so reliability settings persist across `azd up`.

## Detection

1. Look for `infra/` folder in the project root
2. Check for `*.bicep` files (especially `main.bicep`, `main.parameters.json`)
3. Confirm with user: "I found Bicep files in `infra/`. Want me to patch them for reliability?"

## File Discovery

Search for resources to patch using these patterns:

```
# Find all Bicep files
Get-ChildItem -Path infra -Recurse -Filter *.bicep

# Common file structure:
# infra/main.bicep          — orchestrator, references modules
# infra/main.parameters.json — parameters
# infra/app/                 — app-specific modules
# infra/core/               — shared modules (host, storage, monitoring)
```

The resource definitions may be in module files, not `main.bicep`. Search all `.bicep` files for the resource type.

---

## ⚠️ AVM Modules vs Raw Bicep — Parameter Naming Differs

If the project uses **Azure Verified Modules** (`br/public:avm/res/...`), the parameter names will **not** match the raw ARM property names shown in the patches below. Per-service AVM examples live in the per-service references. The most universally-applicable mapping is:

| Raw ARM/Bicep property | AVM module parameter |
|---|---|
| `sku.name` (storage) | `skuName` (top-level) |

**Before patching, always:**

1. Detect AVM usage:
   ```powershell
   Select-String -Path infra -Recurse -Pattern "br/public:avm/res/" -List
   ```
2. For each AVM module reference, open the module's published README (the version is in the registry path, e.g. `br/public:avm/res/storage/storage-account:0.x.y`) or run:
   ```powershell
   # Show the module call so you can see which params it currently passes
   Select-String -Path infra -Recurse -Pattern "avm/res/storage/storage-account" -Context 0,15
   ```
3. Map the reliability property to the **module's parameter name**, not the ARM property name. When in doubt, search the actual module call for the property and patch what's already in use.

## Per-service Bicep patches

The patches for compute (zone redundancy on the App Service plan or Function App plan, health check path) live in the per-service references because the SKU rules and ARM types differ:

| Service | Reference |
|---|---|
| Azure App Service | [services/app-service/reliability.md](services/app-service/reliability.md) |
| Azure Functions | [services/functions/reliability.md](services/functions/reliability.md) |

> Azure Container Apps per-service Bicep patches are planned for a future version of this skill.

The one truly cross-service patch — **storage** — lives below.

---

## Patch: Storage Account — LRS / GRS → ZRS / GZRS

**Find:** `Microsoft.Storage/storageAccounts`

**Search pattern:** `resource .* 'Microsoft.Storage/storageAccounts@`

> **💡 No `sku` block in the IaC?** If the storage resource (or AVM module call) does not specify a SKU, Azure deploys it as **`Standard_GRS`** by default. The patch in that case is to **add** the `sku` block (raw Bicep) or **add** the `skuName` parameter (AVM), not find-and-replace an existing value. Always grep for the absence of `sku` / `skuName` before assuming there's a value to swap.

**Before:**
```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}
```

**After — change to ZRS:**
```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_ZRS'
  }
  kind: 'StorageV2'
}
```

### Case: SKU not specified at all (defaulted to GRS)

**Before (no `sku` block):**
```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
}
```

**After — add an explicit `sku`:**
```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_ZRS'
  }
  kind: 'StorageV2'
}
```

**AVM module equivalent:**
```bicep
module storage 'br/public:avm/res/storage/storage-account:<version>' = {
  // ...
  params: {
    name: storageAccountName
    skuName: 'Standard_ZRS'   // ← ADD THIS (defaults to Standard_GRS if omitted)
    // ...
  }
}
```

### Parameterized SKU (common pattern)

If the SKU is parameterized, update the default value:

**Before:**
```bicep
param storageSku string = 'Standard_LRS'
```

**After:**
```bicep
param storageSku string = 'Standard_ZRS'
```

Also check `main.parameters.json` for overrides:
```json
{
  "storageSku": {
    "value": "Standard_ZRS"
  }
}
```

### ⚠️ Important: Existing Deployed Storage

Changing SKU in Bicep expresses the **desired end state**, but does NOT automatically migrate existing storage.

- **New storage account** → deploys as ZRS directly ✅
- **Existing storage account** → ARM may attempt an in-place SKU update, but LRS→ZRS is a **storage redundancy conversion**, not a simple property change. For supported StorageV2/GPv2 accounts in supported regions, Azure can perform live conversion, but this is not guaranteed and the deployment may fail for unsupported account kinds.

**Always follow this order for existing storage:**
1. Patch the Bicep to `Standard_ZRS` (desired end state)
2. Run `az storage account migration start` to initiate the live conversion
3. Wait for migration to complete (`az storage account migration show`)
4. Then run `azd up` / deploy — the Bicep now matches the actual state

> ⛔ Do NOT run `azd up` before the migration completes. The deployment may fail or conflict with the in-progress migration.

---

## Deploy Plan (Skill executes this directly)

After patching, **the skill executes the deploys itself** — do not stop and tell the user to run commands. Confirm once with the user before each deploy, then run it.

Summarize the plan for the user:
```
✅ Bicep files patched for reliability.

Deploy plan (the skill will run these for you after your confirmation):
  1. Deploy 1 — safe patches only (zone redundancy, health probes, probes).
     Command: `azd up` (or `az deployment group create ...`).
  2. Storage migration (only if upgrading LRS → ZRS).
     Command: `az storage account migration start ...`, then poll until `sku.name = Standard_ZRS`.
  3. Deploy 2 — storage SKU patch (no-op confirmation that IaC matches live state).

Do NOT bundle the storage SKU change with the safe patches — a failed storage redundancy update can fail the whole deployment.

⚠️ Note: If you have an existing Container Apps environment without zone redundancy,
   the environment name was changed to force recreation. Your apps will be migrated
   to the new environment on next deploy.

Ready for Deploy 1? (yes / no)
```

