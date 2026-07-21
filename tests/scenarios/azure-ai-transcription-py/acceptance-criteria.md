# Azure AI Transcription SDK Acceptance Criteria

**SDK**: `azure-ai-transcription`
**Repository**: https://github.com/Azure/azure-sdk-for-python
**Purpose**: Skill testing acceptance criteria for validating generated code correctness

---

## 1. Correct Import Patterns

### 1.1 Client Imports

#### ✅ CORRECT: Subscription Key Authentication
```python
import os
from azure.ai.transcription import TranscriptionClient
from azure.core.credentials import AzureKeyCredential

client = TranscriptionClient(
    endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"])
)
```

#### ✅ CORRECT: Entra ID / DefaultAzureCredential (preferred for production)
```python
import os
from azure.ai.transcription import TranscriptionClient
from azure.identity import DefaultAzureCredential

client = TranscriptionClient(
    endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
    credential=DefaultAzureCredential()
)
```

#### ✅ CORRECT: Using environment variables
```python
from azure.ai.transcription import TranscriptionClient
from azure.core.credentials import AzureKeyCredential

endpoint = os.environ.get("TRANSCRIPTION_ENDPOINT")
key = os.environ.get("TRANSCRIPTION_KEY")
client = TranscriptionClient(endpoint=endpoint, credential=AzureKeyCredential(key))
```

### 1.2 Model Imports

#### ✅ CORRECT: Transcription Models
```python
from azure.ai.transcription.models import (
    TranscriptionOptions,
    TranscriptionResult,
    RecognizedPhrase,
    DiarizeSettings,
)
```

#### ✅ CORRECT: Streaming Models
```python
from azure.ai.transcription.models import (
    StreamTranscriptionOptions,
    StreamTranscriptionResult,
)
```

### 1.3 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Importing from wrong module
```python
# WRONG - TranscriptionClient is at top level
from azure.ai.transcription.client import TranscriptionClient
```

#### ❌ INCORRECT: Hardcoding credentials
```python
# WRONG - credentials should never be hardcoded
client = TranscriptionClient(
    endpoint="https://my-resource.cognitiveservices.azure.com",
    credential=AzureKeyCredential("my-hardcoded-key")
)
```

---

## 2. Batch Transcription Patterns

### 2.1 ✅ CORRECT: Basic Batch Transcription
```python
import os
from azure.ai.transcription import TranscriptionClient
from azure.core.credentials import AzureKeyCredential

client = TranscriptionClient(
    endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"])
)

# Begin transcription job
job = client.begin_transcription(
    name="my-transcription",
    locale="en-US",
    content_urls=["https://storage.example.com/audio.wav"]
)

# Wait for completion
result = job.result()

if result.status == "succeeded":
    print(f"Transcription complete: {result.results}")
elif result.status == "failed":
    print(f"Transcription failed: {result.error}")
```

### 2.2 ✅ CORRECT: Batch with Diarization
```python
job = client.begin_transcription(
    name="meeting-transcription",
    locale="en-US",
    content_urls=["https://storage.example.com/meeting.wav"],
    diarization_enabled=True,
    diarize_max_speakers=5
)

result = job.result()

# Access diarization results
for phrase in result.results:
    if hasattr(phrase, "speaker") and phrase.speaker:
        print(f"Speaker {phrase.speaker}: {phrase.text}")
    else:
        print(f"Unknown: {phrase.text}")
```

### 2.3 ✅ CORRECT: Batch with Timestamps
```python
job = client.begin_transcription(
    name="timestamped-transcription",
    locale="en-US",
    content_urls=["https://storage.example.com/audio.wav"]
)

result = job.result()

for phrase in result.results:
    if hasattr(phrase, "offset") and hasattr(phrase, "duration"):
        start_sec = phrase.offset / 10_000_000  # Convert from 100-nanosecond units
        duration_sec = phrase.duration / 10_000_000
        end_sec = start_sec + duration_sec
        print(f"[{start_sec:.2f}s - {end_sec:.2f}s] {phrase.text}")
    else:
        print(phrase.text)
```

