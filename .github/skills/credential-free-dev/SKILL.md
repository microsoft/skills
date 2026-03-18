---
name: credential-free-dev
description: |
  Eliminate secrets and credentials from Azure applications using managed identities,
  workload identity federation, and the Azure Identity SDK. Covers migration patterns
  from connection strings and keys to credential-free authentication across Azure services.
  Triggers: "credential-free", "managed identity", "workload identity federation",
  "remove secrets", "connection string to managed identity", "DefaultAzureCredential",
  "ManagedIdentityCredential", "passwordless", "keyless authentication", "eliminate keys".
---

# Azure Credential-Free Development

Eliminate secrets and credentials from Azure applications using managed identities, workload identity federation, and the Azure Identity SDK.

## Before Implementation

Search `microsoft-docs` MCP for current patterns:
- Query: "credential-free development Azure managed identity"
- Query: "ManagedIdentityCredential [target service] [language]"
- Verify: RBAC role names match current documentation

## Core Principles

1. **No secrets in code, config, or environment variables.** Use managed identities for Azure-hosted workloads. Use workload identity federation for non-Azure or CI/CD workloads.
2. **ManagedIdentityCredential for production. DefaultAzureCredential for local dev only.** In production, use `ManagedIdentityCredential` explicitly — `DefaultAzureCredential`'s credential chain probing can cause subtle failures, latency, and silent fallback to unintended credentials. `DefaultAzureCredential` remains convenient for local development (falls through to Azure CLI / VS credentials).
3. **System-assigned managed identity** for single-purpose resources. **User-assigned managed identity** when multiple resources share a credential or when you need pre-provisioned RBAC.
4. **Connection strings with keys are legacy.** Every Azure service that supports Entra auth should use it. If a service requires a key, treat it as a gap to escalate, not a pattern to accept.
5. **Least privilege always.** Grant the narrowest RBAC role that works. `Storage Blob Data Reader`, not `Storage Account Key Operator`. `db_datareader`, not `db_owner`.

## When to Use Each Credential Type

| Scenario | Use This | Why |
|---|---|---|
| App on Azure (App Service, Container Apps, Functions, VMs, AKS) | **ManagedIdentityCredential** (system or user-assigned) | Zero secrets, platform-managed rotation, Entra RBAC. Use explicit credential, not DefaultAzureCredential. |
| CI/CD pipeline (GitHub Actions, Azure DevOps) | **Workload Identity Federation** | No secrets stored. OIDC token exchange with Entra. |
| App on AWS/GCP calling Azure | **Workload Identity Federation** | Cross-cloud trust without shared secrets |
| Local development | **DefaultAzureCredential** | Developer's own identity via CLI/VS fallback, no shared dev secrets |
| Service-to-service (no Azure hosting) | **App registration + certificate** | When MI/WIF aren't possible. Certificates over secrets. |
| Legacy app that can't change auth code | **Key Vault references** (stepping stone) | Secrets in Key Vault, not in config. Not the end state. |

## Production Authentication: ManagedIdentityCredential

