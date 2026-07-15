---
name: azure-eventgrid-py
description: |
  Azure Event Grid SDK for Python. Use for publishing events, handling CloudEvents, and event-driven architectures.
  Triggers: "event grid", "EventGridPublisherClient", "CloudEvent", "EventGridEvent", "publish events".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-eventgrid
---

# Azure Event Grid SDK for Python

Event routing service for building event-driven applications with pub/sub semantics.

## Installation

```bash
pip install azure-eventgrid azure-identity
```

## Environment Variables

```bash
EVENTGRID_TOPIC_ENDPOINT=https://<topic-name>.<region>.eventgrid.azure.net/api/events  # Required for Event Grid topic publishing
EVENTGRID_NAMESPACE_ENDPOINT=https://<namespace>.<region>.eventgrid.azure.net  # Required for namespace operations
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
from azure.eventgrid import EventGridPublisherClient

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

endpoint = "https://<topic-name>.<region>.eventgrid.azure.net/api/events"

with EventGridPublisherClient(endpoint, credential) as client:
    # Use client here (see following sections for operations)
    ...
```

## Event Types

| Format | Class | Use Case |
|--------|-------|----------|
| Cloud Events 1.0 | `CloudEvent` | Standard, interoperable (recommended) |
| Event Grid Schema | `EventGridEvent` | Azure-native format |

## Publish CloudEvents

```python
from azure.eventgrid import EventGridPublisherClient, CloudEvent
from azure.identity import DefaultAzureCredential

with EventGridPublisherClient(endpoint, DefaultAzureCredential()) as client:
    # Single event
    event = CloudEvent(
        type="MyApp.Events.OrderCreated",
        source="/myapp/orders",
        data={"order_id": "12345", "amount": 99.99}
    )
    client.send(event)

    # Multiple events
    events = [
        CloudEvent(
            type="MyApp.Events.OrderCreated",
            source="/myapp/orders",
            data={"order_id": f"order-{i}"}
        )
        for i in range(10)
    ]
    client.send(events)
```

## Publish EventGridEvents

```python
from azure.eventgrid import EventGridEvent
from datetime import datetime, timezone

event = EventGridEvent(
    subject="/myapp/orders/12345",
    event_type="MyApp.Events.OrderCreated",
    data={"order_id": "12345", "amount": 99.99},
    data_version="1.0"
)

client.send(event)
```

## Event Properties

### CloudEvent Properties

```python
event = CloudEvent(
    type="MyApp.Events.ItemCreated",      # Required: event type
    source="/myapp/items",                 # Required: event source
    data={"key": "value"},                 # Event payload
    subject="items/123",                   # Optional: subject/path
    datacontenttype="application/json",   # Optional: content type
    dataschema="https://schema.example",  # Optional: schema URL
    time=datetime.now(timezone.utc),      # Optional: timestamp
    extensions={"custom": "value"}         # Optional: custom attributes
)
```

### EventGridEvent Properties

```python
event = EventGridEvent(
    subject="/myapp/items/123",            # Required: subject
    event_type="MyApp.ItemCreated",        # Required: event type
    data={"key": "value"},                 # Required: event payload
    data_version="1.0",                    # Required: schema version
    topic="/subscriptions/.../topics/...", # Optional: auto-set
    event_time=datetime.now(timezone.utc)  # Optional: timestamp
)
```

## Async Client

```python
from azure.eventgrid.aio import EventGridPublisherClient
from azure.identity.aio import DefaultAzureCredential

async def publish_events():
    credential = DefaultAzureCredential()
    
    async with EventGridPublisherClient(endpoint, credential) as client:
        event = CloudEvent(
            type="MyApp.Events.Test",
            source="/myapp",
            data={"message": "hello"}
        )
        await client.send(event)

import asyncio
asyncio.run(publish_events())
```

## Namespace Topics (Event Grid Namespaces)

For Event Grid Namespaces (pull delivery):

```python
from azure.eventgrid import EventGridPublisherClient
from azure.identity import DefaultAzureCredential

# Namespace endpoint (different from custom topic)
namespace_endpoint = "https://<namespace>.<region>.eventgrid.azure.net"
topic_name = "my-topic"

with EventGridPublisherClient(
    endpoint=namespace_endpoint,
    credential=DefaultAzureCredential()
) as client:
    client.send(
        event,
        namespace_topic=topic_name
    )
```

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.xxx` sync clients with `azure.xxx.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use `DefaultAzureCredential`** for portable auth across local dev and Azure (avoid connection strings / API keys when possible).
4. **Use CloudEvents** for new applications (industry standard)
5. **Batch events** when publishing multiple events
6. **Include meaningful subjects** for filtering
7. **Use async client** for high-throughput scenarios
8. **Handle retries** — Event Grid has built-in retry
9. **Set appropriate event types** for routing and filtering

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
