# azure-ai-translation-document-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

## List Document Statuses

```python
# Get status of individual documents in a job
operation_id = poller.id
document_statuses = client.list_document_statuses(operation_id)

for doc in document_statuses:
    print(f"Document: {doc.source_document_url}")
    print(f"  Status: {doc.status}")
    print(f"  Translated to: {doc.translated_to}")
    if doc.error:
        print(f"  Error: {doc.error.message}")
```

## Cancel Translation

```python
# Cancel a running translation
client.cancel_translation(operation_id)
```

## Using Glossary

```python
from azure.ai.translation.document import TranslationGlossary

poller = client.begin_translation(
    inputs=[
        DocumentTranslationInput(
            source_url=source_url,
            targets=[
                TranslationTarget(
                    target_url=target_url,
                    language="es",
                    glossaries=[
                        TranslationGlossary(
                            glossary_url="https://<storage>.blob.core.windows.net/glossary/terms.csv?<sas>",
                            file_format="csv"
                        )
                    ]
                )
            ]
        )
    ]
)
```

## Supported Document Formats

```python
# Get supported formats
formats = client.get_supported_document_formats()

for fmt in formats:
    print(f"Format: {fmt.format}")
    print(f"  Extensions: {fmt.file_extensions}")
    print(f"  Content types: {fmt.content_types}")
```

## Supported Languages

`DocumentTranslationClient` does not expose a language discovery method. Use `TextTranslationClient`
from `azure-ai-translation-text` instead — its `get_supported_languages()` call requires no
authentication:

```python
from azure.ai.translation.text import TextTranslationClient

# Languages endpoint requires no credential; default endpoint is https://api.cognitive.microsofttranslator.com
text_client = TextTranslationClient()  # no credential needed for this call
result = text_client.get_supported_languages()

# result.translation is a dict: BCP 47 code -> TranslationLanguage
for code, lang in result.translation.items():
    print(f"Language: {lang.name} ({code})")
```

## Async Client

```python
from azure.ai.translation.document.aio import DocumentTranslationClient
from azure.identity.aio import DefaultAzureCredential

async def translate_documents():
    async with DefaultAzureCredential() as credential:
        async with DocumentTranslationClient(
            endpoint=endpoint,
            credential=credential,
        ) as client:
            poller = await client.begin_translation(inputs=[...])
            result = await poller.result()
```

## Supported Formats

| Category | Formats |
|----------|---------|
| Documents | DOCX, PDF, PPTX, XLSX, HTML, TXT, RTF |
| Structured | CSV, TSV, JSON, XML |
| Localization | XLIFF, XLF, MHTML |

## Storage Requirements

- Source and target containers must be Azure Blob Storage
- Use SAS tokens with appropriate permissions:
  - Source: Read, List
  - Target: Write, List