### 2.4 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Not checking job status
```python
# WRONG - assuming job succeeded without checking
job = client.begin_transcription(...)
result = job.result()
print(result.results[0])  # May fail if status != "succeeded"
```

#### ❌ INCORRECT: Using wrong parameter names
```python
# WRONG - parameter is content_urls, not audio_urls
job = client.begin_transcription(
    name="transcription",
    locale="en-US",
    audio_urls=["https://..."]  # Should be content_urls
)
```

#### ❌ INCORRECT: Missing locale
```python
# WRONG - locale is required for language specification
job = client.begin_transcription(
    name="transcription",
    content_urls=["https://..."]
    # Missing locale - will fail
)
```

---

## 3. Real-Time Streaming Patterns

### 3.1 ✅ CORRECT: Basic Streaming Transcription
```python
import os
from azure.ai.transcription import TranscriptionClient
from azure.core.credentials import AzureKeyCredential

client = TranscriptionClient(
    endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"])
)

# Start streaming transcription
stream = client.begin_stream_transcription(locale="en-US")

# Send audio data
with open("audio.wav", "rb") as audio_file:
    stream.send_audio(audio_file.read())

stream.stop()

# Process results as they arrive
for event in stream:
    if event.result:
        print(f"Text: {event.result.text}")
        if event.result.is_final:
            print("Final result received")
```

### 3.2 ✅ CORRECT: Streaming with Phrase-level Results
```python
stream = client.begin_stream_transcription(
    locale="en-US"
)

# Send audio
with open("audio.wav", "rb") as f:
    stream.send_audio(f.read())

stream.stop()

# Access phrase-level details
for event in stream:
    if event.result and hasattr(event.result, "phrases"):
        for phrase in event.result.phrases:
            print(f"{phrase.text}")
            if hasattr(phrase, "confidence"):
                print(f"Confidence: {phrase.confidence}")
```

### 3.3 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Not closing stream
```python
# WRONG - stream not properly closed
stream = client.begin_stream_transcription(locale="en-US")
stream.send_audio(audio_data)
# Missing: stream.stop()
# Stream resources not released
```

#### ❌ INCORRECT: Sending audio after stop
```python
# WRONG - cannot send audio after stream is stopped
stream = client.begin_stream_transcription(locale="en-US")
stream.stop()
stream.send_audio(audio_data)  # Will fail
```

#### ❌ INCORRECT: Not checking is_final flag
```python
# WRONG - processing non-final results as complete
for event in stream:
    if event.result:
        # This will trigger for partial results too
        final_text = event.result.text  # Not necessarily final
```

---

## 4. Timestamp and Timing Patterns

### 4.1 ✅ CORRECT: Extract Timestamps for Subtitles
```python
def generate_subtitles(job_result):
    """Convert transcription results to subtitle format."""
    subtitles = []
    
    for phrase in job_result.results:
        if hasattr(phrase, "offset") and hasattr(phrase, "duration"):
            # Convert from 100-nanosecond units to seconds
            start_ms = (phrase.offset / 10_000_000) * 1000
            duration_ms = (phrase.duration / 10_000_000) * 1000
            end_ms = start_ms + duration_ms
            
            subtitle = {
                "start": format_timestamp(start_ms),
                "end": format_timestamp(end_ms),
                "text": phrase.text
            }
            subtitles.append(subtitle)
    
    return subtitles

def format_timestamp(milliseconds):
    """Format milliseconds to HH:MM:SS,mmm for SRT format."""
    seconds = int(milliseconds // 1000)
    ms = int(milliseconds % 1000)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"
```

