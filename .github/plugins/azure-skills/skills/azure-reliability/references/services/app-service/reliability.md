# Azure App Service — Reliability Reference

## Supported Plans & Zone Redundancy

| Plan | Zone Redundancy | Min Instances | Health Check |
|------|----------------|---------------|--------------|
| Free/Shared (F1/D1) | ❌ Not supported | N/A | ❌ |
| Basic (B1/B2/B3) | ❌ Not supported | N/A | ✅ |
| Standard (S1/S2/S3) | ❌ Not supported | N/A | ✅ |
| Premium v2 (P1v2+) | ✅ `zoneRedundant: true` + `capacity: 2` | 2 | ✅ |
| Premium v3 (P0v3+) | ✅ `zoneRedundant: true` + `capacity: 2` | 2 (recommended) | ✅ |
| Premium v4 (P0v4+) | ✅ `zoneRedundant: true` + `capacity: 2` | 2 (recommended) | ✅ |
| Isolated v2 (I1v2+) | ✅ `zoneRedundant: true` + `capacity: 2`  | 2 | ✅ |

## Assessment Queries

> **⚠️ Output format:** Use `--query "data[]" -o json` for `az graph query`. `-o table` only shows summary columns (`Count`, `Total_records`) and hides projected fields. Standard `az webapp` commands work fine with `-o table`.

### Plan Zone Redundancy
```bash
az graph query -q "
resources
| where resourceGroup =~ '<rg>'
| where type =~ 'microsoft.web/serverfarms'
| where kind !contains 'functionapp'
| project name, sku=sku.name, capacity=sku.capacity, zoneRedundant=properties.zoneRedundant, location
" --subscriptions <sub-id> --query "data[]" -o json
```

### Health Check Configuration
```bash
az webapp config show --name <app> --resource-group <rg> \
  --query "{healthCheckPath:healthCheckPath, alwaysOn:alwaysOn}" -o table
```

### Client Affinity (ARR Affinity) — should be **disabled** for ZR / multi-region
```bash
az webapp show --name <app> --resource-group <rg> \
  --query "clientAffinityEnabled" -o tsv
```
When `true`, sticky sessions pin clients to a single instance and defeat zone load balancing.

### Deployment Slots (for zero-downtime deploys)
```bash
az webapp deployment slot list --name <app> --resource-group <rg> \
  --query "[].{name:name, state:state}" -o table
```

### Auto Heal

Auto Heal automatically restarts or mitigates your web app when it hits defined thresholds.  Can be configured via Azure Portal, CLI or ARM/Bicep

Azure Portal - App Service -> Diagnose and solve problems -> Auto-heal (under Diagnostic Tools) or directly: App Service -> Configuration -> General settings -> Auto Heal

CLI
```bash
az webapp config set --resource-group <rg> --name <app> --auto-heal-enabled true

# Rules must be set via ARM PATCH (CLI doesn't expose autoHealRules directly)
az rest --method patch \
  --uri "https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/{app}/config/web?api-version=2022-03-01" \
  --body '{"properties":{"autoHealEnabled":true,"autoHealRules":{...}}}'
```

## Configure: Zone Redundancy

### Upgrade Plan (if needed)
```bash
# Check current SKU
az appservice plan show --name <plan> --resource-group <rg> --query "sku"

# Upgrade to Premium v3 (if currently on lower tier)
az appservice plan update \
  --name <plan> \
  --resource-group <rg> \
  --sku P1v3
```

### Enable Zone Redundancy
```bash
# Set min instances (required for ZR)
az appservice plan update \
  --name <plan> \
  --resource-group <rg> \
  --number-of-workers 2

# Enable ZR
az resource update \
  --resource-group <rg> \
  --name <plan> \
  --resource-type "Microsoft.Web/serverfarms" \
  --set properties.zoneRedundant=true
```

⚠️ Enabling zone redundancy may require scaling up first — for the supported App Service plans listed above, set the plan to at least 2 instances before enabling ZR.

## Configure: Health Check

```bash
# Enable health check
az webapp config set \
  --name <app> \
  --resource-group <rg> \
  --generic-configurations '{"healthCheckPath": "/api/health"}'
```

⚠️ **Warning:** Enabling health check causes an app restart. Configure during maintenance window.

### Health Check Behavior
- Ping interval: **1 minute**
- Failure threshold: **10 consecutive failures** (configurable via `WEBSITE_HEALTHCHECK_MAXPINGFAILURES`)
- After threshold: instance marked unhealthy, replaced within **1 hour**
- Healthy threshold: **1 successful response** restores instance

### Recommended: Always On
```bash
az webapp config set \
  --name <app> \
  --resource-group <rg> \
  --always-on true
```

## Configure: Disable Client Affinity (ARR Affinity)

App Service enables ARR affinity by default, which pins each client to a single instance via the `ARRAffinity` cookie. **This defeats zone-load-balancing and any multi-region routing**, so it should be disabled for stateless apps:

```bash
az webapp update --name <app> --resource-group <rg> \
  --client-affinity-enabled false
```

Leave it on **only** if your app stores state in instance memory and you cannot move it to a shared cache / database.

## Configure: Deployment Slots (Zero-Downtime)

Deployment slots complement reliability by enabling safe deployments:

