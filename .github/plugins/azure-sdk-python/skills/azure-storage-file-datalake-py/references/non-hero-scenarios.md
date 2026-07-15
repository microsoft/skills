# azure-storage-file-datalake-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

## List Contents

```python
# List paths (files and directories)
for path in file_system_client.get_paths():
    print(f"{'DIR' if path.is_directory else 'FILE'}: {path.name}")

# List paths in directory
for path in file_system_client.get_paths(path="mydir"):
    print(path.name)

# Recursive listing
for path in file_system_client.get_paths(path="mydir", recursive=True):
    print(path.name)
```

## File/Directory Properties

```python
# Get properties
properties = file_client.get_file_properties()
print(f"Size: {properties.size}")
print(f"Last modified: {properties.last_modified}")

# Set metadata
file_client.set_metadata(metadata={"processed": "true"})
```

## Access Control (ACL)

```python
# Get ACL
acl = directory_client.get_access_control()
print(f"Owner: {acl['owner']}")
print(f"Permissions: {acl['permissions']}")

# Set ACL
directory_client.set_access_control(
    owner="user-id",
    permissions="rwxr-x---"
)

# Update ACL entries
from azure.storage.filedatalake import AccessControlChangeResult
directory_client.update_access_control_recursive(
    acl="user:user-id:rwx"
)
```

## Async Client

```python
from azure.storage.filedatalake.aio import DataLakeServiceClient
from azure.identity.aio import DefaultAzureCredential

async def datalake_operations():
    async with DefaultAzureCredential() as credential:
        async with DataLakeServiceClient(
            account_url="https://<account>.dfs.core.windows.net",
            credential=credential
        ) as service_client:
            file_system_client = service_client.get_file_system_client("myfilesystem")
            file_client = file_system_client.get_file_client("test.txt")
            
            await file_client.upload_data(b"async content", overwrite=True)
            
            download = await file_client.download_file()
            content = await download.readall()

import asyncio
asyncio.run(datalake_operations())
```
