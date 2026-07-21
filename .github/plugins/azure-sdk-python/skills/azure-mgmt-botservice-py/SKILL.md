---
name: azure-mgmt-botservice-py
description: |-
  Azure Bot Service Management SDK for Python. Use for creating, managing, and configuring Azure Bot Service resources.
  Triggers: "azure-mgmt-botservice", "AzureBotService", "bot management", "conversational AI", "bot channels".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Bot Service Management SDK for Python

Manage Azure Bot Service resources including bots, channels, and connections.

## Installation

```bash
pip install azure-mgmt-botservice
pip install azure-identity
```

## Environment Variables

```bash
AZURE_SUBSCRIPTION_ID=<your-subscription-id>  # Required for all auth methods
AZURE_RESOURCE_GROUP=<your-resource-group>  # Required for all auth methods
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
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
from azure.mgmt.botservice import AzureBotService
import os

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

with AzureBotService(
    credential=credential,
    subscription_id=os.environ["AZURE_SUBSCRIPTION_ID"]
) as client:
    # Use `client` for all subsequent operations (see examples below)
    ...
```

## Create a Bot

```python
from azure.mgmt.botservice import AzureBotService
from azure.mgmt.botservice.models import Bot, BotProperties, Sku
from azure.identity import DefaultAzureCredential
import os

resource_group = os.environ["AZURE_RESOURCE_GROUP"]
bot_name = "my-chat-bot"

credential = DefaultAzureCredential()
with AzureBotService(
    credential=credential,
    subscription_id=os.environ["AZURE_SUBSCRIPTION_ID"]
) as client:
    bot = client.bots.create(
        resource_group_name=resource_group,
        resource_name=bot_name,
        parameters=Bot(
            location="global",
            sku=Sku(name="F0"),  # Free tier
            kind="azurebot",
            properties=BotProperties(
                display_name="My Chat Bot",
                description="A conversational AI bot",
                endpoint="https://my-bot-app.azurewebsites.net/api/messages",
                msa_app_id="<your-app-id>",
                msa_app_type="MultiTenant"
            )
        )
    )

print(f"Bot created: {bot.name}")
```

## Get Bot Details

```python
bot = client.bots.get(
    resource_group_name=resource_group,
    resource_name=bot_name
)

print(f"Bot: {bot.properties.display_name}")
print(f"Endpoint: {bot.properties.endpoint}")
print(f"SKU: {bot.sku.name}")
```

## List Bots in Resource Group

```python
bots = client.bots.list_by_resource_group(resource_group_name=resource_group)

for bot in bots:
    print(f"Bot: {bot.name} - {bot.properties.display_name}")
```

## List All Bots in Subscription

```python
all_bots = client.bots.list()

for bot in all_bots:
    print(f"Bot: {bot.name} in {bot.id.split('/')[4]}")
```

## Update Bot

```python
bot = client.bots.update(
    resource_group_name=resource_group,
    resource_name=bot_name,
    properties=BotProperties(
        display_name="Updated Bot Name",
        description="Updated description"
    )
)
```

## Delete Bot

```python
client.bots.delete(
    resource_group_name=resource_group,
    resource_name=bot_name
)
```

## Configure Channels

### Add Teams Channel

```python
from azure.mgmt.botservice.models import (
    BotChannel,
    MsTeamsChannel,
    MsTeamsChannelProperties
)

channel = client.channels.create(
    resource_group_name=resource_group,
    resource_name=bot_name,
    channel_name="MsTeamsChannel",
    parameters=BotChannel(
        location="global",
        properties=MsTeamsChannel(
            properties=MsTeamsChannelProperties(
                is_enabled=True
            )
        )
    )
)
```

### Add Direct Line Channel

