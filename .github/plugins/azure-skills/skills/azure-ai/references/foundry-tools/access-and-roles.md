# Document Intelligence and Content Understanding access and roles

For `401`/`403`, `PermissionDenied` or "works with a key, not with Entra ID" on
Document Intelligence (DI) or Content Understanding (CU) calls, Studio pages or
the Foundry portal CU page. Generic Foundry roles and agents: `microsoft-foundry`;
keyless code: [auth best practices](../auth-best-practices.md).

## Rules that explain most failures

1. **Data actions, not ownership.** DI needs `Microsoft.CognitiveServices/accounts/FormRecognizer/*`
   and CU `.../MultiModalIntelligence/*` data actions. Owner, Contributor,
   Foundry Account Owner, Cognitive Services Contributor and Azure AI
   Administrator have none; they can list keys, so calls work only with a key
   while local auth is enabled.
2. **Resource scope.** DI and CU authorize at the Foundry resource. Assignments
   inherit down (subscription → resource group → resource → project), never up:
   a role only on `.../accounts/<name>/projects/<project>` does not authorize DI
   or CU, so the Foundry sample "Foundry User on the project + Reader on the
   resource" cannot call them.
   A management-group assignment is reported as `unknown_management_group_ancestry`
   unless the export also proves that the group contains the target subscription.
3. **Least privilege** (resource scope or above):

| Need | Role |
|---|---|
| CU analyze only | Cognitive Services Content Understanding **Reader** (no analyzer create, no Delete Result) |
| CU Delete Result, CU Studio authoring/labeling | CU **Contributor** (cannot delete analyzers); CU **Owner** for deletes |
| DI analyze, train, DI Studio | **Cognitive Services User** |
| DI + CU + OpenAI from one identity | **Foundry User** |
| Not enough for DI/CU | Azure AI Developer, Cognitive Services OpenAI User/Contributor, Foundry Agent Consumer, Reader |

4. **Learn conflict:** the Foundry RBAC page says not to assign "Cognitive
   Services" roles for Foundry scenarios, while DI and CU docs name them. Both
   families carry the DI/CU data actions at resource scope.
5. **Auth mode.** Entra ID needs the custom subdomain endpoint and token scope
   `https://cognitiveservices.azure.com/.default`. A key used after
   `disableLocalAuth` returns `401` ("invalid subscription key or wrong API
   endpoint"). Learn disagrees on `401` vs `403` for a missing role, so branch
   on `error.code`. New assignments take minutes; get a new token.

## Workflow

1. Confirm the caller (user, group, service principal or managed identity) and
   the resource. Never request or print keys.
2. Export read-only data:

| Data | Azure MCP (if enabled) | Without MCP |
|---|---|---|
| Assignments | role assignment list per scope (subscription, resource group, resource, project; excludes inherited) | `az role assignment list --all --include-inherited --include-groups --assignee <caller> -o json > assignments.json` or `Get-AzRoleAssignment -ObjectId <id> -ExpandPrincipalGroups \| ConvertTo-Json -Depth 5` |
| Role definitions | none | `az role definition list -o json > definitions.json` or `Get-AzRoleDefinition \| ConvertTo-Json -Depth 5` |
| Account | `foundryextensions_resource_get` (no auth/network fields) | `az cognitiveservices account show -n <name> -g <rg> -o json > account.json` or `(Invoke-AzRestMethod -Method GET -Path "<resource-id>?api-version=2024-10-01").Content` |

3. Run the [offline checker](../../scripts/check-foundry-tools-access.mjs)
   ([Bash](../../scripts/check-foundry-tools-access.sh) / [PowerShell](../../scripts/check-foundry-tools-access.ps1)
   launchers exit `3` without Node.js 22+; then use [manual checks](without-node.md)).
   It prints role names and scope types only:

   ```bash
   node "<skill-directory>/scripts/check-foundry-tools-access.mjs" --assignments assignments.json --definitions definitions.json --account account.json
   ```

   ```powershell
   & node "<skill-directory>\scripts\check-foundry-tools-access.mjs" --assignments assignments.json --definitions definitions.json --account account.json
   ```

   Launcher exit codes are `0` report/help, `1` file/read/JSON error, `2`
   usage error and `3` Node.js 22+ unavailable. The checker reads UTF-8,
   UTF-8-with-BOM and UTF-16 PowerShell 5.1 exports.

   `--operation cu-analyze,cu-delete-result,di-build` narrows it. Verdicts:
   `allowed`, `blocked_project_scope_only`, `blocked_no_data_action`,
   `blocked_not_assigned`, `unknown_definitions_missing`.
4. Propose the fix as a plan; only after confirmation run
   `az role assignment create --role <role-definition-id> --scope <resource-id>`
   (IDs survive the Foundry role rename).

## Evidence boundary

Offline evaluation ignores deny assignments, conditions, PIM eligibility and
propagation delay. `allowed` plus a `403` usually means a network rule: see
[private networking](private-network.md).

Sources (retrieved 2026-11-18): [Foundry RBAC](https://learn.microsoft.com/azure/foundry/concepts/rbac-foundry) ·
[Capability and access planning](https://learn.microsoft.com/azure/foundry/concepts/planning#identify-capability-and-access-requirements) ·
[Account-scope capabilities](https://learn.microsoft.com/azure/foundry/agents/concepts/hosted-agent-permissions#agent-access-beyond-defaults) ·
[CU roles](https://learn.microsoft.com/azure/ai-services/content-understanding/concepts/secure-communications#managed-identities) ·
[DI Studio roles](https://learn.microsoft.com/azure/ai-services/document-intelligence/quickstarts/studio-custom-project?view=doc-intel-4.0.0#azure-role-assignments) ·
[Authentication](https://learn.microsoft.com/azure/ai-services/authentication) ·
[Disable local auth](https://learn.microsoft.com/azure/ai-services/disable-local-auth) ·
[Built-in roles](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/ai-machine-learning)
