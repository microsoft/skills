# azure-data-tables-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

## Batch Operations

```python
from azure.data.tables import TableTransactionError

# Batch operations (same partition only!)
operations = [
    ("create", {"PartitionKey": "batch", "RowKey": "1", "data": "first"}),
    ("create", {"PartitionKey": "batch", "RowKey": "2", "data": "second"}),
    ("upsert", {"PartitionKey": "batch", "RowKey": "3", "data": "third"}),
]

try:
    table_client.submit_transaction(operations)
except TableTransactionError as e:
    print(f"Transaction failed: {e}")
```

## Async Client

```python
from azure.data.tables.aio import TableServiceClient, TableClient
from azure.identity.aio import DefaultAzureCredential

async def table_operations():
    async with DefaultAzureCredential() as credential:
        async with TableClient(
            endpoint="https://<account>.table.core.windows.net",
            table_name="mytable",
            credential=credential
        ) as client:
            # Create
            await client.create_entity(entity={
                "PartitionKey": "async",
                "RowKey": "1",
                "data": "test"
            })
            
            # Query
            async for entity in client.query_entities("PartitionKey eq 'async'"):
                print(entity)

import asyncio
asyncio.run(table_operations())
```

## Data Types

| Python Type | Table Storage Type |
|-------------|-------------------|
| `str` | String |
| `int` | Int64 |
| `float` | Double |
| `bool` | Boolean |
| `datetime` | DateTime |
| `bytes` | Binary |
| `UUID` | Guid |
