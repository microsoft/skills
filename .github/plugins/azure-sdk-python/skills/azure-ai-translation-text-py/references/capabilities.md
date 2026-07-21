# azure-ai-translation-text-py capability coverage

**SDK/package**: `azure-ai-translation-text`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Basic Translation`
- `Translate to Multiple Languages`
- `Specify Source Language`
- `Language Detection`

## Non-hero scenarios

- `Transliteration`: Convert text from one script to another:  
  See: [`non-hero-scenarios.md#transliteration`](non-hero-scenarios.md#transliteration)
- `Dictionary Lookup`: Find alternate translations and definitions:  
  See: [`non-hero-scenarios.md#dictionary-lookup`](non-hero-scenarios.md#dictionary-lookup)
- `Dictionary Examples`: Get usage examples for translations:  
  See: [`non-hero-scenarios.md#dictionary-examples`](non-hero-scenarios.md#dictionary-examples)
- `Get Supported Languages`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#get-supported-languages`](non-hero-scenarios.md#get-supported-languages)
- `Break Sentence`: Identify sentence boundaries:  
  See: [`non-hero-scenarios.md#break-sentence`](non-hero-scenarios.md#break-sentence)
- `Translation Options`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#translation-options`](non-hero-scenarios.md#translation-options)
- `Async Client`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#async-client`](non-hero-scenarios.md#async-client)
- `Client Methods`: | Method | Description |  
  See: [`non-hero-scenarios.md#client-methods`](non-hero-scenarios.md#client-methods)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