> **Do not use `DefaultAzureCredential` in production.** Its credential chain probing
> can cause subtle issues or silent failures. Replace it with a specific
> `TokenCredential` implementation such as `ManagedIdentityCredential`.
> — [Authentication best practices with the Azure Identity library](https://learn.microsoft.com/dotnet/azure/sdk/authentication/best-practices)

Use `ManagedIdentityCredential` directly for Azure-hosted workloads. For user-assigned
managed identities, pass the `client_id` explicitly.

## DefaultAzureCredential (Local Development Only)

`DefaultAzureCredential` is convenient for local development because it automatically
falls through to developer credentials (Azure CLI, VS, etc.). **Do not use in production.**

### Credential Chain (in order)

1. Environment variables (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`)
2. Workload Identity (Kubernetes, federated token)
3. Managed Identity (system-assigned, then user-assigned)
4. Azure CLI (`az login`)
5. Azure PowerShell (`Connect-AzAccount`)
6. Azure Developer CLI (`azd auth login`)
7. Interactive browser (if enabled)

Locally, steps 4-6 fire using your developer identity. In production this chain
introduces latency and unpredictable fallback — use `ManagedIdentityCredential` instead.

### SDK Packages

| Language | Package | Install |
|----------|---------|---------|
| Python | `azure-identity` | `pip install azure-identity` |
| .NET | `Azure.Identity` | `dotnet add package Azure.Identity` |
| Java | `azure-identity` | Maven: `com.azure:azure-identity` |
| TypeScript | `@azure/identity` | `npm install @azure/identity` |
| Go | `azidentity` | `go get github.com/Azure/azure-sdk-for-go/sdk/azidentity` |

### Production Pattern (All Languages)

```python
# Python — production
from azure.identity import ManagedIdentityCredential
credential = ManagedIdentityCredential()  # system-assigned
# credential = ManagedIdentityCredential(client_id="<user-assigned-mi-client-id>")  # user-assigned
client = ServiceClient(endpoint, credential=credential)
```

```csharp
// C# — production
var credential = new ManagedIdentityCredential();  // system-assigned
// var credential = new ManagedIdentityCredential("<user-assigned-mi-client-id>");  // user-assigned
var client = new ServiceClient(new Uri(endpoint), credential);
```

```java
// Java — production
TokenCredential credential = new ManagedIdentityCredentialBuilder().build();  // system-assigned
// TokenCredential credential = new ManagedIdentityCredentialBuilder()
//     .clientId("<user-assigned-mi-client-id>").build();  // user-assigned
ServiceClient client = new ServiceClientBuilder()
    .endpoint(endpoint)
    .credential(credential)
    .buildClient();
```

```typescript
// TypeScript — production
import { ManagedIdentityCredential } from "@azure/identity";
const credential = new ManagedIdentityCredential();  // system-assigned
// const credential = new ManagedIdentityCredential("<user-assigned-mi-client-id>");  // user-assigned
const client = new ServiceClient(endpoint, credential);
```

### Local Development Pattern

```python
# Python — local dev only
from azure.identity import DefaultAzureCredential
credential = DefaultAzureCredential()
client = ServiceClient(endpoint, credential=credential)
```

## Migration Pattern: Keys to Credential-Free

Every migration follows the same 4 steps:

1. **Enable managed identity** on your compute resource
2. **Assign the right RBAC role** on the target resource
3. **Replace** connection string / key with endpoint URL + `ManagedIdentityCredential` (production) or `DefaultAzureCredential` (local dev)
4. **Remove** the key/secret from all config

### Quick Reference: Service RBAC Roles

| Service | Read Role | Write Role |
|---------|-----------|------------|
| Azure Storage (Blob) | `Storage Blob Data Reader` | `Storage Blob Data Contributor` |
| Azure SQL Database | `db_datareader` (SQL role) | `db_datawriter` (SQL role) |
| Azure Cosmos DB | `Cosmos DB Built-in Data Reader` | `Cosmos DB Built-in Data Contributor` |
| Azure Service Bus | `Azure Service Bus Data Receiver` | `Azure Service Bus Data Sender` |
| Azure Event Hubs | `Azure Event Hubs Data Receiver` | `Azure Event Hubs Data Sender` |
| Azure Key Vault | `Key Vault Secrets User` | `Key Vault Secrets Officer` |
| Azure App Configuration | `App Configuration Data Reader` | `App Configuration Data Owner` |

> **Detailed migration code for each service:** See [references/migration-patterns.md](references/migration-patterns.md)

## Workload Identity Federation (CI/CD and Cross-Cloud)

When managed identity isn't available (GitHub Actions, external clouds, on-prem):

1. Create an app registration in Entra
2. Add a federated identity credential (OIDC issuer + subject)
3. External workload exchanges its native token for an Entra access token
4. No secrets stored, rotated, or transmitted

### GitHub Actions Example

```yaml
- uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

No `AZURE_CLIENT_SECRET` needed. The GitHub OIDC token is exchanged directly.

## Common Pitfalls

1. **Forgetting RBAC roles.** Enabling MI is step 1. Assigning the right role on the target resource is step 2. Most "MI doesn't work" issues are missing role assignments.
2. **Overly broad roles.** `Contributor` on a resource group when you need `Storage Blob Data Reader` on one account.
3. **Not testing locally.** `DefaultAzureCredential` falls through to Azure CLI. Make sure `az login` is done with the right subscription.
4. **Using `DefaultAzureCredential` in production.** Its credential chain probing adds latency, can fall back to unintended credentials, and masks configuration errors. Use `ManagedIdentityCredential` explicitly for Azure-hosted production apps.
5. **Mixing key and MI auth.** Some SDKs behave differently when both a connection string and a credential are provided. Pick one.
6. **Assuming all services support MI.** Most do. Some legacy or partner services don't yet. Check the [services that support managed identities](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/managed-identities-status) list.
7. **Not handling token refresh.** `ManagedIdentityCredential` handles refresh automatically. If caching tokens manually, respect expiry.
8. **System-assigned when user-assigned is better.** Multiple resources needing same permissions = user-assigned MI to avoid duplicating RBAC assignments.

## Reference Files

| File | Contents |
|------|----------|
| [references/migration-patterns.md](references/migration-patterns.md) | Detailed before/after code for SQL, Storage, Cosmos DB, Service Bus, Event Hubs, Key Vault |
