---
name: whisper
description: "Transcribe audio with Whisper running on-device via Foundry Local. Covers model download (SDK only), ONNX encoder/decoder pipeline, feature extraction, audio format requirements, and language-specific APIs. WHEN: whisper transcription, speech to text local, audio transcription, foundry whisper, on-device transcription, WAV transcription, voice to text, transcribe audio, whisper model, speech recognition local."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Foundry Local Whisper Transcription

This skill provides patterns for transcribing audio files using the OpenAI Whisper model running entirely on-device through Foundry Local.

## Triggers

Activate this skill when the user wants to:
- Transcribe audio files (WAV) using Whisper locally
- Set up speech-to-text with no cloud dependencies
- Download and configure the Whisper model via Foundry Local
- Build an ONNX encoder/decoder transcription pipeline
- Process audio files for local transcription

## Rules

1. **Whisper must be downloaded via the SDK** — the CLI does not support Whisper model download.
2. **Audio must be 16kHz mono WAV** — resample before processing.
3. **Python/JS use a manual ONNX pipeline** (encoder → decoder with KV cache).
4. **C# has a high-level API** — `GetAudioClient().TranscribeAudioAsync()`.
5. For service setup, refer to **setup** skill.

---

## Model Download

The Whisper model **must** be downloaded using the Foundry Local SDK, not the CLI:

### Python
```python
from foundry_local import FoundryLocalManager

manager = FoundryLocalManager("whisper-medium")
model_info = manager.get_model_info("whisper-medium")
cache_location = manager.get_cache_location()
```

### JavaScript
```javascript
import { FoundryLocalManager } from "foundry-local-sdk";

const manager = new FoundryLocalManager();
await manager.startService();
const modelInfo = await manager.loadModel("whisper-medium");
```

### C#
```csharp
var catalog = await manager.GetCatalogAsync(default);
var model = await catalog.GetModelAsync("whisper-medium", default);
if (!await model.IsCachedAsync(default))
    await model.DownloadAsync(null, default);
await model.LoadAsync(default);
```

---

## Python — Manual ONNX Pipeline

Python requires a manual encoder/decoder pipeline using ONNX Runtime:

### Dependencies
```bash
pip install foundry-local-sdk onnxruntime transformers librosa numpy
```

### Complete Pipeline

```python
import numpy as np
import onnxruntime as ort
import librosa
from transformers import WhisperFeatureExtractor, WhisperTokenizer
from foundry_local import FoundryLocalManager
import os

# Download model via SDK
manager = FoundryLocalManager("whisper-medium")
model_info = manager.get_model_info("whisper-medium")
cache_location = manager.get_cache_location()

# Build path to ONNX files
model_dir = os.path.join(
    cache_location, "Microsoft",
    model_info.id.replace(":", "-"),
    "cpu-fp32"
)

# Load ONNX sessions
encoder_session = ort.InferenceSession(
    os.path.join(model_dir, "whisper-medium_encoder_fp32.onnx"),
    providers=["CPUExecutionProvider"],
)
decoder_session = ort.InferenceSession(
    os.path.join(model_dir, "whisper-medium_decoder_fp32.onnx"),
    providers=["CPUExecutionProvider"],
)

# Load feature extractor and tokeniser
feature_extractor = WhisperFeatureExtractor.from_pretrained(model_dir)
tokenizer = WhisperTokenizer.from_pretrained(model_dir)

# Whisper medium model dimensions
NUM_LAYERS = 24
NUM_HEADS = 16
HEAD_SIZE = 64

# Build initial decoder tokens
sot = tokenizer.convert_tokens_to_ids("<|startoftranscript|>")
eot = tokenizer.convert_tokens_to_ids("<|endoftext|>")
notimestamps = tokenizer.convert_tokens_to_ids("<|notimestamps|>")
forced_ids = tokenizer.get_decoder_prompt_ids(language="en", task="transcribe")
INITIAL_TOKENS = [sot] + [tid for _, tid in forced_ids] + [notimestamps]


def transcribe(audio_path):
    # Load audio at 16kHz mono
    audio, _ = librosa.load(audio_path, sr=16000)

    # Extract log-mel spectrogram
    features = feature_extractor(audio, sampling_rate=16000, return_tensors="np")
    audio_features = features["input_features"].astype(np.float32)

    # Run encoder
    encoder_outputs = encoder_session.run(None, {"audio_features": audio_features})
    cross_kv_list = encoder_outputs[1:]

    # Prepare cross-attention KV cache
    cross_kv = {}
    for i in range(NUM_LAYERS):
        cross_kv[f"past_key_cross_{i}"] = cross_kv_list[i * 2]
        cross_kv[f"past_value_cross_{i}"] = cross_kv_list[i * 2 + 1]

    # Initialise self-attention KV cache
    self_kv = {}
    for i in range(NUM_LAYERS):
        self_kv[f"past_key_self_{i}"] = np.zeros((1, NUM_HEADS, 0, HEAD_SIZE), dtype=np.float32)
        self_kv[f"past_value_self_{i}"] = np.zeros((1, NUM_HEADS, 0, HEAD_SIZE), dtype=np.float32)

    # Autoregressive decoding
    input_ids = np.array([INITIAL_TOKENS], dtype=np.int32)
    generated = []

    for _ in range(448):  # Max tokens
        feeds = {"input_ids": input_ids}
        feeds.update(cross_kv)
        feeds.update(self_kv)

        outputs = decoder_session.run(None, feeds)
        logits = outputs[0]
        next_token = int(np.argmax(logits[0, -1, :]))

        if next_token == eot:
            break

        generated.append(next_token)

        # Update self-attention KV cache
        for i in range(NUM_LAYERS):
            self_kv[f"past_key_self_{i}"] = outputs[1 + i * 2]
            self_kv[f"past_value_self_{i}"] = outputs[2 + i * 2]

        input_ids = np.array([[next_token]], dtype=np.int32)

    return tokenizer.decode(generated, skip_special_tokens=True).strip()
```

---

## C# — High-Level API

C# provides a simpler API via `GetAudioClient()`:

```csharp
var audioClient = model.GetAudioClient();
var result = await audioClient.TranscribeAudioAsync(audioFilePath);
Console.WriteLine(result.Text);
```

---

## Audio Format Requirements

| Requirement | Value |
|-------------|-------|
| Sample rate | 16,000 Hz (16 kHz) |
| Channels | Mono (1 channel) |
| Format | WAV (PCM) |
| Max duration | ~30 seconds per segment |

If your audio is in a different format, resample before processing:

```python
# librosa handles resampling automatically
audio, _ = librosa.load("input.wav", sr=16000)
```

---

## Known Issues

| Issue | Severity | Workaround |
|-------|----------|------------|
| JS: Last audio file may return empty transcription | Minor | Node.js binding edge case; other files work fine |
| C#: Path resolution fragile with different RIDs | Minor | Use absolute paths or CLI arguments |
| OGA memory leak warnings on exit | Warning | Non-blocking; no cleanup API exposed |

---

## Cross-References

- For service setup and model download, see **setup**
- For chat completions (text), see **chat**
- For custom model compilation, see **custom-models**
