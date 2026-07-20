# azure-ai-translation-document-py capability coverage

**SDK/package**: `azure-ai-translation-document`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Basic Document Translation`
- `Multiple Target Languages`
- `Translate Single Document`
- `Check Translation Status`

## Non-hero scenarios

- `List Document Statuses`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#list-document-statuses`](non-hero-scenarios.md#list-document-statuses)
- `Cancel Translation`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#cancel-translation`](non-hero-scenarios.md#cancel-translation)
- `Using Glossary`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#using-glossary`](non-hero-scenarios.md#using-glossary)
- `Supported Document Formats`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#supported-document-formats`](non-hero-scenarios.md#supported-document-formats)
- `Supported Languages`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#supported-languages`](non-hero-scenarios.md#supported-languages)
- `Async Client`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#async-client`](non-hero-scenarios.md#async-client)
- `Supported Formats`: | Category | Formats |  
  See: [`non-hero-scenarios.md#supported-formats`](non-hero-scenarios.md#supported-formats)
- `Storage Requirements`: - Source and target containers must be Azure Blob Storage  
  See: [`non-hero-scenarios.md#storage-requirements`](non-hero-scenarios.md#storage-requirements)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
