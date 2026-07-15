# azure-monitor-ingestion-py capability coverage

**SDK/package**: `azure-monitor-ingestion`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Upload Custom Logs`
- `Upload from JSON File`
- `Custom Error Handling`
- `Ignore Errors`

## Non-hero scenarios

- `Async Client`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#async-client`](non-hero-scenarios.md#async-client)
- `Sovereign Clouds`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#sovereign-clouds`](non-hero-scenarios.md#sovereign-clouds)
- `Batching Behavior`: The SDK automatically:  
  See: [`non-hero-scenarios.md#batching-behavior`](non-hero-scenarios.md#batching-behavior)
- `Client Types`: | Client | Purpose |  
  See: [`non-hero-scenarios.md#client-types`](non-hero-scenarios.md#client-types)
- `Key Concepts`: | Concept | Description |  
  See: [`non-hero-scenarios.md#key-concepts`](non-hero-scenarios.md#key-concepts)
- `DCR Stream Name Format`: Stream names follow patterns:  
  See: [`non-hero-scenarios.md#dcr-stream-name-format`](non-hero-scenarios.md#dcr-stream-name-format)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
