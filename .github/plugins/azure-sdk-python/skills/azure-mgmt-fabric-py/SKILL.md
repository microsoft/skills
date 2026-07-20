---
name: azure-mgmt-fabric-py
description: |-
  Azure Fabric Management SDK for Python. Use for managing Microsoft Fabric capacities and resources.
  Triggers: "azure-mgmt-fabric", "FabricMgmtClient", "Fabric capacity", "Microsoft Fabric", "Power BI capacity".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Fabric Management SDK for Python

Manage Microsoft Fabric capacities and resources programmatically.

## Installation

```bash
pip install azure-mgmt-fabric
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
from azure.mgmt.fabric import FabricMgmtClient
import os

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

with FabricMgmtClient(
    credential=credential,
    subscription_id=os.environ["AZURE_SUBSCRIPTION_ID"]
) as client:
    # Use `client` for all subsequent operations (see examples below)
    ...
```

## Create Fabric Capacity

```python
from azure.mgmt.fabric import FabricMgmtClient
from azure.mgmt.fabric.models import FabricCapacity, FabricCapacityProperties, CapacitySku
from azure.identity import DefaultAzureCredential
import os

resource_group = os.environ["AZURE_RESOURCE_GROUP"]
capacity_name = "myfabriccapacity"

credential = DefaultAzureCredential()
with FabricMgmtClient(
    credential=credential,
    subscription_id=os.environ["AZURE_SUBSCRIPTION_ID"]
) as client:
    capacity = client.fabric_capacities.begin_create_or_update(
        resource_group_name=resource_group,
        capacity_name=capacity_name,
        resource=FabricCapacity(
            location="eastus",
            sku=CapacitySku(
                name="F2",  # Fabric SKU
                tier="Fabric"
            ),
            properties=FabricCapacityProperties(
                administration=FabricCapacityAdministration(
                    members=["user@contoso.com"]
                )
            )
        )
    ).result()

print(f"Capacity created: {capacity.name}")
```

## Get Capacity Details

```python
capacity = client.fabric_capacities.get(
    resource_group_name=resource_group,
    capacity_name=capacity_name
)

print(f"Capacity: {capacity.name}")
print(f"SKU: {capacity.sku.name}")
print(f"State: {capacity.properties.state}")
print(f"Location: {capacity.location}")
```

## List Capacities in Resource Group

```python
capacities = client.fabric_capacities.list_by_resource_group(
    resource_group_name=resource_group
)

for capacity in capacities:
    print(f"Capacity: {capacity.name} - SKU: {capacity.sku.name}")
```

## List All Capacities in Subscription

```python
all_capacities = client.fabric_capacities.list_by_subscription()

for capacity in all_capacities:
    print(f"Capacity: {capacity.name} in {capacity.location}")
```

## Update Capacity

```python
from azure.mgmt.fabric.models import FabricCapacityUpdate, CapacitySku

updated = client.fabric_capacities.begin_update(
    resource_group_name=resource_group,
    capacity_name=capacity_name,
    properties=FabricCapacityUpdate(
        sku=CapacitySku(
            name="F4",  # Scale up
            tier="Fabric"
        ),
        tags={"environment": "production"}
    )
).result()

print(f"Updated SKU: {updated.sku.name}")
```

## Suspend Capacity

Pause capacity to stop billing:

```python
client.fabric_capacities.begin_suspend(
    resource_group_name=resource_group,
    capacity_name=capacity_name
).result()

print("Capacity suspended")
```

## Resume Capacity

Resume a paused capacity:

```python
client.fabric_capacities.begin_resume(
    resource_group_name=resource_group,
    capacity_name=capacity_name
).result()

print("Capacity resumed")
```

## Delete Capacity

```python
client.fabric_capacities.begin_delete(
    resource_group_name=resource_group,
    capacity_name=capacity_name
).result()

print("Capacity deleted")
```

## Check Name Availability

```python
from azure.mgmt.fabric.models import CheckNameAvailabilityRequest

result = client.fabric_capacities.check_name_availability(
    location="eastus",
    body=CheckNameAvailabilityRequest(
        name="my-new-capacity",
        type="Microsoft.Fabric/capacities"
    )
)

if result.name_available:
    print("Name is available")
else:
    print(f"Name not available: {result.reason}")
```

## List Available SKUs

```python
skus = client.fabric_capacities.list_skus(
    resource_group_name=resource_group,
    capacity_name=capacity_name
)

for sku in skus:
    print(f"SKU: {sku.name} - Tier: {sku.tier}")
```

## Client Operations

| Operation | Method |
|-----------|--------|
| `client.fabric_capacities` | Capacity CRUD operations |
| `client.operations` | List available operations |

## Fabric SKUs

| SKU | Description | CUs |
|-----|-------------|-----|
| `F2` | Entry level | 2 Capacity Units |
| `F4` | Small | 4 Capacity Units |
| `F8` | Medium | 8 Capacity Units |
| `F16` | Large | 16 Capacity Units |
| `F32` | X-Large | 32 Capacity Units |
| `F64` | 2X-Large | 64 Capacity Units |
| `F128` | 4X-Large | 128 Capacity Units |
| `F256` | 8X-Large | 256 Capacity Units |
| `F512` | 16X-Large | 512 Capacity Units |
| `F1024` | 32X-Large | 1024 Capacity Units |
| `F2048` | 64X-Large | 2048 Capacity Units |

## Capacity States

| State | Description |
|-------|-------------|
| `Active` | Capacity is running |
| `Paused` | Capacity is suspended (no billing) |
| `Provisioning` | Being created |
| `Updating` | Being modified |
| `Deleting` | Being removed |
| `Failed` | Operation failed |

## Long-Running Operations

All mutating operations are long-running (LRO). Use `.result()` to wait:

```python
# Synchronous wait
capacity = client.fabric_capacities.begin_create_or_update(...).result()

# Or poll manually
poller = client.fabric_capacities.begin_create_or_update(...)
while not poller.done():
    print(f"Status: {poller.status()}")
    time.sleep(5)
capacity = poller.result()
```

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.xxx` sync clients with `azure.xxx.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use `DefaultAzureCredential`** for code that runs locally. Use a specific token credential for code that runs in Azure.
4. **Suspend unused capacities** to reduce costs
5. **Start with smaller SKUs** and scale up as needed
6. **Use tags** for cost tracking and organization
7. **Check name availability** before creating capacities
8. **Handle LRO properly** — don't assume immediate completion
9. **Set up capacity admins** — specify users who can manage workspaces
10. **Monitor capacity usage** via Azure Monitor metrics

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
