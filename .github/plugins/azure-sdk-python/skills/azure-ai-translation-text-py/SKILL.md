---
name: azure-ai-translation-text-py
description: |
  Azure AI Text Translation SDK for real-time text translation, transliteration, language detection, and dictionary lookup. Use for translating text content in applications.
  Triggers: "text translation", "translator", "translate text", "transliterate", "TextTranslationClient".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-ai-translation-text
---

# Azure AI Text Translation SDK for Python

Client library for Azure AI Translator text translation service for real-time text translation, transliteration, and language operations.

## Installation

```bash
pip install azure-ai-translation-text
```

## Environment Variables

```bash
AZURE_TRANSLATOR_ENDPOINT=https://<resource>.cognitiveservices.azure.com  # Required for Entra ID auth (must be a custom subdomain endpoint)
AZURE_TOKEN_CREDENTIALS=prod # Required only if DefaultAzureCredential is used in production
# Only required for the legacy API-key auth path below:
AZURE_TRANSLATOR_KEY=<your-api-key>
AZURE_TRANSLATOR_REGION=<your-region>  # e.g., eastus, westus2; required when authenticating with a key against the global endpoint
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
from azure.ai.translation.text import TextTranslationClient

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

with TextTranslationClient(
    endpoint=os.environ["AZURE_TRANSLATOR_ENDPOINT"],
    credential=credential,
) as client:
    result = client.translate(body=["Hello, world!"], to=["es"])
```

### Legacy: API Key (existing keyed deployments)

New code should use `DefaultAzureCredential` above. The Translator service has two specifics that make API-key auth still common in existing deployments:

- **Token-credential auth requires a custom subdomain endpoint** (`https://<resource>.cognitiveservices.azure.com`). If you only have the global endpoint (`https://api.cognitive.microsofttranslator.com`), you must either provision a custom subdomain or stay on the key-based path until you do.
- **Key + region** is the canonical setup against the global endpoint. The region is sent as the `Ocp-Apim-Subscription-Region` header and is required whenever you use a multi-service or global Translator key.

```python
import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.translation.text import TextTranslationClient

# Key + region against the global endpoint (most common keyed setup)
with TextTranslationClient(
    credential=AzureKeyCredential(os.environ["AZURE_TRANSLATOR_KEY"]),
    region=os.environ["AZURE_TRANSLATOR_REGION"],
) as client:
    result = client.translate(body=["Hello, world!"], to=["es"])

# Key against a custom subdomain endpoint (no region required)
with TextTranslationClient(
    endpoint=os.environ["AZURE_TRANSLATOR_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["AZURE_TRANSLATOR_KEY"]),
) as client:
    result = client.translate(body=["Hello, world!"], to=["es"])
```

## Basic Translation

```python
# Translate to a single language
result = client.translate(
    body=["Hello, how are you?", "Welcome to Azure!"],
    to=["es"]  # Spanish
)

for item in result:
    for translation in item.translations:
        print(f"Translated: {translation.text}")
        print(f"Target language: {translation.to}")
```

## Translate to Multiple Languages

```python
result = client.translate(
    body=["Hello, world!"],
    to=["es", "fr", "de", "ja"]  # Spanish, French, German, Japanese
)

for item in result:
    print(f"Source: {item.detected_language.language if item.detected_language else 'unknown'}")
    for translation in item.translations:
        print(f"  {translation.to}: {translation.text}")
```

## Specify Source Language

```python
result = client.translate(
    body=["Bonjour le monde"],
    from_parameter="fr",  # Source is French
    to=["en", "es"]
)
```

## Language Detection

```python
result = client.translate(
    body=["Hola, como estas?"],
    to=["en"]
)

for item in result:
    if item.detected_language:
        print(f"Detected language: {item.detected_language.language}")
        print(f"Confidence: {item.detected_language.score:.2f}")
```

## Transliteration

Convert text from one script to another:

