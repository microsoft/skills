# Configure Zone Redundancy — Platform Notes

## Storage redundancy is part of the same fix — discover it now, migrate it later

Zone-redundant compute backed by LRS/GRS storage still suffers downtime in a zone failure, so the storage SKU **must** be assessed alongside compute. However, do **not** block the compute fix on a storage migration — they happen in separate steps.

**Required order (matches the parent skill's [Configuration Workflow](../SKILL.md#configuration-workflow)):**

1. **Discover** the current storage SKU during assessment (Phase 2) so the user sees both gaps in one checklist. Use [storage-redundancy-checks.md](storage-redundancy-checks.md).
2. **Enable compute ZR first** — fast, in-place property update, no downtime. This is the quick win and runs without any storage prerequisite.
3. **Verify** compute is `zoneRedundant: true`.
4. **Then ask the user** before starting the storage migration (hours-to-days, small cost increase). Commands live in [configure-storage.md](configure-storage.md).

## Per-service configuration commands

The `az` CLI commands, plan-upgrade paths, blue/green migration steps, and verification commands all live in the per-service references because the syntax differs per service:

| Service | Reference |
|---|---|
| Azure App Service (P1v2+, P0v3+, P0v4+, ASEv3) | [services/app-service/reliability.md](services/app-service/reliability.md) |
| Azure Functions (FC1, EP1–EP3) | [services/functions/reliability.md](services/functions/reliability.md) |

## Verification

After enabling zone redundancy on any compute resource, confirm with:

```bash
az graph query -q "
Resources
| where resourceGroup =~ '<rg>'
| where type =~ 'microsoft.web/serverfarms' or type =~ 'microsoft.app/managedenvironments'
| extend zoneRedundant = tobool(properties.zoneRedundant)
| project name, type, zoneRedundant
" --query "data[]" -o json
```

All patched resources should show `zoneRedundant = true`.

