# azure-storage-queue-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

## Update Message

```python
# Extend visibility or update content
messages = queue_client.receive_messages()
for message in messages:
    # Extend timeout (need more time)
    queue_client.update_message(
        message,
        visibility_timeout=60
    )
    
    # Update content and timeout
    queue_client.update_message(
        message,
        content="Updated content",
        visibility_timeout=60
    )
```

## Delete Message

```python
# Delete after successful processing
messages = queue_client.receive_messages()
for message in messages:
    try:
        # Process...
        queue_client.delete_message(message)
    except Exception:
        # Message becomes visible again after visibility timeout for retry.
        # Log the failure and re-raise so the caller is aware.
        raise
```

## Clear Queue

```python
# Delete all messages
queue_client.clear_messages()
```

## Queue Properties

```python
# Get queue properties
properties = queue_client.get_queue_properties()
print(f"Approximate message count: {properties.approximate_message_count}")

# Set/get metadata
queue_client.set_queue_metadata(metadata={"environment": "production"})
properties = queue_client.get_queue_properties()
print(properties.metadata)
```

## Async Client

```python
from azure.storage.queue.aio import QueueServiceClient, QueueClient
from azure.identity.aio import DefaultAzureCredential

async def queue_operations():
    async with DefaultAzureCredential() as credential:
        async with QueueClient(
            account_url="https://<account>.queue.core.windows.net",
            queue_name="myqueue",
            credential=credential
        ) as client:
            # Send
            await client.send_message("Async message")

            # Receive
            async for message in client.receive_messages():
                print(message.content)
                await client.delete_message(message)

import asyncio
asyncio.run(queue_operations())
```

## Base64 Encoding

```python
from azure.storage.queue import QueueClient, BinaryBase64EncodePolicy, BinaryBase64DecodePolicy

# For binary data
with QueueClient(
    account_url=account_url,
    queue_name="myqueue",
    credential=credential,
    message_encode_policy=BinaryBase64EncodePolicy(),
    message_decode_policy=BinaryBase64DecodePolicy()
) as queue_client:
    # Send bytes
    queue_client.send_message(b"Binary content")
```