```python
result = client.transliterate(
    body=["konnichiwa"],
    language="ja",
    from_script="Latn",  # From Latin script
    to_script="Jpan"      # To Japanese script
)

for item in result:
    print(f"Transliterated: {item.text}")
    print(f"Script: {item.script}")
```

## Dictionary Lookup

Find alternate translations and definitions:

```python
result = client.lookup_dictionary_entries(
    body=["fly"],
    from_parameter="en",
    to="es"
)

for item in result:
    print(f"Source: {item.normalized_source} ({item.display_source})")
    for translation in item.translations:
        print(f"  Translation: {translation.normalized_target}")
        print(f"  Part of speech: {translation.pos_tag}")
        print(f"  Confidence: {translation.confidence:.2f}")
```

## Dictionary Examples

Get usage examples for translations:

```python
from azure.ai.translation.text.models import DictionaryExampleTextItem

result = client.lookup_dictionary_examples(
    body=[DictionaryExampleTextItem(text="fly", translation="volar")],
    from_parameter="en",
    to="es"
)

for item in result:
    for example in item.examples:
        print(f"Source: {example.source_prefix}{example.source_term}{example.source_suffix}")
        print(f"Target: {example.target_prefix}{example.target_term}{example.target_suffix}")
```

## Get Supported Languages

```python
# Get all supported languages
languages = client.get_supported_languages()

# Translation languages
print("Translation languages:")
for code, lang in languages.translation.items():
    print(f"  {code}: {lang.name} ({lang.native_name})")

# Transliteration languages
print("\nTransliteration languages:")
for code, lang in languages.transliteration.items():
    print(f"  {code}: {lang.name}")
    for script in lang.scripts:
        print(f"    {script.code} -> {[t.code for t in script.to_scripts]}")

# Dictionary languages
print("\nDictionary languages:")
for code, lang in languages.dictionary.items():
    print(f"  {code}: {lang.name}")
```

## Break Sentence

Identify sentence boundaries:

```python
result = client.find_sentence_boundaries(
    body=["Hello! How are you? I hope you are well."],
    language="en"
)

for item in result:
    print(f"Sentence lengths: {item.sent_len}")
```

## Translation Options

```python
result = client.translate(
    body=["Hello, world!"],
    to=["de"],
    text_type="html",           # "plain" or "html"
    profanity_action="Marked",  # "NoAction", "Deleted", "Marked"
    profanity_marker="Asterisk", # "Asterisk", "Tag"
    include_alignment=True,      # Include word alignment
    include_sentence_length=True # Include sentence boundaries
)

for item in result:
    translation = item.translations[0]
    print(f"Translated: {translation.text}")
    if translation.alignment:
        print(f"Alignment: {translation.alignment.proj}")
    if translation.sent_len:
        print(f"Sentence lengths: {translation.sent_len.src_sent_len}")
```

## Async Client

```python
from azure.ai.translation.text.aio import TextTranslationClient
from azure.identity.aio import DefaultAzureCredential

async def translate_text():
    async with DefaultAzureCredential() as credential:
        async with TextTranslationClient(
            credential=credential,
            endpoint=endpoint,
        ) as client:
            result = await client.translate(
                body=["Hello, world!"],
                to=["es"]
            )
            print(result[0].translations[0].text)
```

## Client Methods

| Method | Description |
|--------|-------------|
| `translate` | Translate text to one or more languages |
| `transliterate` | Convert text between scripts |
| `detect` | Detect language of text |
| `find_sentence_boundaries` | Identify sentence boundaries |
| `lookup_dictionary_entries` | Dictionary lookup for translations |
| `lookup_dictionary_examples` | Get usage examples |
| `get_supported_languages` | List supported languages |

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.xxx` sync clients with `azure.xxx.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Batch translations** — Send multiple texts in one request (up to 100)
4. **Specify source language** when known to improve accuracy
5. **Use async client** for high-throughput scenarios
6. **Cache language list** — Supported languages don't change frequently
7. **Handle profanity** appropriately for your application
8. **Use html text_type** when translating HTML content
9. **Include alignment** for applications needing word mapping

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
