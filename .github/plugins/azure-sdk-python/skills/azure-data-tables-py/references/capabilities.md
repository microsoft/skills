# azure-data-tables-py capability coverage

**SDK/package**: `azure-data-tables`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Client Types`
- `Table Operations`
- `Entity Operations`
- `Query Entities`

## Non-hero scenarios

- `Batch Operations`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#batch-operations`](non-hero-scenarios.md#batch-operations)
- `Async Client`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#async-client`](non-hero-scenarios.md#async-client)
- `Data Types`: | Python Type | Table Storage Type |  
  See: [`non-hero-scenarios.md#data-types`](non-hero-scenarios.md#data-types)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
