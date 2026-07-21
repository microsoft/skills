---
name: azure-identity-py
description: |
  Azure Identity SDK for Python authentication with Microsoft Entra ID. Use for DefaultAzureCredential, managed identity, service principals, and token caching.
  Triggers: "azure-identity", "DefaultAzureCredential", "authentication", "managed identity", "service principal", "credential".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-identity
---

# Azure Identity library for Python

Authentication library for Azure SDK clients using Microsoft Entra ID.

Use this skill when:
- An app needs to authenticate to Azure services from Python
- You need `DefaultAzureCredential` for local dev + Azure deployment
- You need `ManagedIdentityCredential` for Azure-hosted workloads
- You need service principal auth with secret or certificate
- You need direct token acquisition with `get_token()`
- You need to troubleshoot credential chain failures

## Installation

```bash
pip install azure-identity
```

For VS Code or broker-based desktop auth:

```bash
pip install azure-identity-broker
```

## Python Version

`azure-identity` supports Python 3.9+.

## Environment Variables

```bash
# Service principal with client secret
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<your-client-id>
AZURE_CLIENT_SECRET=<your-client-secret>

# Service principal with certificate
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<your-client-id>
AZURE_CLIENT_CERTIFICATE_PATH=/path/to/cert.pem
AZURE_CLIENT_CERTIFICATE_PASSWORD=<optional-password>

# Authority (sovereign clouds)
AZURE_AUTHORITY_HOST=login.microsoftonline.com  # Default; or login.chinacloudapi.cn, login.microsoftonline.us

# User-assigned managed identity
AZURE_CLIENT_ID=<managed-identity-client-id>

# Credential selection (new)
AZURE_TOKEN_CREDENTIALS=dev|prod|<credential-name>  # Optional, restricts DAC chain
```

## Authentication & Lifecycle

> **🔑 Two rules apply to every code sample below:**
>
> 1. **Prefer `DefaultAzureCredential`.** It works locally (Azure CLI / VS Code / Developer CLI) and in Azure (managed identity, workload identity) with no code change. Avoid connection strings, account/API keys — they bypass Entra audit and rotation.
>    - Local dev: `DefaultAzureCredential` works as-is.
>    - Production: set `AZURE_TOKEN_CREDENTIALS=prod` (or `AZURE_TOKEN_CREDENTIALS=<specific_credential>`) to constrain the credential chain to production-safe credentials.
> 2. **Wrap credentials and clients in context managers** when they own token caches / transports:
>    - Sync: `with DefaultAzureCredential() as credential:`
>    - Async: `async with DefaultAzureCredential() as credential:` (from `azure.identity.aio`)
>
> Snippets may abbreviate this setup, but production code should always follow both rules.

### DefaultAzureCredential

The recommended credential for most scenarios. Tries multiple authentication methods in order:

```python
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

# Works in local dev AND production without code changes
credential = DefaultAzureCredential()

with BlobServiceClient(
    account_url="https://<account>.blob.core.windows.net",
    credential=credential
) as client:
    containers = list(client.list_containers())
```

### Credential Chain Order

