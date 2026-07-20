---
name: azure-data-tables-py
description: |
  Azure Tables SDK for Python (Storage and Cosmos DB). Use for NoSQL key-value storage, entity CRUD, and batch operations.
  Triggers: "table storage", "TableServiceClient", "TableClient", "entities", "PartitionKey", "RowKey".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-data-tables
---

# Azure Tables SDK for Python

NoSQL key-value store for structured data (Azure Storage Tables or Cosmos DB Table API).

## Installation

```bash
pip install azure-data-tables azure-identity
```

## Environment Variables

```bash
# Azure Storage Tables
AZURE_STORAGE_ACCOUNT_URL=https://<account>.table.core.windows.net  # Required for Azure Storage Tables

# Cosmos DB Table API
COSMOS_TABLE_ENDPOINT=https://<account>.table.cosmos.azure.com  # Required for Cosmos DB Table API
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
import os
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
from azure.data.tables import TableServiceClient, TableClient

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

endpoint = "https://<account>.table.core.windows.net"

# Service client (manage tables)
with TableServiceClient(endpoint=endpoint, credential=credential) as service_client:
    # Use service_client here (see following sections for operations)
    ...

# Table client (work with entities)
with TableClient(endpoint=endpoint, table_name="mytable", credential=credential) as table_client:
    # Use table_client here (see following sections for operations)
    ...
```

## Client Types

| Client | Purpose |
|--------|---------|
| `TableServiceClient` | Create/delete tables, list tables |
| `TableClient` | Entity CRUD, queries |

## Table Operations

```python
# Create table
service_client.create_table("mytable")

# Create if not exists
service_client.create_table_if_not_exists("mytable")

# Delete table
service_client.delete_table("mytable")

# List tables
for table in service_client.list_tables():
    print(table.name)

# Get table client
table_client = service_client.get_table_client("mytable")
```

## Entity Operations

**Important**: Every entity requires `PartitionKey` and `RowKey` (together form unique ID).

### Create Entity

```python
entity = {
    "PartitionKey": "sales",
    "RowKey": "order-001",
    "product": "Widget",
    "quantity": 5,
    "price": 9.99,
    "shipped": False
}

# Create (fails if exists)
table_client.create_entity(entity=entity)

# Upsert (create or replace)
table_client.upsert_entity(entity=entity)
```

### Get Entity

```python
# Get by key (fastest)
entity = table_client.get_entity(
    partition_key="sales",
    row_key="order-001"
)
print(f"Product: {entity['product']}")
```

### Update Entity

```python
# Replace entire entity
entity["quantity"] = 10
table_client.update_entity(entity=entity, mode="replace")

# Merge (update specific fields only)
update = {
    "PartitionKey": "sales",
    "RowKey": "order-001",
    "shipped": True
}
table_client.update_entity(entity=update, mode="merge")
```

### Delete Entity

```python
table_client.delete_entity(
    partition_key="sales",
    row_key="order-001"
)
```

## Query Entities

### Query Within Partition

```python
# Query by partition (efficient)
entities = table_client.query_entities(
    query_filter="PartitionKey eq 'sales'"
)
for entity in entities:
    print(entity)
```

### Query with Filters

```python
# Filter by properties
entities = table_client.query_entities(
    query_filter="PartitionKey eq 'sales' and quantity gt 3"
)

# With parameters (safer)
entities = table_client.query_entities(
    query_filter="PartitionKey eq @pk and price lt @max_price",
    parameters={"pk": "sales", "max_price": 50.0}
)
```

### Select Specific Properties

```python
entities = table_client.query_entities(
    query_filter="PartitionKey eq 'sales'",
    select=["RowKey", "product", "price"]
)
```

### List All Entities

```python
# List all (cross-partition - use sparingly)
for entity in table_client.list_entities():
    print(entity)
```

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

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.data.tables` sync clients with `azure.data.tables.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with TableClient(...) as client:` (sync) or `async with TableClient(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use `DefaultAzureCredential`** for portable auth across local dev and Azure (avoid connection strings / API keys when possible).
4. **Design partition keys** for query patterns and even distribution
5. **Query within partitions** whenever possible (cross-partition is expensive)
6. **Use batch operations** for multiple entities in same partition
7. **Use `upsert_entity`** for idempotent writes
8. **Use parameterized queries** to prevent injection
9. **Keep entities small** — max 1MB per entity
10. **Use async client** for high-throughput scenarios

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
