# azure-containerregistry-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

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
from azure.identity import DefaultAzureCredential

with DefaultAzureCredential() as credential:
    with ContainerRegistryClient(endpoint, credential) as client:
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
