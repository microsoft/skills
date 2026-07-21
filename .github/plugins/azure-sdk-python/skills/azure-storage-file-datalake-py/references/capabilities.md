# azure-storage-file-datalake-py capability coverage

**SDK/package**: `azure-storage-file-datalake`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Client Hierarchy`
- `File System Operations`
- `Directory Operations`
- `File Operations`

## Non-hero scenarios

- `List Contents`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#list-contents`](non-hero-scenarios.md#list-contents)
- `File/Directory Properties`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#filedirectory-properties`](non-hero-scenarios.md#filedirectory-properties)
- `Access Control (ACL)`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#access-control-acl`](non-hero-scenarios.md#access-control-acl)
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
