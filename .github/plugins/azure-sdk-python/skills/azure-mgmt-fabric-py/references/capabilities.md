# azure-mgmt-fabric-py capability coverage

**SDK/package**: `azure-mgmt-fabric`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Create Fabric Capacity`
- `Get Capacity Details`
- `List Capacities in Resource Group`
- `List All Capacities in Subscription`

## Non-hero scenarios

- `Update Capacity`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#update-capacity`](non-hero-scenarios.md#update-capacity)
- `Suspend Capacity`: Pause capacity to stop billing:  
  See: [`non-hero-scenarios.md#suspend-capacity`](non-hero-scenarios.md#suspend-capacity)
- `Resume Capacity`: Resume a paused capacity:  
  See: [`non-hero-scenarios.md#resume-capacity`](non-hero-scenarios.md#resume-capacity)
- `Delete Capacity`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#delete-capacity`](non-hero-scenarios.md#delete-capacity)
- `Check Name Availability`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#check-name-availability`](non-hero-scenarios.md#check-name-availability)
- `List Available SKUs`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#list-available-skus`](non-hero-scenarios.md#list-available-skus)
- `Client Operations`: | Operation | Method |  
  See: [`non-hero-scenarios.md#client-operations`](non-hero-scenarios.md#client-operations)
- `Fabric SKUs`: | SKU | Description | CUs |  
  See: [`non-hero-scenarios.md#fabric-skus`](non-hero-scenarios.md#fabric-skus)
- `Capacity States`: | State | Description |  
  See: [`non-hero-scenarios.md#capacity-states`](non-hero-scenarios.md#capacity-states)
- `Long-Running Operations`: All mutating operations are long-running (LRO). Use `.result()` to wait:  
  See: [`non-hero-scenarios.md#long-running-operations`](non-hero-scenarios.md#long-running-operations)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
