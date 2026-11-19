# Studio and Blob Storage access for Document Intelligence and Content Understanding

For Document Intelligence (DI) Studio or Content Understanding (CU) Studio
projects that cannot open, list or label files, training or analysis that
cannot read a Blob source (`ContentSourceNotAccessible`, `403`), or questions
about who can see Studio projects. Caller roles on the DI/CU resource are in
[access and roles](access-and-roles.md).

## Which identity touches the Blob container

| Scenario | Identity that reads/writes Blob | Needs |
|---|---|---|
| DI Studio custom project (list, label, auto label) | **Signed-in user**, from the browser | Storage Blob Data Contributor on the storage account; Blob CORS rule (below); Cognitive Services User on the DI resource; Reader to open Studio |
| DI build or analyze from a Blob URL with managed identity | DI resource **system-assigned** managed identity | Storage Blob Data Reader; Contributor when Studio uses a network-restricted account for auto label, human-in-the-loop or project sharing |
| DI from a Blob URL with SAS | The SAS | Read (and list for training) permission, valid expiry; never paste the SAS |
| CU Studio project samples and labels | **Managed identity** behind the Foundry storage connection, not the user | Storage Blob Data Contributor (Learn's guide assigns it to the Foundry project managed identity) |
| CU `analyze` with a URL | CU service fetches the URL | The URL "must be accessible to the Content Understanding resource"; for private storage send bytes with `analyzeBinary` instead |

Consequences:

- Contributor or Storage Account Contributor can list keys but cannot use DI
  Studio when key access is disabled on the DI resource or the storage account.
- Storage permissions on users do not isolate CU Studio projects: anyone with a
  CU write role on the resource sees that resource's projects and analyzers. CU
  has no project-level RBAC isolation; use separate Foundry resources (or a
  backend that calls CU with its own identity) when teams must not see each
  other's projects.

## DI Studio checks

- CORS on the Blob service: allowed origin `https://documentintelligence.ai.azure.com`,
  all 8 methods, allowed/exposed headers `*`, max age `120` (setting CORS needs
  Storage Account Contributor).
- Studio errors: `PermissionDenied` → role on the DI resource (local auth is
  likely disabled); `AuthorizationPermissionMismatch` → Blob data role for the
  user; `Form Recognizer Not Found` → the project's resource was deleted or
  moved; `AADSTS50058` → the browser blocks third-party cookies.
- Behind a storage firewall: enable the DI managed identity, grant the Blob
  role, allow trusted services or a resource instance rule, and for Studio auto
  label add the Studio IP `20.3.165.95` (documented by Learn) to the DI and
  storage firewalls, or add your client IP.

## Blob error codes

| Code | Usually means |
|---|---|
| `AuthorizationPermissionMismatch` | The identity lacks the Blob data role, or the SAS lacks the permission |
| `AuthorizationFailure` | Network: public network access disabled, IP or virtual network rules |
| `AuthenticationFailed` | Bad SAS signature/key or clock skew |

Learn conflict: one Storage page says `Disabled` public network access accepts
only private endpoint traffic; another says resource instance rules and
exceptions configured earlier remain in effect. Test the actual path instead
of assuming either.

## Read-only checks

| Data | Azure MCP (if enabled) | Without MCP |
|---|---|---|
| Storage network | `storage_account_get` (network/CORS fields may be absent) | `az storage account show -n <st> -g <rg> --query "{publicNetworkAccess:publicNetworkAccess, defaultAction:networkRuleSet.defaultAction, bypass:networkRuleSet.bypass, allowSharedKeyAccess:allowSharedKeyAccess}"` |
| CORS | none | `az storage account blob-service-properties show --account-name <st> -g <rg> --query "cors.corsRules[].{origins:allowedOrigins, methods:allowedMethods}"` |
| Roles on storage | role assignment list at the storage scope | `az role assignment list --scope <storage-id> --assignee <principal> --include-inherited --query "[].roleDefinitionName"` |
| DI/CU identity | `foundryextensions_resource_get` | `az cognitiveservices account show -n <name> -g <rg> --query "identity.type"` |

Propose role, CORS or firewall changes as a plan and apply them only after the
user confirms. Role changes can take up to 30 minutes to apply.

Sources (retrieved 2026-11-18): [DI Studio custom projects](https://learn.microsoft.com/azure/ai-services/document-intelligence/quickstarts/studio-custom-project?view=doc-intel-4.0.0) ·
[DI Studio troubleshooting](https://learn.microsoft.com/azure/ai-services/document-intelligence/quickstarts/get-started-studio?view=doc-intel-4.0.0#troubleshooting) ·
[DI managed identities](https://learn.microsoft.com/azure/ai-services/document-intelligence/authentication/managed-identities?view=doc-intel-4.0.0) ·
[DI secured access](https://learn.microsoft.com/azure/ai-services/document-intelligence/authentication/managed-identities-secured-access?view=doc-intel-4.0.0) ·
[Foundry: connect your own storage](https://learn.microsoft.com/azure/foundry/how-to/bring-your-own-azure-storage-foundry) ·
[Foundry planning](https://learn.microsoft.com/azure/foundry/concepts/planning#identify-capability-and-access-requirements) ·
[Storage 403 errors](https://learn.microsoft.com/troubleshoot/azure/azure-storage/blobs/authentication/storage-troubleshoot-403-errors)
