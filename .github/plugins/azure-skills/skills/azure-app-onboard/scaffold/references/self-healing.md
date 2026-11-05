# Self-Healing Loop — Error Classification & Auto-Fix

Step 11 runs validation against the generated IaC via CLI commands (`az bicep build` + `az deployment sub what-if`). On failure, classify each error and apply the strategy below. Max 3 attempts before pausing to present a diagnosis (explain pattern → propose fix → ask user). After user approves, 5 more attempts before asking again — then every 5 thereafter. See scaffold PHASE.md § Self-Healing Loop for the full escalation protocol.

| Error Type | Class | Auto-Fix Strategy |
|------------|-------|-------------------|
| Invalid property name | FIXABLE | Replace with correct property from schema summary |
| Syntax error (HCL/Bicep) | FIXABLE | Re-generate affected module from reference patterns |
| Missing required property | FIXABLE | Add with default value from MCP best practices |
| Wrong API version | FIXABLE | Update to version from schema result |
| Provider version conflict | FIXABLE | Update `required_providers` block |
| Undeclared variable | FIXABLE | Add declaration to `variables.tf` |
| Policy-blocked SKU | FIXABLE | Substitute with next-best from `rejectedAlternatives[]` |
| Circular dependency | FIXABLE | Refactor module references — break cycle |
| Permission/RBAC insufficient | BLOCKING | Surface required role + `az role assignment create` command |
| State backend inaccessible | BLOCKING | Surface `az storage account create` instructions |
| Region unsupported for resource | BLOCKING | Suggest alternate regions — requires user decision |
| Quota exhaustion (ALL tiers in ALL regions) | PLAN_LEVEL_CHANGE | ⛔ Service type pivot required — see scaffold PHASE.md § Self-Healing Loop. Update `prepare-plan.json` → present re-approval gate → regenerate IaC. Counts as 1 healing attempt |
| Quota exhaustion (single region) | PLAN_LEVEL_CHANGE | ⛔ Region pivot required — read `prepare-plan.json.quotaValidation.checkedRegions` and `failedResources` to skip already-failed regions. After checking new regions, append results back to these fields. See scaffold PHASE.md § Self-Healing Loop. Update plan region → present re-approval → regenerate IaC |
| Policy blocks planned service entirely | PLAN_LEVEL_CHANGE | ⛔ Alternative service required — see scaffold PHASE.md § Self-Healing Loop. Map to next-best from `rejectedAlternatives[]` → present re-approval → regenerate IaC |
