# azure-ai-translation-text-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

## Transliteration

Convert text from one script to another:

```python
from azure.ai.translation.text.models import InputTextItem

result = client.transliterate(
    body=[InputTextItem(text="konnichiwa")],
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
from azure.ai.translation.text.models import InputTextItem

result = client.lookup_dictionary_entries(
    body=[InputTextItem(text="fly")],
    from_language="en",
    to_language="es"
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
    from_language="en",
    to_language="es"
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
from azure.ai.translation.text.models import InputTextItem

result = client.find_sentence_boundaries(
    body=[InputTextItem(text="Hello! How are you? I hope you are well.")],
    language="en"
)

for item in result:
    print(f"Sentence lengths: {item.sent_len}")
```

## Translation Options

```python
from azure.ai.translation.text.models import InputTextItem

result = client.translate(
    body=[InputTextItem(text="Hello, world!")],
    to_language=["de"],
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
from azure.ai.translation.text.models import InputTextItem
from azure.identity.aio import DefaultAzureCredential

async def translate_text():
    async with DefaultAzureCredential() as credential:
        async with TextTranslationClient(
            credential=credential,
            endpoint=endpoint,
        ) as client:
            result = await client.translate(
                body=[InputTextItem(text="Hello, world!")],
                to_language=["es"]
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
