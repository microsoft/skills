# azure-storage-blob-py capability coverage

**SDK/package**: `azure-storage-blob`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Client Hierarchy`
- `Core Workflow`
- `Performance Tuning`
- `SAS Tokens (User Delegation)`

## Non-hero scenarios

- `Blob Properties and Metadata`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#blob-properties-and-metadata`](non-hero-scenarios.md#blob-properties-and-metadata)
- `Async Client`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#async-client`](non-hero-scenarios.md#async-client)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