```python
from azure.mgmt.botservice.models import (
    BotChannel,
    DirectLineChannel,
    DirectLineChannelProperties,
    DirectLineSite
)

channel = client.channels.create(
    resource_group_name=resource_group,
    resource_name=bot_name,
    channel_name="DirectLineChannel",
    parameters=BotChannel(
        location="global",
        properties=DirectLineChannel(
            properties=DirectLineChannelProperties(
                sites=[
                    DirectLineSite(
                        site_name="Default Site",
                        is_enabled=True,
                        is_v1_enabled=False,
                        is_v3_enabled=True
                    )
                ]
            )
        )
    )
)
```

### Add Web Chat Channel

```python
from azure.mgmt.botservice.models import (
    BotChannel,
    WebChatChannel,
    WebChatChannelProperties,
    WebChatSite
)

channel = client.channels.create(
    resource_group_name=resource_group,
    resource_name=bot_name,
    channel_name="WebChatChannel",
    parameters=BotChannel(
        location="global",
        properties=WebChatChannel(
            properties=WebChatChannelProperties(
                sites=[
                    WebChatSite(
                        site_name="Default Site",
                        is_enabled=True
                    )
                ]
            )
        )
    )
)
```

## Get Channel Details

```python
channel = client.channels.get(
    resource_group_name=resource_group,
    resource_name=bot_name,
    channel_name="DirectLineChannel"
)
```

## List Channel Keys

```python
keys = client.channels.list_with_keys(
    resource_group_name=resource_group,
    resource_name=bot_name,
    channel_name="DirectLineChannel"
)

# Access Direct Line keys
if hasattr(keys.properties, 'properties'):
    for site in keys.properties.properties.sites:
        print(f"Site: {site.site_name}")
        print(f"Key: {site.key}")
```

## Bot Connections (OAuth)

### Create Connection Setting

```python
from azure.mgmt.botservice.models import (
    ConnectionSetting,
    ConnectionSettingProperties
)

connection = client.bot_connection.create(
    resource_group_name=resource_group,
    resource_name=bot_name,
    connection_name="graph-connection",
    parameters=ConnectionSetting(
        location="global",
        properties=ConnectionSettingProperties(
            client_id="<oauth-client-id>",
            client_secret="<oauth-client-secret>",
            scopes="User.Read",
            service_provider_id="<service-provider-id>"
        )
    )
)
```

### List Connections

```python
connections = client.bot_connection.list_by_bot_service(
    resource_group_name=resource_group,
    resource_name=bot_name
)

for conn in connections:
    print(f"Connection: {conn.name}")
```

## Client Operations

| Operation | Method |
|-----------|--------|
| `client.bots` | Bot CRUD operations |
| `client.channels` | Channel configuration |
| `client.bot_connection` | OAuth connection settings |
| `client.direct_line` | Direct Line channel operations |
| `client.email` | Email channel operations |
| `client.operations` | Available operations |
| `client.host_settings` | Host settings operations |

## SKU Options

| SKU | Description |
|-----|-------------|
| `F0` | Free tier (limited messages) |
| `S1` | Standard tier (unlimited messages) |

## Channel Types

| Channel | Class | Purpose |
|---------|-------|---------|
| `MsTeamsChannel` | Microsoft Teams | Teams integration |
| `DirectLineChannel` | Direct Line | Custom client integration |
| `WebChatChannel` | Web Chat | Embeddable web widget |
| `SlackChannel` | Slack | Slack workspace integration |
| `FacebookChannel` | Facebook | Messenger integration |
| `EmailChannel` | Email | Email communication |

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.xxx` sync clients with `azure.xxx.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use `DefaultAzureCredential`** for code that runs locally. Use a specific token credential for code that runs in Azure.
4. **Start with F0 SKU** for development, upgrade to S1 for production
5. **Store MSA App ID/Secret securely** — use Key Vault
6. **Enable only needed channels** — reduces attack surface
7. **Rotate Direct Line keys** periodically
8. **Use managed identity** when possible for bot connections
9. **Configure proper CORS** for Web Chat channel

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
