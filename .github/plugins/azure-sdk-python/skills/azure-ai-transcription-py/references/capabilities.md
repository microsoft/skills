# azure-ai-transcription-py capability coverage

**SDK/package**: `azure-ai-transcription`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Transcription (Batch)`
- `Transcription (Real-time)`

## Non-hero scenarios

- `Operational hardening`: Use this section for retries, timeouts, pagination, and cleanup patterns specific to this SDK.  
  See: [`non-hero-scenarios.md#operational-hardening`](non-hero-scenarios.md#operational-hardening)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
