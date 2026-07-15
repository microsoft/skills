# azure-storage-blob-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

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
    async with DefaultAzureCredential() as credential:
        async with BlobServiceClient(account_url, credential=credential) as client:
            blob_client = client.get_blob_client("mycontainer", "sample.txt")

            stream = await blob_client.download_blob()
            data = await stream.readall()
```
