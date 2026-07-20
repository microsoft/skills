---
name: azure-containerregistry-py
description: |
  Azure Container Registry SDK for Python. Use for managing container images, artifacts, and repositories.
  Triggers: "azure-containerregistry", "ContainerRegistryClient", "container images", "docker registry", "ACR".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-containerregistry
---

# Azure Container Registry SDK for Python

Manage container images, artifacts, and repositories in Azure Container Registry.

## Installation

```bash
pip install azure-containerregistry
```

## Environment Variables

```bash
AZURE_CONTAINERREGISTRY_ENDPOINT=https://<registry-name>.azurecr.io  # Required for all auth methods
AZURE_TOKEN_CREDENTIALS=prod # Required only if DefaultAzureCredential is used in production
```

## Authentication & Lifecycle

> **🔑 Two rules apply to every code sample below:**
>
> 1. **Prefer `DefaultAzureCredential`.** It works locally (Azure CLI / VS Code / Developer CLI) and in Azure (managed identity, workload identity) with no code change. Avoid connection strings, account/API keys — they bypass Entra audit and rotation.
>    - Local dev: `DefaultAzureCredential` works as-is.
>    - Production: set `AZURE_TOKEN_CREDENTIALS=prod` (or `AZURE_TOKEN_CREDENTIALS=<specific_credential>`) to constrain the credential chain to production-safe credentials.
> 2. **Wrap every client in a context manager** so HTTP transports, sockets, and token caches are released deterministically:
>    - Sync: `with <Client>(...) as client:`
>    - Async: `async with <Client>(...) as client:` **and** `async with DefaultAzureCredential() as credential:` (from `azure.identity.aio`)
>
> Snippets may abbreviate this setup, but production code should always follow both rules.

### Entra ID (Recommended)

```python
import os
from azure.containerregistry import ContainerRegistryClient
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

with ContainerRegistryClient(
    endpoint=os.environ["AZURE_CONTAINERREGISTRY_ENDPOINT"],
    credential=credential
) as client:
    # Use client here (see following sections for operations)
    ...
```

### Anonymous Access (Public Registry)

```python
from azure.containerregistry import ContainerRegistryClient

with ContainerRegistryClient(
    endpoint="https://mcr.microsoft.com",
    credential=None,
    audience="https://mcr.microsoft.com"
) as client:
    # Use client here (see following sections for operations)
    ...
```

## List Repositories

```python
with ContainerRegistryClient(endpoint, DefaultAzureCredential()) as client:
    for repository in client.list_repository_names():
        print(repository)
```

## Repository Operations

### Get Repository Properties

```python
properties = client.get_repository_properties("my-image")
print(f"Created: {properties.created_on}")
print(f"Modified: {properties.last_updated_on}")
print(f"Manifests: {properties.manifest_count}")
print(f"Tags: {properties.tag_count}")
```

### Update Repository Properties

```python
from azure.containerregistry import RepositoryProperties

client.update_repository_properties(
    "my-image",
    properties=RepositoryProperties(
        can_delete=False,
        can_write=False
    )
)
```

### Delete Repository

```python
client.delete_repository("my-image")
```

## List Tags

```python
for tag in client.list_tag_properties("my-image"):
    print(f"{tag.name}: {tag.created_on}")
```

### Filter by Order

```python
from azure.containerregistry import ArtifactTagOrder

# Most recent first
for tag in client.list_tag_properties(
    "my-image",
    order_by=ArtifactTagOrder.LAST_UPDATED_ON_DESCENDING
):
    print(f"{tag.name}: {tag.last_updated_on}")
```

## Manifest Operations

### List Manifests

```python
from azure.containerregistry import ArtifactManifestOrder

for manifest in client.list_manifest_properties(
    "my-image",
    order_by=ArtifactManifestOrder.LAST_UPDATED_ON_DESCENDING
):
    print(f"Digest: {manifest.digest}")
    print(f"Tags: {manifest.tags}")
    print(f"Size: {manifest.size_in_bytes}")
```

### Get Manifest Properties

```python
manifest = client.get_manifest_properties("my-image", "latest")
print(f"Digest: {manifest.digest}")
print(f"Architecture: {manifest.architecture}")
print(f"OS: {manifest.operating_system}")
```

### Update Manifest Properties

```python
from azure.containerregistry import ArtifactManifestProperties

client.update_manifest_properties(
    "my-image",
    "latest",
    properties=ArtifactManifestProperties(
        can_delete=False,
        can_write=False
    )
)
```

### Delete Manifest

```python
# Delete by digest
client.delete_manifest("my-image", "sha256:abc123...")

# Delete by tag
manifest = client.get_manifest_properties("my-image", "old-tag")
client.delete_manifest("my-image", manifest.digest)
```

## Tag Operations

### Get Tag Properties

```python
tag = client.get_tag_properties("my-image", "latest")
print(f"Digest: {tag.digest}")
print(f"Created: {tag.created_on}")
```

### Delete Tag

```python
client.delete_tag("my-image", "old-tag")
```

## Upload and Download Artifacts

```python
from azure.containerregistry import ContainerRegistryClient

with ContainerRegistryClient(endpoint, DefaultAzureCredential()) as client:
    # Download manifest
    manifest = client.download_manifest("my-image", "latest")
    print(f"Media type: {manifest.media_type}")
    print(f"Digest: {manifest.digest}")

    # Download blob
    blob = client.download_blob("my-image", "sha256:abc123...")
    with open("layer.tar.gz", "wb") as f:
        for chunk in blob:
            f.write(chunk)
```

## Async Client

```python
from azure.containerregistry.aio import ContainerRegistryClient
from azure.identity.aio import DefaultAzureCredential

async def list_repos():
    async with DefaultAzureCredential() as credential:
        async with ContainerRegistryClient(endpoint, credential) as client:
            async for repo in client.list_repository_names():
                print(repo)
```

## Clean Up Old Images

```python
from datetime import datetime, timedelta, timezone

cutoff = datetime.now(timezone.utc) - timedelta(days=30)

for manifest in client.list_manifest_properties("my-image"):
    if manifest.last_updated_on < cutoff and not manifest.tags:
        print(f"Deleting {manifest.digest}")
        client.delete_manifest("my-image", manifest.digest)
```

## Client Operations

| Operation | Description |
|-----------|-------------|
| `list_repository_names` | List all repositories |
| `get_repository_properties` | Get repository metadata |
| `delete_repository` | Delete repository and all images |
| `list_tag_properties` | List tags in repository |
| `get_tag_properties` | Get tag metadata |
| `delete_tag` | Delete specific tag |
| `list_manifest_properties` | List manifests in repository |
| `get_manifest_properties` | Get manifest metadata |
| `delete_manifest` | Delete manifest by digest |
| `download_manifest` | Download manifest content |
| `download_blob` | Download layer blob |

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.xxx` sync clients with `azure.xxx.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use Microsoft Entra ID** for authentication in production
4. **Delete by digest** not tag to avoid orphaned images
5. **Lock production images** with can_delete=False
6. **Clean up untagged manifests** regularly
7. **Use async client** for high-throughput operations
8. **Order by last_updated** to find recent/old images
9. **Check manifest.tags** before deleting to avoid removing tagged images

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
