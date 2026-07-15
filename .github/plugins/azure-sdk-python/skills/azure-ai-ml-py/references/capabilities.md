# azure-ai-ml-py capability coverage

**SDK/package**: `azure-ai-ml`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Workspace Management`
- `Data Assets`
- `Model Registry`
- `Compute`

## Non-hero scenarios

- `Jobs`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#jobs`](non-hero-scenarios.md#jobs)
- `Pipelines`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#pipelines`](non-hero-scenarios.md#pipelines)
- `Environments`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#environments`](non-hero-scenarios.md#environments)
- `Datastores`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#datastores`](non-hero-scenarios.md#datastores)
- `MLClient Operations`: | Property | Operations |  
  See: [`non-hero-scenarios.md#mlclient-operations`](non-hero-scenarios.md#mlclient-operations)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
