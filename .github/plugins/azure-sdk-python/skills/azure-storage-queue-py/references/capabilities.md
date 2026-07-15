# azure-storage-queue-py capability coverage

**SDK/package**: `azure-storage-queue`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Queue Operations`
- `Send Messages`
- `Receive Messages`
- `Peek Messages`

## Non-hero scenarios

- `Update Message`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#update-message`](non-hero-scenarios.md#update-message)
- `Delete Message`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#delete-message`](non-hero-scenarios.md#delete-message)
- `Clear Queue`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#clear-queue`](non-hero-scenarios.md#clear-queue)
- `Queue Properties`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#queue-properties`](non-hero-scenarios.md#queue-properties)
- `Async Client`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#async-client`](non-hero-scenarios.md#async-client)
- `Base64 Encoding`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#base64-encoding`](non-hero-scenarios.md#base64-encoding)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
