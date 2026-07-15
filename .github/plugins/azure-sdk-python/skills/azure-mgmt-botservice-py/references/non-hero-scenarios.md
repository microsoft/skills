# azure-mgmt-botservice-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

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
        # Use site.key without logging or persisting it.
```

## Bot Connections (OAuth)

### Create Connection Setting

```python
import os
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
            client_secret=os.environ["OAUTH_CLIENT_SECRET"],
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
