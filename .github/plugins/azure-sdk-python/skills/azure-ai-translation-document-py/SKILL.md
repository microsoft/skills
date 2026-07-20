---
name: azure-ai-translation-document-py
description: |
  Azure AI Document Translation SDK for batch translation of documents with format preservation. Use for translating Word, PDF, Excel, PowerPoint, and other document formats at scale.
  Triggers: "document translation", "batch translation", "translate documents", "DocumentTranslationClient".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-ai-translation-document
---

# Azure AI Document Translation SDK for Python

Client library for Azure AI Translator document translation service for batch document translation with format preservation.

## Installation

```bash
pip install azure-ai-translation-document
```

## Environment Variables

```bash
AZURE_DOCUMENT_TRANSLATION_ENDPOINT=https://<resource>.cognitiveservices.azure.com  # Required for all auth methods
# Storage for source and target documents
AZURE_SOURCE_CONTAINER_URL=https://<storage>.blob.core.windows.net/<container>?<sas>  # Required for all auth methods
AZURE_TARGET_CONTAINER_URL=https://<storage>.blob.core.windows.net/<container>?<sas>  # Required for all auth methods
AZURE_TOKEN_CREDENTIALS=prod # Required only if DefaultAzureCredential is used in production
AZURE_DOCUMENT_TRANSLATION_KEY=<your-api-key>  # Only required for the legacy API-key auth path below
```

## Authentication & Lifecycle

> **🔑 Two rules apply to every code sample below:**
>
> 1. **Prefer `DefaultAzureCredential`.** It works locally (Azure CLI / VS Code / Developer CLI) and in Azure (managed identity, workload identity) with no code change. Avoid connection strings, account/API keys — they bypass Entra audit and rotation.
>    - Local dev: `DefaultAzureCredential` works as-is.
>    - Production: set `AZURE_TOKEN_CREDENTIALS=prod` (or `AZURE_TOKEN_CREDENTIALS=<specific_credential>`) to constrain the credential chain to production-safe credentials.
> 2. **Wrap every client in a context manager** so HTTP transports, sockets, and token caches are released deterministically:
>    - Sync: `with <Client>(...) as client:`
>    - Async: `async with <Client>(...) as client:` **and** `async with DefaultAzureCredential() as credential:` (from `azure.identity.aio`)
>
> Snippets may abbreviate this setup, but production code should always follow both rules.

```python
import os
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
from azure.ai.translation.document import DocumentTranslationClient

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

with DocumentTranslationClient(
    endpoint=os.environ["AZURE_DOCUMENT_TRANSLATION_ENDPOINT"],
    credential=credential,
) as client:
    statuses = list(client.list_translation_statuses())
```

### Legacy: API Key (existing keyed deployments)

New code should use `DefaultAzureCredential` above. Use `AzureKeyCredential` only if you have an existing keyed deployment that hasn't been migrated to Entra ID yet — for example, regulated environments still completing their Entra rollout.

```python
import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.translation.document import DocumentTranslationClient, SingleDocumentTranslationClient

with DocumentTranslationClient(
    endpoint=os.environ["AZURE_DOCUMENT_TRANSLATION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["AZURE_DOCUMENT_TRANSLATION_KEY"]),
) as client:
    statuses = list(client.list_translation_statuses())

# SingleDocumentTranslationClient accepts the same key-based credential.
```

## Basic Document Translation

```python
from azure.ai.translation.document import DocumentTranslationInput, TranslationTarget

source_url = os.environ["AZURE_SOURCE_CONTAINER_URL"]
target_url = os.environ["AZURE_TARGET_CONTAINER_URL"]

# Start translation job
poller = client.begin_translation(
    inputs=[
        DocumentTranslationInput(
            source_url=source_url,
            targets=[
                TranslationTarget(
                    target_url=target_url,
                    language="es"  # Translate to Spanish
                )
            ]
        )
    ]
)

# Wait for completion
result = poller.result()

print(f"Status: {poller.status()}")
print(f"Documents translated: {poller.details.documents_succeeded_count}")
print(f"Documents failed: {poller.details.documents_failed_count}")
```

## Multiple Target Languages

```python
poller = client.begin_translation(
    inputs=[
        DocumentTranslationInput(
            source_url=source_url,
            targets=[
                TranslationTarget(target_url=target_url_es, language="es"),
                TranslationTarget(target_url=target_url_fr, language="fr"),
                TranslationTarget(target_url=target_url_de, language="de")
            ]
        )
    ]
)
```

## Translate Single Document

```python
from azure.ai.translation.document import SingleDocumentTranslationClient
from azure.identity import DefaultAzureCredential

with open("document.docx", "rb") as f:
    document_content = f.read()

with SingleDocumentTranslationClient(endpoint, DefaultAzureCredential()) as single_client:
    result = single_client.translate(
        body=document_content,
        target_language="es",
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

# Save translated document
with open("document_es.docx", "wb") as f:
    f.write(result)
```

## Check Translation Status

```python
# Get all translation operations
operations = client.list_translation_statuses()

for op in operations:
    print(f"Operation ID: {op.id}")
    print(f"Status: {op.status}")
    print(f"Created: {op.created_on}")
    print(f"Total documents: {op.documents_total_count}")
    print(f"Succeeded: {op.documents_succeeded_count}")
    print(f"Failed: {op.documents_failed_count}")
```

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

```python
# Get supported languages
languages = client.get_supported_languages()

for lang in languages:
    print(f"Language: {lang.name} ({lang.code})")
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

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.xxx` sync clients with `azure.xxx.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use SAS tokens** with minimal required permissions
4. **Monitor long-running operations** with `poller.status()`
5. **Handle document-level errors** by iterating document statuses
6. **Use glossaries** for domain-specific terminology
7. **Separate target containers** for each language
8. **Use async client** for multiple concurrent jobs
9. **Check supported formats** before submitting documents

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
