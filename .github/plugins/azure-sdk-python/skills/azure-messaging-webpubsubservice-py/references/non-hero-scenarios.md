# azure-messaging-webpubsubservice-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

## Operational hardening

### Retry Policy

Configure retries for transient failures via `azure-core` retry policy:

```python
import os
from azure.messaging.webpubsubservice import WebPubSubServiceClient
from azure.identity import DefaultAzureCredential
from azure.core.pipeline.policies import RetryPolicy

retry_policy = RetryPolicy(retry_total=3, retry_backoff_factor=2)
credential = DefaultAzureCredential()

with WebPubSubServiceClient(
    endpoint=os.environ["WEBPUBSUB_ENDPOINT"],
    hub=os.environ["AZURE_WEBPUBSUB_HUB"],
    credential=credential,
    retry_policy=retry_policy,
) as client:
    client.send_to_all("Hello!", content_type="text/plain")
```

### Broadcast with Connection Exclusion

Send to all connections except the sender:

```python
# Exclude the sender's connection ID from the broadcast
client.send_to_all(
    message={"type": "chat", "text": "Hello everyone!"},
    content_type="application/json",
    excluded_connections=["sender-connection-id"],
)
```

### Connection Lifecycle Check

Verify connection and user state before sending:

```python
connection_id = "abc123"
user_id = "user123"

if client.connection_exists(connection_id=connection_id):
    client.send_to_connection(
        connection_id=connection_id,
        message="You have a message!",
        content_type="text/plain",
    )

if client.user_exists(user_id=user_id):
    client.send_to_user(
        user_id=user_id,
        message="Personal message",
        content_type="text/plain",
    )
else:
    print(f"User {user_id} has no active connections")
```

### Group Cleanup

Remove all connections from a group before deleting it:

```python
# Remove a user from all groups, then close their connections
client.remove_user_from_all_groups(user_id="user123")
client.close_user_connections(user_id="user123", reason="Session ended")
```

### Short-lived Access Tokens

Issue tokens with a limited TTL to reduce credential exposure:

```python
from datetime import timedelta

# 30-minute token with limited roles
token = client.get_client_access_token(
    user_id="user123",
    roles=["webpubsub.sendToGroup.my-group"],
    minutes_to_expire=30,
    groups=["my-group"],
)
# Pass the URL directly to the authorized client — do not log it (it embeds a bearer token)
connect_url = token["url"]
```

### Async Client

Use the async client for high-concurrency workloads:

```python
import os
from azure.messaging.webpubsubservice.aio import WebPubSubServiceClient
from azure.identity.aio import DefaultAzureCredential

async def broadcast_notifications(user_ids: list[str], message: str):
    async with DefaultAzureCredential() as credential:
        async with WebPubSubServiceClient(
            endpoint=os.environ["WEBPUBSUB_ENDPOINT"],
            hub=os.environ["AZURE_WEBPUBSUB_HUB"],
            credential=credential,
        ) as client:
            for user_id in user_ids:
                if await client.user_exists(user_id=user_id):
                    await client.send_to_user(
                        user_id=user_id,
                        message=message,
                        content_type="text/plain",
                    )
```
