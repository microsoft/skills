# azure-ai-textanalytics-py capability coverage

**SDK/package**: `azure-ai-textanalytics`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Sentiment Analysis`
- `Entity Recognition`
- `PII Detection`
- `Key Phrase Extraction`

## Non-hero scenarios

- `Language Detection`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#language-detection`](non-hero-scenarios.md#language-detection)
- `Healthcare Text Analytics`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#healthcare-text-analytics`](non-hero-scenarios.md#healthcare-text-analytics)
- `Multiple Analysis (Batch)`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#multiple-analysis-batch`](non-hero-scenarios.md#multiple-analysis-batch)
- `Async Client`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#async-client`](non-hero-scenarios.md#async-client)
- `Client Types`: | Client | Purpose |  
  See: [`non-hero-scenarios.md#client-types`](non-hero-scenarios.md#client-types)
- `Available Operations`: | Method | Description |  
  See: [`non-hero-scenarios.md#available-operations`](non-hero-scenarios.md#available-operations)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
