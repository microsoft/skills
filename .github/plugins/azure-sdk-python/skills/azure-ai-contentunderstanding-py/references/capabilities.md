# azure-ai-contentunderstanding-py capability coverage

**SDK/package**: `azure-ai-contentunderstanding`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Core Workflow`
- `Prebuilt Analyzers`
- `Analyze Document`
- `Access Document Content Details`

## Non-hero scenarios

- `Analyze Image`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#analyze-image`](non-hero-scenarios.md#analyze-image)
- `Analyze Video`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#analyze-video`](non-hero-scenarios.md#analyze-video)
- `Analyze Audio`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#analyze-audio`](non-hero-scenarios.md#analyze-audio)
- `Custom Analyzers`: Create custom analyzers with field schemas for specialized extraction:  
  See: [`non-hero-scenarios.md#custom-analyzers`](non-hero-scenarios.md#custom-analyzers)
- `Analyzer Management`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#analyzer-management`](non-hero-scenarios.md#analyzer-management)
- `Async Client`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#async-client`](non-hero-scenarios.md#async-client)
- `Content Types`: | Class | For | Provides |  
  See: [`non-hero-scenarios.md#content-types`](non-hero-scenarios.md#content-types)
- `Model Imports`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#model-imports`](non-hero-scenarios.md#model-imports)
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
