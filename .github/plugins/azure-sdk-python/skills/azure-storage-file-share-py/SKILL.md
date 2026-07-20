---
name: azure-storage-file-share-py
description: |-
  Azure Storage File Share SDK for Python. Use for SMB file shares, directories, and file operations in the cloud.
  Triggers: "azure-storage-file-share", "ShareServiceClient", "ShareClient", "file share", "SMB".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Storage File Share SDK for Python

Manage SMB file shares for cloud-native and lift-and-shift scenarios.

## Installation

```bash
pip install azure-storage-file-share
```

## Environment Variables

```bash
AZURE_STORAGE_ACCOUNT_URL=https://<account>.file.core.windows.net  # Required for Entra ID auth
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
from azure.storage.fileshare import ShareServiceClient
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

with ShareServiceClient(
    account_url=os.environ["AZURE_STORAGE_ACCOUNT_URL"],
    credential=credential
) as service:
    # Use service here (see following sections for operations)
    ...
```

## Share Operations

### Create Share

```python
share = service.create_share("my-share")
```

### List Shares

```python
for share in service.list_shares():
    print(f"{share.name}: {share.quota} GB")
```

### Get Share Client

```python
share_client = service.get_share_client("my-share")
```

### Delete Share

```python
service.delete_share("my-share")
```

## Directory Operations

### Create Directory

```python
share_client = service.get_share_client("my-share")
share_client.create_directory("my-directory")

# Nested directory
share_client.create_directory("my-directory/sub-directory")
```

### List Directories and Files

```python
directory_client = share_client.get_directory_client("my-directory")

for item in directory_client.list_directories_and_files():
    if item["is_directory"]:
        print(f"[DIR] {item['name']}")
    else:
        print(f"[FILE] {item['name']} ({item['size']} bytes)")
```

### Delete Directory

```python
share_client.delete_directory("my-directory")
```

## File Operations

### Upload File

```python
file_client = share_client.get_file_client("my-directory/file.txt")

# From string
file_client.upload_file("Hello, World!")

# From file
with open("local-file.txt", "rb") as f:
    file_client.upload_file(f)

# From bytes
file_client.upload_file(b"Binary content")
```

### Download File

```python
file_client = share_client.get_file_client("my-directory/file.txt")

# To bytes
data = file_client.download_file().readall()

# To file
with open("downloaded.txt", "wb") as f:
    data = file_client.download_file()
    data.readinto(f)

# Stream chunks
download = file_client.download_file()
for chunk in download.chunks():
    process(chunk)
```

### Get File Properties

```python
properties = file_client.get_file_properties()
print(f"Size: {properties.size}")
print(f"Content type: {properties.content_settings.content_type}")
print(f"Last modified: {properties.last_modified}")
```

### Delete File

```python
file_client.delete_file()
```

### Copy File

```python
source_url = "https://account.file.core.windows.net/share/source.txt"
dest_client = share_client.get_file_client("destination.txt")
dest_client.start_copy_from_url(source_url)
```

## Range Operations

### Upload Range

```python
# Upload to specific range
file_client.upload_range(data=b"content", offset=0, length=7)
```

### Download Range

```python
# Download specific range
download = file_client.download_file(offset=0, length=100)
data = download.readall()
```

## Snapshot Operations

### Create Snapshot

```python
snapshot = share_client.create_snapshot()
print(f"Snapshot: {snapshot['snapshot']}")
```

### Access Snapshot

```python
snapshot_client = service.get_share_client(
    "my-share",
    snapshot=snapshot["snapshot"]
)
```

## Async Client

```python
from azure.storage.fileshare.aio import ShareServiceClient
from azure.identity.aio import DefaultAzureCredential

async def upload_file():
    async with DefaultAzureCredential() as credential:
        async with ShareServiceClient(account_url, credential=credential) as service:
            share = service.get_share_client("my-share")
            file_client = share.get_file_client("test.txt")
            
            await file_client.upload_file("Hello!")
```

## Client Types

| Client | Purpose |
|--------|---------|
| `ShareServiceClient` | Account-level operations |
| `ShareClient` | Share operations |
| `ShareDirectoryClient` | Directory operations |
| `ShareFileClient` | File operations |

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.storage.fileshare` sync clients with `azure.storage.fileshare.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with ShareServiceClient(...) as client:` (sync) or `async with ShareServiceClient(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use `DefaultAzureCredential`** for portable auth across local dev and Azure (avoid connection strings / API keys when possible).
4. **Use Microsoft Entra ID** for production with RBAC
5. **Stream large files** using chunks() to avoid memory issues
6. **Create snapshots** before major changes
7. **Set quotas** to prevent unexpected storage costs
8. **Use ranges** for partial file updates

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
