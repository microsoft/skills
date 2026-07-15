# azure-ai-contentsafety-py capability coverage

**SDK/package**: `azure-ai-contentsafety`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Analyze Text`
- `Analyze Image`
- `Text Blocklist Management`
- `Severity Levels`

## Non-hero scenarios

- `Harm Categories`: | Category | Description |  
  See: [`non-hero-scenarios.md#harm-categories`](non-hero-scenarios.md#harm-categories)
- `Severity Scale`: | Level | Text Range | Image Range | Meaning |  
  See: [`non-hero-scenarios.md#severity-scale`](non-hero-scenarios.md#severity-scale)
- `Client Types`: | Client | Purpose |  
  See: [`non-hero-scenarios.md#client-types`](non-hero-scenarios.md#client-types)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
