---
name: azure-storage-blob-py
description: |
  Azure Blob Storage SDK for Python. Use for uploading, downloading, listing blobs, managing containers, and blob lifecycle.
  Triggers: "blob storage", "BlobServiceClient", "ContainerClient", "BlobClient", "upload blob", "download blob".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-storage-blob
---

# Azure Blob Storage SDK for Python

Client library for Azure Blob Storage — object storage for unstructured data.

## Installation

```bash
pip install azure-storage-blob azure-identity
```

## Environment Variables

```bash
AZURE_STORAGE_ACCOUNT_NAME=<your-storage-account>  # Required for all auth methods
# Or use full URL
AZURE_STORAGE_ACCOUNT_URL=https://<account>.blob.core.windows.net  # Alternative to account name
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

```python
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
from azure.storage.blob import BlobServiceClient

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()
account_url = "https://<account>.blob.core.windows.net"

with BlobServiceClient(account_url, credential=credential) as blob_service_client:
    # Use blob_service_client here (see following sections for operations)
    ...
```

## Client Hierarchy

| Client | Purpose | Get From |
|--------|---------|----------|
| `BlobServiceClient` | Account-level operations | Direct instantiation |
| `ContainerClient` | Container operations | `blob_service_client.get_container_client()` |
| `BlobClient` | Single blob operations | `container_client.get_blob_client()` |

## Core Workflow

### Create Container

```python
container_client = blob_service_client.get_container_client("mycontainer")
container_client.create_container()
```

### Upload Blob

```python
# From file path
blob_client = blob_service_client.get_blob_client(
    container="mycontainer",
    blob="sample.txt"
)

with open("./local-file.txt", "rb") as data:
    blob_client.upload_blob(data, overwrite=True)

# From bytes/string
blob_client.upload_blob(b"Hello, World!", overwrite=True)

# From stream
import io
stream = io.BytesIO(b"Stream content")
blob_client.upload_blob(stream, overwrite=True)
```

### Download Blob

```python
blob_client = blob_service_client.get_blob_client(
    container="mycontainer",
    blob="sample.txt"
)

# To file
with open("./downloaded.txt", "wb") as file:
    download_stream = blob_client.download_blob()
    file.write(download_stream.readall())

# To memory
download_stream = blob_client.download_blob()
content = download_stream.readall()  # bytes

# Read into existing buffer
stream = io.BytesIO()
num_bytes = blob_client.download_blob().readinto(stream)
```

### List Blobs

```python
container_client = blob_service_client.get_container_client("mycontainer")

# List all blobs
for blob in container_client.list_blobs():
    print(f"{blob.name} - {blob.size} bytes")

# List with prefix (folder-like)
for blob in container_client.list_blobs(name_starts_with="logs/"):
    print(blob.name)

# Walk blob hierarchy (virtual directories)
for item in container_client.walk_blobs(delimiter="/"):
    if item.get("prefix"):
        print(f"Directory: {item['prefix']}")
    else:
        print(f"Blob: {item.name}")
```

### Delete Blob

```python
blob_client.delete_blob()

# Delete with snapshots
blob_client.delete_blob(delete_snapshots="include")
```

## Performance Tuning

```python
# Configure chunk sizes for large uploads/downloads
with BlobClient(
    account_url=account_url,
    container_name="mycontainer",
    blob_name="large-file.zip",
    credential=credential,
    max_block_size=4 * 1024 * 1024,  # 4 MiB blocks
    max_single_put_size=64 * 1024 * 1024  # 64 MiB single upload limit
) as blob_client:
    # Parallel upload
    blob_client.upload_blob(data, max_concurrency=4)

    # Parallel download
    download_stream = blob_client.download_blob(max_concurrency=4)
```

## SAS Tokens (User Delegation)

Generate SAS tokens with a **user delegation key** signed by Microsoft Entra ID — never with an account key. This keeps SAS issuance tied to Entra audit/rotation.

```python
from datetime import datetime, timedelta, timezone
from azure.identity import DefaultAzureCredential
from azure.storage.blob import (
    BlobServiceClient,
    BlobSasPermissions,
    generate_blob_sas,
)

now = datetime.now(timezone.utc)
account_url = "https://<account>.blob.core.windows.net"

with BlobServiceClient(account_url, credential=DefaultAzureCredential()) as service:
    # Get a user delegation key (valid up to 7 days). Caller needs the
    # "Storage Blob Delegator" role on the storage account.
    udk = service.get_user_delegation_key(
        key_start_time=now,
        key_expiry_time=now + timedelta(hours=1),
    )

    sas_token = generate_blob_sas(
        account_name="<account>",
        container_name="mycontainer",
        blob_name="sample.txt",
        user_delegation_key=udk,
        permission=BlobSasPermissions(read=True),
        expiry=now + timedelta(hours=1),
    )

blob_url = f"{account_url}/mycontainer/sample.txt?{sas_token}"
```

## Blob Properties and Metadata

```python
# Get properties
properties = blob_client.get_blob_properties()
print(f"Size: {properties.size}")
print(f"Content-Type: {properties.content_settings.content_type}")
print(f"Last modified: {properties.last_modified}")

# Set metadata
blob_client.set_blob_metadata(metadata={"category": "logs", "year": "2024"})

# Set content type
from azure.storage.blob import ContentSettings
blob_client.set_http_headers(
    content_settings=ContentSettings(content_type="application/json")
)
```

## Async Client

```python
from azure.identity.aio import DefaultAzureCredential
from azure.storage.blob.aio import BlobServiceClient

async def upload_async():
    async with DefaultAzureCredential() as credential:
        async with BlobServiceClient(account_url, credential=credential) as client:
            blob_client = client.get_blob_client("mycontainer", "sample.txt")
            
            with open("./file.txt", "rb") as data:
                await blob_client.upload_blob(data, overwrite=True)

# Download async
async def download_async():
    async with BlobServiceClient(account_url, credential=credential) as client:
        blob_client = client.get_blob_client("mycontainer", "sample.txt")
        
        stream = await blob_client.download_blob()
        data = await stream.readall()
```

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.storage.blob` sync clients with `azure.storage.blob.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with BlobServiceClient(...) as client:` (sync) or `async with BlobServiceClient(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use `DefaultAzureCredential`** for code that runs locally (instead of connection strings). Use a specific token credential for code that runs in Azure.
4. **Set `overwrite=True`** explicitly when re-uploading
5. **Use `max_concurrency`** for large file transfers
6. **Prefer `readinto()`** over `readall()` for memory efficiency
7. **Use `walk_blobs()`** for hierarchical listing
8. **Set appropriate content types** for web-served blobs

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Capability index mapping hero flows and non-hero references. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples (metadata/properties and async patterns). |