See [DefaultAzureCredential overview](https://aka.ms/azsdk/python/identity/credential-chains#defaultazurecredential-overview) for the current credential chain order and defaults.

### Customizing DefaultAzureCredential

```python
# Exclude credentials you don't need
credential = DefaultAzureCredential(
    exclude_environment_credential=True,
    exclude_shared_token_cache_credential=True,
    managed_identity_client_id="<user-assigned-mi-client-id>"  # For user-assigned MI (also accepts object ID or resource ID)
)

# Enable interactive browser (disabled by default)
credential = DefaultAzureCredential(
    exclude_interactive_browser_credential=False
)

# Set subprocess timeout for CLI-based credentials (default: 10s)
credential = DefaultAzureCredential(process_timeout=30)

# Require AZURE_TOKEN_CREDENTIALS env var to be set
credential = DefaultAzureCredential(require_envvar=True)
```

### Exclude Parameters

| Parameter | Default | Effect |
|-----------|---------|--------|
| `exclude_environment_credential` | False | Skip env-var-based auth |
| `exclude_workload_identity_credential` | False | Skip Kubernetes workload identity |
| `exclude_managed_identity_credential` | False | Skip managed identity |
| `exclude_shared_token_cache_credential` | False | Skip shared token cache |
| `exclude_visual_studio_code_credential` | False | Skip VS Code credential |
| `exclude_cli_credential` | False | Skip Azure CLI |
| `exclude_powershell_credential` | False | Skip Azure PowerShell |
| `exclude_developer_cli_credential` | False | Skip Azure Developer CLI |
| `exclude_interactive_browser_credential` | **True** | Skip interactive browser |
| `exclude_broker_credential` | False | Skip WAM broker |

## get_bearer_token_provider

Helper that wraps a credential into a callable returning a bearer token string. Essential for OpenAI SDK and other non-Azure-SDK clients:

```python
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

credential = DefaultAzureCredential()
token_provider = get_bearer_token_provider(
    credential, "https://cognitiveservices.azure.com/.default"
)

# Use with OpenAI SDK
from openai import AzureOpenAI

with AzureOpenAI(
    azure_endpoint="https://<resource>.openai.azure.com/",
    azure_ad_token_provider=token_provider,
    api_version="2024-10-21",
) as client:
    # response = client.chat.completions.create(...)
    ...
```

## Credential Types

### Credential Chains

| Credential | Use Case |
|------------|----------|
| `DefaultAzureCredential` | Most scenarios — auto-detects environment |
| `ChainedTokenCredential` | Custom credential chain with explicit ordering |

### Azure-Hosted Applications

| Credential | Use Case |
|------------|----------|
| `EnvironmentCredential` | Auth via AZURE_CLIENT_SECRET / AZURE_CLIENT_CERTIFICATE_PATH env vars |
| `ManagedIdentityCredential` | Azure VMs, App Service, Functions, AKS, Arc, Service Fabric |
| `WorkloadIdentityCredential` | Kubernetes with Microsoft Entra Workload ID |

### Service Principals

| Credential | Use Case |
|------------|----------|
| `ClientSecretCredential` | Service principal with client secret |
| `CertificateCredential` | Service principal with PEM/PKCS12 certificate |
| `ClientAssertionCredential` | Service principal with signed JWT assertion |
| `AzurePipelinesCredential` | Azure Pipelines with workload identity federation |
| `OnBehalfOfCredential` | Middle-tier on-behalf-of flow (delegated user identity) |

### User Authentication

| Credential | Use Case |
|------------|----------|
| `InteractiveBrowserCredential` | Interactive browser OAuth sign-in |
| `DeviceCodeCredential` | Headless/SSH device code flow |
| `AuthorizationCodeCredential` | Previously obtained authorization code |

### Developer Tools

| Credential | Use Case |
|------------|----------|
| `AzureCliCredential` | `az login` |
| `AzureDeveloperCliCredential` | `azd auth login` |
| `AzurePowerShellCredential` | `Connect-AzAccount` |
| `VisualStudioCodeCredential` | VS Code Azure Resources extension |

## Specific Credential Examples

### ManagedIdentityCredential

For Azure-hosted resources (VMs, App Service, Functions, AKS):

```python
from azure.identity import ManagedIdentityCredential

# System-assigned managed identity
credential = ManagedIdentityCredential()

# User-assigned managed identity (client_id, object_id, or resource_id)
credential = ManagedIdentityCredential(
    client_id="<user-assigned-mi-client-id>"
)
# Also valid:
# credential = ManagedIdentityCredential(object_id="<object-id>")
# credential = ManagedIdentityCredential(resource_id="<resource-id>")
```

### ClientSecretCredential

```python
import os
from azure.identity import ClientSecretCredential

credential = ClientSecretCredential(
    tenant_id=os.environ["AZURE_TENANT_ID"],
    client_id=os.environ["AZURE_CLIENT_ID"],
    client_secret=os.environ["AZURE_CLIENT_SECRET"],
)
```

### CertificateCredential

> **Note:** The class is `CertificateCredential`, NOT `ClientCertificateCredential`.

```python
from azure.identity import CertificateCredential

# From file path
credential = CertificateCredential(
    tenant_id="<tenant-id>",
    client_id="<client-id>",
    certificate_path="/path/to/cert.pem",
)

# From bytes with password
credential = CertificateCredential(
    tenant_id="<tenant-id>",
    client_id="<client-id>",
    certificate_data=cert_bytes,
    password="<cert-password>",
    send_certificate_chain=True,  # Required for SNI auth
)
```

### AzureCliCredential

```python
from azure.identity import AzureCliCredential

credential = AzureCliCredential()
# With tenant restriction
credential = AzureCliCredential(tenant_id="<tenant-id>")
```

### ChainedTokenCredential

Custom credential chain:

```python
from azure.identity import (
    ChainedTokenCredential,
    ManagedIdentityCredential,
    AzureCliCredential,
)

# Try managed identity first, fall back to CLI
credential = ChainedTokenCredential(
    ManagedIdentityCredential(client_id="<user-assigned-mi-client-id>"),
    AzureCliCredential(),
)
```

### WorkloadIdentityCredential

For Azure Kubernetes Service with workload identity:

```python
from azure.identity import WorkloadIdentityCredential

# Reads from AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_FEDERATED_TOKEN_FILE
credential = WorkloadIdentityCredential()

# Or explicit configuration
credential = WorkloadIdentityCredential(
    tenant_id="<tenant-id>",
    client_id="<client-id>",
    token_file_path="/var/run/secrets/azure/tokens/azure-identity-token",
)
```

### DeviceCodeCredential

For headless devices (IoT, SSH, CLI tools):

```python
from azure.identity import DeviceCodeCredential

credential = DeviceCodeCredential()
# Prints device code prompt to stdout by default

# With custom prompt callback
def prompt_callback(verification_uri, user_code, expires_on):
    print(f"Go to {verification_uri} and enter code {user_code}")

credential = DeviceCodeCredential(
    client_id="<client-id>",
    prompt_callback=prompt_callback,
)
```

### InteractiveBrowserCredential

For interactive OAuth browser sign-in:

```python
from azure.identity import InteractiveBrowserCredential

credential = InteractiveBrowserCredential()

# With specific tenant and client
credential = InteractiveBrowserCredential(
    tenant_id="<tenant-id>",
    client_id="<client-id>",
)
```

### OnBehalfOfCredential

For middle-tier services propagating user identity:

```python
from azure.identity import OnBehalfOfCredential

credential = OnBehalfOfCredential(
    tenant_id="<tenant-id>",
    client_id="<client-id>",
    client_secret="<client-secret>",
    user_assertion="<access-token-from-client>",
)
```

### AzurePipelinesCredential

For Azure DevOps pipelines with workload identity federation:

```python
import os
from azure.identity import AzurePipelinesCredential

credential = AzurePipelinesCredential(
    tenant_id="<tenant-id>",
    client_id="<client-id>",
    service_connection_id="<service-connection-id>",
    system_access_token=os.environ["SYSTEM_ACCESSTOKEN"],
)
```

## Getting Tokens Directly

```python
from azure.identity import DefaultAzureCredential

with DefaultAzureCredential() as credential:
    # Get token for a specific scope
    token = credential.get_token("https://management.azure.com/.default")
    print(f"Token expires: {token.expires_on}")

    # For Azure Database for PostgreSQL
    token = credential.get_token("https://ossrdbms-aad.database.windows.net/.default")
```

## Async Credentials

Async credentials are in `azure.identity.aio`. Always close them or use `async with`:

```python
from azure.identity.aio import DefaultAzureCredential
from azure.storage.blob.aio import BlobServiceClient

async def main():
    # Preferred: use async context manager for both credential and client
    async with DefaultAzureCredential() as credential:
        async with BlobServiceClient(
            account_url="https://<account>.blob.core.windows.net",
            credential=credential,
        ) as client:
            # ... async operations
            pass
```

> The async `get_bearer_token_provider` is at `azure.identity.aio.get_bearer_token_provider`.

## Sovereign Clouds

Use `AzureAuthorityHosts` or the `AZURE_AUTHORITY_HOST` env var:

```python
from azure.identity import DefaultAzureCredential, AzureAuthorityHosts

# Azure Government
credential = DefaultAzureCredential(authority=AzureAuthorityHosts.AZURE_GOVERNMENT)

# Azure China
credential = DefaultAzureCredential(authority=AzureAuthorityHosts.AZURE_CHINA)
```

| Constant | Authority |
|----------|-----------|
| `AzureAuthorityHosts.AZURE_PUBLIC_CLOUD` | `login.microsoftonline.com` (default) |
| `AzureAuthorityHosts.AZURE_GOVERNMENT` | `login.microsoftonline.us` |
| `AzureAuthorityHosts.AZURE_CHINA` | `login.chinacloudapi.cn` |

## Persistent Token Caching

Opt-in disk-based caching with `TokenCachePersistenceOptions`:

```python
from azure.identity import DefaultAzureCredential, TokenCachePersistenceOptions

credential = DefaultAzureCredential(
    cache_persistence_options=TokenCachePersistenceOptions()
)

# Allow unencrypted fallback (NOT recommended for production)
credential = DefaultAzureCredential(
    cache_persistence_options=TokenCachePersistenceOptions(allow_unencrypted_storage=True)
)
```

Storage: Windows (DPAPI), macOS (Keychain), Linux (Keyring).

## Multi-Tenant Support

Allow token acquisition for additional tenants beyond the configured one:

```python
from azure.identity import ClientSecretCredential

credential = ClientSecretCredential(
    tenant_id="<home-tenant>",
    client_id="<client-id>",
    client_secret="<secret>",
    additionally_allowed_tenants=["<other-tenant>", "*"],  # "*" allows any tenant
)
```

## Error Handling

```python
from azure.identity import DefaultAzureCredential, CredentialUnavailableError
from azure.core.exceptions import ClientAuthenticationError

with DefaultAzureCredential() as credential:
    try:
        token = credential.get_token("https://management.azure.com/.default")
    except CredentialUnavailableError:
        # No credential in the chain could attempt authentication
        pass
    except ClientAuthenticationError as e:
        # Authentication was attempted but failed
        # e.message contains details from each credential in the chain
        pass
```

## Logging

Enable authentication logging for debugging:

```python
import logging

# Enable verbose Azure Identity logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("azure.identity")
logger.setLevel(logging.DEBUG)
```

```bash
# Or via environment variable
AZURE_LOG_LEVEL=debug
```

## Credential Selection Matrix

| Environment | Recommended Credential |
|-------------|------------------------|
| Local Development | `DefaultAzureCredential` (uses Azure CLI) |
| Azure App Service | `DefaultAzureCredential` (uses Managed Identity) |
| Azure Functions | `DefaultAzureCredential` (uses Managed Identity) |
| Azure Kubernetes Service | `WorkloadIdentityCredential` |
| Azure VMs | `DefaultAzureCredential` (uses Managed Identity) |
| CI/CD Pipeline | `EnvironmentCredential` or `AzurePipelinesCredential` |
| Desktop App | `InteractiveBrowserCredential` |
| CLI / Headless Tool | `DeviceCodeCredential` |
| Middle-tier Service | `OnBehalfOfCredential` |

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.xxx` sync clients with `azure.xxx.aio` async clients in the same call path. Choose one mode per module.
2. **Use credentials as context managers** (`with DefaultAzureCredential() as credential:`) when they own token caches / HTTP transports you want cleaned up; for async, use `async with` on credentials from `azure.identity.aio`.
3. **Use `DefaultAzureCredential`** for code that runs locally. Use a specific token credential for code that runs in Azure.
4. **Never hardcode credentials** — use environment variables or managed identity
5. **Prefer managed identity** in production Azure deployments
6. **Use `get_bearer_token_provider`** for non-Azure-SDK clients (OpenAI, REST APIs)
7. **Use `ChainedTokenCredential`** when you need a custom credential order
8. **Set `AZURE_CLIENT_ID`** for user-assigned managed identities (object ID and resource ID are also valid identifiers)
9. **Exclude unused credentials** to speed up `DefaultAzureCredential` authentication
10. **Use `CertificateCredential`** (not `ClientCertificateCredential` — that name doesn't exist)
11. **Enable `cache_persistence_options`** for long-running services to reduce token requests
12. **Reuse credential instances** — same credential can be shared across multiple clients

## Reference Links

| Resource | URL |
|----------|-----|
| PyPI Package | https://pypi.org/project/azure-identity/ |
| API Reference | https://learn.microsoft.com/python/api/azure-identity |
| GitHub Source | https://github.com/Azure/azure-sdk-for-python/tree/main/sdk/identity/azure-identity |
| Credential Chains | https://aka.ms/azsdk/python/identity/credential-chains |

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
