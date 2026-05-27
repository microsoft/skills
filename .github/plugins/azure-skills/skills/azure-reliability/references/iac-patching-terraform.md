# IaC Patching — Terraform

## When to Use

Use this reference when the user chooses **"Patch my IaC"** instead of "Fix now" (CLI).
This patches Terraform files in the project's `infra/` folder so reliability settings persist across `terraform apply` / `azd up`.

## Detection

1. Look for `infra/` folder in the project root
2. Check for `*.tf` files (especially `main.tf`, `variables.tf`)
3. Confirm with user: "I found Terraform files in `infra/`. Want me to patch them for reliability?"

## File Discovery

```
# Find all Terraform files
Get-ChildItem -Path infra -Recurse -Filter *.tf

# Common file structure:
# infra/main.tf              — main resources
# infra/variables.tf          — input variables
# infra/terraform.tfvars      — variable values
# infra/modules/              — reusable modules
```

Resource definitions may be in module files. Search all `.tf` files for the resource type.

## Per-service Terraform patches

The patches for compute (zone redundancy on the App Service Plans / environments, Function App plan, health check path) live in the per-service references because the SKU rules and resource types differ:

| Service | Reference |
|---|---|
| Azure App Service | [services/app-service/reliability.md](services/app-service/reliability.md) |
| Azure Functions | [services/functions/reliability.md](services/functions/reliability.md) |

> Azure App Service and Azure Container Apps per-service Terraform patches are planned for a future version of this skill.

The one truly cross-service patch — **storage** — lives below.

---

## Patch: Storage Account — LRS / GRS → ZRS / GZRS

**Find:** `azurerm_storage_account`

**Search pattern:** `resource "azurerm_storage_account"`

**Before:**
```hcl
resource "azurerm_storage_account" "storage" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}
```

**After — change to ZRS:**
```hcl
resource "azurerm_storage_account" "storage" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "ZRS"
}
```

### Parameterized Replication Type

If parameterized, update the default:

**variables.tf — Before:**
```hcl
variable "storage_replication_type" {
  default = "LRS"
}
```

**After:**
```hcl
variable "storage_replication_type" {
  default = "ZRS"
}
```

Also check `terraform.tfvars` for overrides.

### ⚠️ Existing Deployed Storage

Changing `account_replication_type` in Terraform expresses the **desired end state**, but LRS→ZRS is a **storage redundancy conversion**, not a simple property change. Terraform may attempt an in-place update that fails, or worse, plan a destroy+recreate (data loss risk).

**Always follow this order for existing storage:**
1. Patch Terraform to `account_replication_type = "ZRS"` (desired end state)
2. Run `az storage account migration start` to initiate the live conversion
3. Wait for migration to complete (`az storage account migration show`)
4. Run `terraform plan` — confirm it shows **no changes** (state now matches desired)
5. If plan still shows changes, run `terraform refresh` to sync state, then re-plan

> ⛔ Do NOT run `terraform apply` before the migration completes. It may fail or attempt to recreate the storage account.

---

## Deploy Plan (Skill executes this directly)

After patching, **the skill executes the deploys itself** — do not stop and tell the user to run commands. Confirm once with the user before each deploy, then run it.

Summarize the plan for the user:
```
✅ Terraform files patched for reliability.

Deploy plan (the skill will run these for you after your confirmation):
  1. `terraform plan -out tfplan` (skill will show the plan summary)
  2. Deploy 1 — `terraform apply tfplan` for the safe patches.
  3. Storage migration (only if upgrading LRS → ZRS).
     Command: `az storage account migration start ...`, then poll until `sku.name = Standard_ZRS`.
  4. Deploy 2 — second `terraform plan` + `apply` for the storage SKU patch (no-op confirmation).

Do NOT bundle the storage SKU change with the safe patches — a failed storage redundancy update can fail the whole apply.

⚠️ Note: If you have an existing Container Apps environment without zone redundancy,
   the environment name was changed to force recreation. The skill will surface the
   `terraform plan` summary before applying so you can confirm — apps will be recreated
   in the new environment.

Ready to run `terraform plan`? (yes / no)
```

