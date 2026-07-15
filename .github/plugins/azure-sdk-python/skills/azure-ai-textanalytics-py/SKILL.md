---
name: azure-ai-textanalytics-py
description: |
  Azure AI Text Analytics SDK for sentiment analysis, entity recognition, key phrases, language detection, PII, and healthcare NLP. Use for natural language processing on text.
  Triggers: "text analytics", "sentiment analysis", "entity recognition", "key phrase", "PII detection", "TextAnalyticsClient".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-ai-textanalytics
---

# Azure AI Text Analytics SDK for Python

Client library for Azure AI Language service NLP capabilities including sentiment, entities, key phrases, and more.

## Installation

```bash
pip install azure-ai-textanalytics
```

## Environment Variables

```bash
AZURE_LANGUAGE_ENDPOINT=https://<resource>.cognitiveservices.azure.com  # Required for all auth methods
AZURE_TOKEN_CREDENTIALS=prod # Required only if DefaultAzureCredential is used in production
AZURE_LANGUAGE_KEY=<your-api-key>  # Only required for the legacy API-key auth path below
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
from azure.ai.textanalytics import TextAnalyticsClient

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

with TextAnalyticsClient(
    endpoint=os.environ["AZURE_LANGUAGE_ENDPOINT"],
    credential=credential,
) as client:
    languages = client.detect_language(["Hello, world!"])
```

### Legacy: API Key (existing keyed deployments)

New code should use `DefaultAzureCredential` above. Use `AzureKeyCredential` only if you have an existing keyed deployment that hasn't been migrated to Entra ID yet — for example, regulated environments still completing their Entra rollout.

```python
import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.textanalytics import TextAnalyticsClient

with TextAnalyticsClient(
    endpoint=os.environ["AZURE_LANGUAGE_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["AZURE_LANGUAGE_KEY"]),
) as client:
    languages = client.detect_language(["Hello, world!"])
```

## Sentiment Analysis

```python
documents = [
    "I had a wonderful trip to Seattle last week!",
    "The food was terrible and the service was slow."
]

result = client.analyze_sentiment(documents, show_opinion_mining=True)

for doc in result:
    if not doc.is_error:
        print(f"Sentiment: {doc.sentiment}")
        print(f"Scores: pos={doc.confidence_scores.positive:.2f}, "
              f"neg={doc.confidence_scores.negative:.2f}, "
              f"neu={doc.confidence_scores.neutral:.2f}")
        
        # Opinion mining (aspect-based sentiment)
        for sentence in doc.sentences:
            for opinion in sentence.mined_opinions:
                target = opinion.target
                print(f"  Target: '{target.text}' - {target.sentiment}")
                for assessment in opinion.assessments:
                    print(f"    Assessment: '{assessment.text}' - {assessment.sentiment}")
```

## Entity Recognition

```python
documents = ["Microsoft was founded by Bill Gates and Paul Allen in Albuquerque."]

result = client.recognize_entities(documents)

for doc in result:
    if not doc.is_error:
        for entity in doc.entities:
            print(f"Entity: {entity.text}")
            print(f"  Category: {entity.category}")
            print(f"  Subcategory: {entity.subcategory}")
            print(f"  Confidence: {entity.confidence_score:.2f}")
```

## PII Detection

```python
documents = ["My SSN is 123-45-6789 and my email is john@example.com"]

result = client.recognize_pii_entities(documents)

for doc in result:
    if not doc.is_error:
        print(f"Redacted: {doc.redacted_text}")
        for entity in doc.entities:
            print(f"PII: {entity.text} ({entity.category})")
```

## Key Phrase Extraction

```python
documents = ["Azure AI provides powerful machine learning capabilities for developers."]

result = client.extract_key_phrases(documents)

for doc in result:
    if not doc.is_error:
        print(f"Key phrases: {doc.key_phrases}")
```

## Language Detection

```python
documents = ["Ce document est en francais.", "This is written in English."]

result = client.detect_language(documents)

for doc in result:
    if not doc.is_error:
        print(f"Language: {doc.primary_language.name} ({doc.primary_language.iso6391_name})")
        print(f"Confidence: {doc.primary_language.confidence_score:.2f}")
```

## Healthcare Text Analytics

```python
documents = ["Patient has diabetes and was prescribed metformin 500mg twice daily."]

poller = client.begin_analyze_healthcare_entities(documents)
result = poller.result()

for doc in result:
    if not doc.is_error:
        for entity in doc.entities:
            print(f"Entity: {entity.text}")
            print(f"  Category: {entity.category}")
            print(f"  Normalized: {entity.normalized_text}")
            
            # Entity links (UMLS, etc.)
            for link in entity.data_sources:
                print(f"  Link: {link.name} - {link.entity_id}")
```

## Multiple Analysis (Batch)

```python
from azure.ai.textanalytics import (
    RecognizeEntitiesAction,
    ExtractKeyPhrasesAction,
    AnalyzeSentimentAction
)

documents = ["Microsoft announced new Azure AI features at Build conference."]

poller = client.begin_analyze_actions(
    documents,
    actions=[
        RecognizeEntitiesAction(),
        ExtractKeyPhrasesAction(),
        AnalyzeSentimentAction()
    ]
)

results = poller.result()
for doc_results in results:
    for result in doc_results:
        if result.kind == "EntityRecognition":
            print(f"Entities: {[e.text for e in result.entities]}")
        elif result.kind == "KeyPhraseExtraction":
            print(f"Key phrases: {result.key_phrases}")
        elif result.kind == "SentimentAnalysis":
            print(f"Sentiment: {result.sentiment}")
```

## Async Client

```python
from azure.ai.textanalytics.aio import TextAnalyticsClient
from azure.identity.aio import DefaultAzureCredential

async def analyze():
    async with DefaultAzureCredential() as credential:
        async with TextAnalyticsClient(
            endpoint=endpoint,
            credential=credential
        ) as client:
            result = await client.analyze_sentiment(documents)
            # Process results...
```

## Client Types

| Client | Purpose |
|--------|---------|
| `TextAnalyticsClient` | All text analytics operations |
| `TextAnalyticsClient` (aio) | Async version |

## Available Operations

| Method | Description |
|--------|-------------|
| `analyze_sentiment` | Sentiment analysis with opinion mining |
| `recognize_entities` | Named entity recognition |
| `recognize_pii_entities` | PII detection and redaction |
| `recognize_linked_entities` | Entity linking to Wikipedia |
| `extract_key_phrases` | Key phrase extraction |
| `detect_language` | Language detection |
| `begin_analyze_healthcare_entities` | Healthcare NLP (long-running) |
| `begin_analyze_actions` | Multiple analyses in batch |

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.ai.textanalytics` sync clients with `azure.ai.textanalytics.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with TextAnalyticsClient(...) as client:` (sync) or `async with TextAnalyticsClient(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use batch operations** for multiple documents (up to 10 per request)
4. **Enable opinion mining** for detailed aspect-based sentiment
5. **Use async client** for high-throughput scenarios
6. **Handle document errors** — results list may contain errors for some docs
7. **Specify language** when known to improve accuracy

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
