# azure-identity-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

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
import logging

logger = logging.getLogger(__name__)

with DefaultAzureCredential() as credential:
    try:
        token = credential.get_token("https://management.azure.com/.default")
    except CredentialUnavailableError:
        # No credential in the chain could attempt authentication.
        # Log and re-raise so the caller can surface the configuration issue.
        logger.error("No credential available — check Azure CLI login or Managed Identity configuration")
        raise
    except ClientAuthenticationError as e:
        # Authentication was attempted but failed.
        # e.message contains details from each credential in the chain.
        logger.error("Authentication failed: %s", e.message)
        raise
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
