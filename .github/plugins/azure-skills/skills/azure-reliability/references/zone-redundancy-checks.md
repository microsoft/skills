# Zone Redundancy — Platform Overview

## Overview

Zone redundancy distributes compute instances across availability zones within a region. If one zone fails, instances in other zones continue serving traffic automatically.

This file covers **platform-level discovery and concepts**. For service-specific assessment queries, configuration commands, and IaC patches, see:

| Service | Reference |
|---|---|
| Azure App Service | [services/app-service/reliability.md](services/app-service/reliability.md) |
| Azure Functions | [services/functions/reliability.md](services/functions/reliability.md) |

> Azure Container Apps deep-dive references are planned for a future version of this skill. The discovery query below still surfaces those resources — just don't dispatch to a per-service reference for them yet.

## Discovery: Find All Non-Zone-Redundant Compute

> **⚠️ Output format:** Use `--query "data[]" -o json` for `az graph query`. `-o table` only renders summary columns (`Count`, `Total_records`) and hides projected fields. Pipe JSON through `jq` if you need a table view.

Use this single query to discover every compute resource in scope that is **not** zone-redundant. Use it during Phase 1 (Discover Resources) to decide which service references to load.

```bash
az graph query -q "
Resources
| where type in~ ('microsoft.web/serverfarms', 'microsoft.app/managedenvironments')
| extend zoneRedundant = tobool(properties.zoneRedundant)
| where zoneRedundant == false or isnull(zoneRedundant)
| project name, type, resourceGroup, location, sku=sku.name
| order by type asc
" --query "data[]" -o json
```

For each row in the result, dispatch to the matching service reference:
- `microsoft.web/serverfarms` with `kind contains 'functionapp'` → Functions reference
- `microsoft.web/serverfarms` (other kinds) → App Service reference
- `microsoft.app/managedenvironments` → _planned (Container Apps)_ — surface in the discovery summary, do not deep-dive

## Regions Supporting Availability Zones

```bash
az functionapp list-flexconsumption-locations --zone-redundant=true
```

Common regions with AZ support across Functions, App Service, and Container Apps:

- East US, East US 2, West US 2, West US 3
- Central US, South Central US
- North Europe, West Europe, UK South
- France Central, Germany West Central, Sweden Central
- Southeast Asia, Japan East, Australia East

> **Service-specific region availability differs.** Always confirm support for the specific SKU/plan in the target region using the per-service reference.

## Reporting

For the assessment table's `Zone redundancy — compute` row, the per-service references define exactly what `🟢 ON / 🟡 PARTIAL / 🔴 OFF` mean for that service (e.g. ZR + minimum instance count for App Service, Premium Functions). Only App Service and Functions have a per-service reference in this skill version; Container Apps support is planned.