### 4.2 ✅ CORRECT: Word-level Timing
```python
for phrase in result.results:
    # Check if word-level timings are available
    if hasattr(phrase, "words") and phrase.words:
        for word in phrase.words:
            if hasattr(word, "offset") and hasattr(word, "duration"):
                word_start = word.offset / 10_000_000
                word_duration = word.duration / 10_000_000
                print(f"{word.text}: {word_start:.2f}s - {word_start + word_duration:.2f}s")
    else:
        # Fallback to phrase-level timing
        phrase_start = phrase.offset / 10_000_000
        print(f"{phrase.text}: {phrase_start:.2f}s")
```

### 4.3 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Using raw offset/duration without conversion
```python
# WRONG - not converting from 100-nanosecond units
start_sec = phrase.offset  # Will be huge number like 2000000
duration_sec = phrase.duration
```

#### ❌ INCORRECT: Assuming all phrases have timestamps
```python
# WRONG - not checking if offset/duration exist
for phrase in result.results:
    start = phrase.offset / 10_000_000  # May fail if not available
```

---

## 5. Diarization Patterns

### 5.1 ✅ CORRECT: Speaker Identification
```python
job = client.begin_transcription(
    name="speaker-diarization",
    locale="en-US",
    content_urls=["https://storage.example.com/meeting.wav"],
    diarization_enabled=True,
    diarize_max_speakers=4  # Specify expected speaker count
)

result = job.result()

if result.status == "succeeded":
    for phrase in result.results:
        speaker_id = getattr(phrase, "speaker", None)
        text = phrase.text
        
        if speaker_id is not None:
            print(f"Speaker {speaker_id}: {text}")
        else:
            print(f"Unknown: {text}")
```

### 5.2 ✅ CORRECT: Diarization with Confidence
```python
for phrase in result.results:
    speaker = getattr(phrase, "speaker", None)
    confidence = getattr(phrase, "speaker_confidence", None)
    
    if speaker is not None and confidence is not None:
        print(f"Speaker {speaker} (confidence: {confidence:.2%}): {phrase.text}")
    else:
        print(f"{phrase.text}")
```

### 5.3 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Not using getattr for optional fields
```python
# WRONG - will fail with AttributeError if speaker field doesn't exist
for phrase in result.results:
    speaker = phrase.speaker  # May not exist without diarization
    print(f"Speaker {speaker}: {phrase.text}")
```

#### ❌ INCORRECT: Setting diarize_max_speakers incorrectly
```python
# WRONG - max_speakers should match actual speakers
job = client.begin_transcription(
    name="transcription",
    locale="en-US",
    content_urls=["..."],
    diarization_enabled=True,
    diarize_max_speakers=50  # Unrealistic for most meetings
)
```

---

## 6. Context Manager and Resource Management

### 6.1 ✅ CORRECT: Using Context Manager
```python
from azure.ai.transcription import TranscriptionClient
from azure.core.credentials import AzureKeyCredential

with TranscriptionClient(
    endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"])
) as client:
    job = client.begin_transcription(
        name="transcription",
        locale="en-US",
        content_urls=["https://..."]
    )
    result = job.result()
    print(result.status)
```

### 6.2 ✅ CORRECT: Manual Resource Cleanup
```python
client = TranscriptionClient(
    endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"])
)

try:
    job = client.begin_transcription(...)
    result = job.result()
finally:
    client.close()
```

### 6.3 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Not closing client
```python
# WRONG - client resources not released
client = TranscriptionClient(endpoint=endpoint, credential=cred)
job = client.begin_transcription(...)
result = job.result()
# Missing: client.close() or context manager
```

---

## 7. Error Handling Patterns

### 7.1 ✅ CORRECT: Check Result Status
```python
job = client.begin_transcription(
    name="transcription",
    locale="en-US",
    content_urls=["https://storage.example.com/audio.wav"]
)

result = job.result()

if result.status == "succeeded":
    print("Transcription successful")
    for phrase in result.results:
        print(phrase.text)
elif result.status == "failed":
    print(f"Transcription failed: {result.error}")
else:
    print(f"Unknown status: {result.status}")
```

