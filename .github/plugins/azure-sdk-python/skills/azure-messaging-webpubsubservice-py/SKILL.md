---
name: azure-messaging-webpubsubservice-py
description: |
  Azure Web PubSub Service SDK for Python. Use for real-time messaging, WebSocket connections, and pub/sub patterns.
  Triggers: "azure-messaging-webpubsubservice", "WebPubSubServiceClient", "real-time", "WebSocket", "pub/sub".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-messaging-webpubsubservice
---

# Azure Web PubSub Service SDK for Python

Real-time messaging with WebSocket connections at scale.

## Installation

```bash
# Service SDK (server-side)
pip install azure-messaging-webpubsubservice

# Client SDK (for Python WebSocket clients)
pip install azure-messaging-webpubsubclient
```

## Environment Variables

```bash
AZURE_WEBPUBSUB_HUB=my-hub  # Required for all auth methods
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

## Service Client (Server-Side)

### Authentication

```python
from azure.messaging.webpubsubservice import WebPubSubServiceClient
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

with WebPubSubServiceClient(
    endpoint="https://<name>.webpubsub.azure.com",
    hub="my-hub",
    credential=credential
) as client:
    # Use `client` for all subsequent operations (see examples below)
    ...
```

### Generate Client Access Token

```python
# Token for anonymous user
token = client.get_client_access_token()
print(f"URL: {token['url']}")

# Token with user ID
token = client.get_client_access_token(
    user_id="user123",
    roles=["webpubsub.sendToGroup", "webpubsub.joinLeaveGroup"]
)

# Token with groups
token = client.get_client_access_token(
    user_id="user123",
    groups=["group1", "group2"]
)
```

### Send to All Clients

```python
# Send text
client.send_to_all(message="Hello everyone!", content_type="text/plain")

# Send JSON
client.send_to_all(
    message={"type": "notification", "data": "Hello"},
    content_type="application/json"
)
```

### Send to User

```python
client.send_to_user(
    user_id="user123",
    message="Hello user!",
    content_type="text/plain"
)
```

### Send to Group

```python
client.send_to_group(
    group="my-group",
    message="Hello group!",
    content_type="text/plain"
)
```

### Send to Connection

```python
client.send_to_connection(
    connection_id="abc123",
    message="Hello connection!",
    content_type="text/plain"
)
```

### Group Management

```python
# Add user to group
client.add_user_to_group(group="my-group", user_id="user123")

# Remove user from group
client.remove_user_from_group(group="my-group", user_id="user123")

# Add connection to group
client.add_connection_to_group(group="my-group", connection_id="abc123")

# Remove connection from group
client.remove_connection_from_group(group="my-group", connection_id="abc123")
```

### Connection Management

```python
# Check if connection exists
exists = client.connection_exists(connection_id="abc123")

# Check if user has connections
exists = client.user_exists(user_id="user123")

# Check if group has connections
exists = client.group_exists(group="my-group")

# Close connection
client.close_connection(connection_id="abc123", reason="Session ended")

# Close all connections for user
client.close_all_connections(user_id="user123")
```

### Grant/Revoke Permissions

```python
from azure.messaging.webpubsubservice import WebPubSubServiceClient

# Grant permission
client.grant_permission(
    permission="joinLeaveGroup",
    connection_id="abc123",
    target_name="my-group"
)

# Revoke permission
client.revoke_permission(
    permission="joinLeaveGroup",
    connection_id="abc123",
    target_name="my-group"
)

# Check permission
has_permission = client.check_permission(
    permission="joinLeaveGroup",
    connection_id="abc123",
    target_name="my-group"
)
```

## Client SDK (Python WebSocket Client)

```python
from azure.messaging.webpubsubclient import WebPubSubClient

with WebPubSubClient(credential=token["url"]) as client:
    @client.on("connected")
    def on_connected(e):
        print(f"Connected: {e.connection_id}")

    @client.on("server-message")
    def on_message(e):
        print(f"Message: {e.data}")

    @client.on("group-message")
    def on_group_message(e):
        print(f"Group {e.group}: {e.data}")

    client.send_to_group("my-group", "Hello from Python!")
```

## Async Service Client

```python
from azure.messaging.webpubsubservice.aio import WebPubSubServiceClient
from azure.identity.aio import DefaultAzureCredential

async def broadcast():
    async with DefaultAzureCredential() as credential:
        async with WebPubSubServiceClient(
            endpoint="https://<name>.webpubsub.azure.com",
            hub="my-hub",
            credential=credential
        ) as client:
            await client.send_to_all("Hello async!", content_type="text/plain")
```

## Client Operations

| Operation | Description |
|-----------|-------------|
| `get_client_access_token` | Generate WebSocket connection URL |
| `send_to_all` | Broadcast to all connections |
| `send_to_user` | Send to specific user |
| `send_to_group` | Send to group members |
| `send_to_connection` | Send to specific connection |
| `add_user_to_group` | Add user to group |
| `remove_user_from_group` | Remove user from group |
| `close_connection` | Disconnect client |
| `connection_exists` | Check connection status |

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.xxx` sync clients with `azure.xxx.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use `DefaultAzureCredential`** for portable auth across local dev and Azure (avoid connection strings / access keys when possible).
4. **Use roles** to limit client permissions
4. **Use groups** for targeted messaging
5. **Generate short-lived tokens** for security
6. **Use user IDs** to send to users across connections
7. **Handle reconnection** in client applications
8. **Use JSON** content type for structured data
9. **Close connections** gracefully with reasons

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
