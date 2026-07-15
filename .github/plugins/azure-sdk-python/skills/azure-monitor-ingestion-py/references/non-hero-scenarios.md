# azure-monitor-ingestion-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

## Async Client

```python
import asyncio
from azure.monitor.ingestion.aio import LogsIngestionClient
from azure.identity.aio import DefaultAzureCredential

async def upload_logs():
    async with DefaultAzureCredential() as credential:
        async with LogsIngestionClient(
            endpoint=endpoint,
            credential=credential
        ) as client:
            await client.upload(
                rule_id=rule_id,
                stream_name=stream_name,
                logs=logs
            )

asyncio.run(upload_logs())
```

## Sovereign Clouds

```python
from azure.identity import AzureAuthorityHosts, DefaultAzureCredential
from azure.monitor.ingestion import LogsIngestionClient

# Azure Government
credential = DefaultAzureCredential(authority=AzureAuthorityHosts.AZURE_GOVERNMENT)
with LogsIngestionClient(
    endpoint="https://example.ingest.monitor.azure.us",
    credential=credential,
    credential_scopes=["https://monitor.azure.us/.default"]
) as client:
    # client.upload(...)
    ...
```

## Batching Behavior

The SDK automatically:
- Splits logs into chunks of 1MB or less
- Compresses each chunk with gzip
- Uploads chunks in parallel

No manual batching needed for large log sets.

## Client Types

| Client | Purpose |
|--------|---------|
| `LogsIngestionClient` | Sync client for uploading logs |
| `LogsIngestionClient` (aio) | Async client for uploading logs |

## Key Concepts

| Concept | Description |
|---------|-------------|
| **DCE** | Data Collection Endpoint — ingestion URL |
| **DCR** | Data Collection Rule — defines schema, transformations, destination |
| **Stream** | Named data flow within a DCR |
| **Custom Table** | Target table in Log Analytics (ends with `_CL`) |

## DCR Stream Name Format

Stream names follow patterns:
- `Custom-<TableName>_CL` — For custom tables
- `Microsoft-<TableName>` — For built-in tables