### 7.2 ✅ CORRECT: Handle Streaming Errors
```python
try:
    stream = client.begin_stream_transcription(locale="en-US")
    stream.send_audio(audio_data)
    stream.stop()
    
    for event in stream:
        if event.error:
            print(f"Stream error: {event.error}")
        elif event.result:
            print(f"Result: {event.result.text}")
except Exception as e:
    print(f"Transcription error: {str(e)}")
finally:
    if 'stream' in locals():
        stream.close()
```

### 7.3 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Ignoring job status
```python
# WRONG - accessing results without checking status
job = client.begin_transcription(...)
result = job.result()
print(result.results[0])  # Will fail if status == "failed"
```

#### ❌ INCORRECT: Not handling streaming exceptions
```python
# WRONG - no error handling
stream = client.begin_stream_transcription(locale="en-US")
for event in stream:
    print(event.result.text)  # May crash if error event
```

---

## 8. Environment Variables

### Required Variables
```bash
TRANSCRIPTION_ENDPOINT=https://<resource>.cognitiveservices.azure.com
TRANSCRIPTION_KEY=<your-subscription-key>
```

### Common Patterns
```python
import os

endpoint = os.environ.get("TRANSCRIPTION_ENDPOINT")
key = os.environ.get("TRANSCRIPTION_KEY")

if not endpoint or not key:
    raise ValueError("Missing required environment variables")

client = TranscriptionClient(
    endpoint=endpoint,
    credential=AzureKeyCredential(key)
)
```

---

## 9. Locale/Language Reference

### ✅ CORRECT: Supported Locales
```python
# Some common supported locales:
# en-US, en-GB, es-ES, fr-FR, de-DE, it-IT, ja-JP, zh-CN, etc.

job = client.begin_transcription(
    name="transcription",
    locale="es-ES",  # Spanish (Spain)
    content_urls=["https://..."]
)
```

### ❌ INCORRECT: Wrong Locale Format
```python
# WRONG - locale must be BCP 47 format (language-country)
job = client.begin_transcription(
    locale="english",  # Should be en-US
    ...
)

# WRONG - unsupported locale format
job = client.begin_transcription(
    locale="en",  # Should be en-US (with country)
    ...
)
```

---

## 10. Test Scenarios Checklist

### Basic Operations
- [ ] Client creation with subscription key auth
- [ ] Batch transcription with begin_transcription
- [ ] Check job status before accessing results
- [ ] Real-time streaming with begin_stream_transcription
- [ ] Proper resource cleanup (context manager or close)

### Features
- [ ] Batch transcription with diarization enabled
- [ ] Diarization with max_speakers specified
- [ ] Accessing speaker information
- [ ] Extracting timestamps and offsets
- [ ] Converting timestamps to subtitle format
- [ ] Word-level timing extraction
- [ ] Handling streaming events and errors

### Error Handling
- [ ] Check result.status == "succeeded" before processing
- [ ] Access result.error when status == "failed"
- [ ] Handle streaming error events
- [ ] Proper exception handling in try/finally blocks

### Configuration
- [ ] Use environment variables for credentials
- [ ] Specify correct locale/language
- [ ] Set appropriate diarization parameters
- [ ] Enable/disable features as needed

---

## 11. Quick Reference: Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `AuthenticationError` | Wrong or missing credential | Use `AzureKeyCredential` or `DefaultAzureCredential`; never hardcode keys |
| `AttributeError: 'NoneType' object` | Result is None | Check `result.status == "succeeded"` first |
| `IndexError: list index out of range` | No results in list | Check `if result.results:` before indexing |
| `Stream stuck/hanging` | Not calling `stream.stop()` | Always call `stream.stop()` after sending audio |
| `No timestamps` | Not checking `hasattr(phrase, "offset")` | Use `getattr()` for optional fields |
| `Speaker info missing` | Diarization not enabled | Set `diarization_enabled=True` in options |
| `Wrong timezone in timestamps` | Using raw offset values | Convert 100-nanosecond units to seconds |
