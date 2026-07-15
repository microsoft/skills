# azure-eventgrid-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

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
