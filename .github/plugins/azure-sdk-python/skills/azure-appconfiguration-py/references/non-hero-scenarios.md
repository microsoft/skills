# azure-appconfiguration-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

## Snapshots

### Create Snapshot

```python
from azure.appconfiguration import ConfigurationSnapshot, ConfigurationSettingsFilter

snapshot = ConfigurationSnapshot(
    filters=[
        ConfigurationSettingsFilter(key="app:*", label="production")
    ]
)

created = client.begin_create_snapshot(
    name="v1-snapshot",
    snapshot=snapshot
).result()
```

### List Snapshot Settings

```python
settings = client.list_configuration_settings(
    snapshot_name="v1-snapshot"
)
```

## Async Client

```python
from azure.appconfiguration.aio import AzureAppConfigurationClient
from azure.identity.aio import DefaultAzureCredential

async def main():
    async with DefaultAzureCredential() as credential:
        async with AzureAppConfigurationClient(
            base_url=endpoint,
            credential=credential
        ) as client:
            setting = await client.get_configuration_setting(key="app:message")
            print(setting.value)
```

## Client Operations

| Operation | Description |
|-----------|-------------|
| `get_configuration_setting` | Get single setting |
| `set_configuration_setting` | Create or update setting |
| `delete_configuration_setting` | Delete setting |
| `list_configuration_settings` | List with filters |
| `set_read_only` | Lock/unlock setting |
| `begin_create_snapshot` | Create point-in-time snapshot |
| `list_snapshots` | List all snapshots |
