# azure-mgmt-fabric-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

## Update Capacity

```python
from azure.mgmt.fabric.models import FabricCapacityUpdate, RpSku

updated = client.fabric_capacities.begin_update(
    resource_group_name=resource_group,
    capacity_name=capacity_name,
    properties=FabricCapacityUpdate(
        sku=RpSku(
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
skus = client.fabric_capacities.list_skus()

for sku in skus:
    locations = ", ".join(sku.locations) if sku.locations is not None else "N/A"
    print(f"SKU: {sku.name} - Locations: {locations}")
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