```bash
# Create staging slot
az webapp deployment slot create \
  --name <app> \
  --resource-group <rg> \
  --slot staging

# Deploy to staging first, then swap
az webapp deployment slot swap \
  --name <app> \
  --resource-group <rg> \
  --slot staging \
  --target-slot production
```

## Back Up Support by SKU

| Plan | Automatic Backup | Custom Backup |
|------|----------------|---------------|
| Free/Shared (F1/D1) | ❌ Not supported | ❌ Not supported |
| Basic (B1/B2/B3) | ✅ | ✅ Configuration required  |
| Standard (S1/S2/S3) | ✅  | ✅  Configuration required  |
| Premium v2 (P1v2+) | ✅ | ✅  Configuration required  |
| Premium v3 (P0v3+) | ✅ | ✅  Configuration required  |
| Premium v4 (P0v4+) | ✅ | ✅  Configuration required  |
| Isolated v2 (I1v2+) | ✅ | ✅  Configuration required  |

- Automatic backups recommended since requires no configuration and is automatically enabled

## IaC Patching: Bicep

> **AVM modules:** If the project uses `br/public:avm/res/web/serverfarm` or `br/public:avm/res/web/site`, the parameter names differ from raw ARM (e.g. `zoneRedundant` and `skuCapacity` are top-level params; `siteConfig` is usually preserved). Always grep the actual module call (`Select-String -Path infra -Recurse -Pattern "avm/res/web/" -Context 0,15`) and patch the params already in use. The raw-Bicep examples below show the property paths to translate.

### App Service Plan
```bicep
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: {
    name: 'P0v3'
    capacity: 2              // ← ADD (min 2 for ZR on P1v3)
  }
  properties: {
    reserved: true           // Linux
    zoneRedundant: true      // ← ADD
  }
}
```

### Web App — Health Check
```bicep
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      healthCheckPath: '/api/health'  // ← ADD
      alwaysOn: true                  // ← ADD (recommended)
    }
  }
}
```

## IaC Patching: Terraform

### App Service Plan
```hcl
resource "azurerm_service_plan" "plan" {
  name                   = var.plan_name
  location               = azurerm_resource_group.rg.location
  resource_group_name    = azurerm_resource_group.rg.name
  os_type                = "Linux"
  sku_name               = "P1v3"
  worker_count           = 2                   # ← ADD (min 2 for ZR)
  zone_balancing_enabled = true                # ← ADD
}
```

### Web App — Health Check
```hcl
resource "azurerm_linux_web_app" "app" {
  name                = var.app_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.plan.id

  site_config {
    health_check_path = "/api/health"    # ← ADD
    always_on         = true             # ← ADD
  }
}
```

## Virtual Network Integration notes

- Subnet sizing is important.  VNet integration consumes IPs during scale-out slot swaps.  
- Undersized subnet cause scale or deployment failures during regional stress or failover.  Recommend /26 minimum, /24 for larger plans.  Zone Redundant plans require integration subnet to be sized for Zone Redundancy (more IPs).
- Subnets cannot be resized after assignment without reconfiguring VNET integration.
- Dependencies reached over private endpoints must have a per-region private endpoint and private DNS Zone.  Sharing a single or global private DNS zone linked to the primary VNET will break failover.
- Recommend Azure DNS Private Resolver per region, or per-region forwarders.  Verify WEBSITE_DNS_SERVER/WEBSITE_DNS_ALT_SERVER are set with a fallback.
- For predictable outbound traffic flow during failover, attach NAT Gateway to the subnet in each region to enable partner allow lists to work for all regions.  Use Nat Gateway to avoid SNAT port exhaustion under load.
- Service Endpoints vs Private Endpoints - Service endpoints are regional and don't failover.  Use Private Endpoints per region for resiliency. 

## Multi-Region Notes

- App Service supports deployment slots — use slot swap for safe regional deployments
- Consider auto-scale rules to handle failover traffic surge
- App Service Managed Certificates don't support custom domains on Front Door — use App Service Certificate or Key Vault
- Client affinity (ARR Affinity) must be disabled for multi-region (see Configure: Disable Client Affinity above)
- App Service Environment (v3) live in one subnet and is regional; multi-region still requires one ASE per region with Azure Front Door/Traffic Manager in front. 


## Reporting (for the assessment table)

When the parent skill builds the feature-pivoted assessment table, report each App Service resource on the relevant rows:

| Feature row | What to report |
|---|---|
| Zone redundancy — compute | `🟢 ON` if the **plan** has `zoneRedundant: true` AND `sku.capacity ≥ 2`. `🔴 OFF` if either is missing or the plan tier doesn't support ZR (Free / Shared / Basic / Standard). Annotate `(needs plan upgrade)` for unsupported tiers. |
| Health probes | `🟢 ON` if `siteConfig.healthCheckPath` is set on the **app**. `🔴 OFF` if empty. Basic tier and above support it; Free/Shared do not — annotate `(needs plan upgrade)` in that case. |
| Multi-region failover | `🟢 ON` if the same app is deployed in ≥2 regions behind Front Door / Traffic Manager. `🟡 PARTIAL` if multi-region is set up but `clientAffinityEnabled` is still `true` (sticky sessions break failover). `🔴 OFF` otherwise. |

