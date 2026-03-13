---
name: custom-models
description: "Compile and register custom Hugging Face models for Foundry Local. Covers ONNX Runtime GenAI Model Builder, quantisation, chat template generation, cache registration, and inference_model.json configuration. WHEN: custom model foundry, hugging face model, ONNX compile, model builder, quantize model, int4 quantisation, register custom model, onnxruntime-genai, bring your own model, compile model, ONNX conversion, custom ONNX model, foundry cache register."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Foundry Local Custom Models

This skill provides the complete workflow for compiling Hugging Face models into the ONNX format that Foundry Local requires, configuring chat templates, and registering models in the local cache.

## Triggers

Activate this skill when the user wants to:
- Compile a Hugging Face model for Foundry Local
- Use the ONNX Runtime GenAI Model Builder
- Quantise a model (int4, int8, fp16, fp32)
- Create an `inference_model.json` chat template configuration
- Register a custom model in the Foundry Local cache
- Understand Model Builder vs Microsoft Olive trade-offs

## Rules

1. **Use ONNX Runtime GenAI Model Builder** — it produces the exact output format Foundry Local expects in a single command.
2. **Requires Python 3.10+** and a dedicated virtual environment (PyTorch, Transformers are large).
3. **The `inference_model.json` file is required** — it tells Foundry Local how to format prompts.
4. **The `Name` field in `inference_model.json` becomes the model alias** used in all API calls.
5. For service setup, refer to **setup** skill.

---

## End-to-End Workflow

```
1. Install          pip install onnxruntime-genai
2. Compile          python -m onnxruntime_genai.models.builder -m <HF-model> -o <output> -p int4 -e cpu
3. Chat Template    python generate_chat_template.py  (creates inference_model.json)
4. Register         foundry cache cd <output-dir>
5. Run              foundry model run <alias>
```

---

## Step 1: Install the Model Builder

```bash
pip install onnxruntime-genai
```

Verify:
```bash
python -m onnxruntime_genai.models.builder --help
```

---

## Step 2: Compile a Model

### CPU (int4 quantisation)

```bash
python -m onnxruntime_genai.models.builder \
    -m Qwen/Qwen3-0.6B \
    -o models/qwen3 \
    -p int4 \
    -e cpu \
    --extra_options hf_token=false
```

### NVIDIA GPU (fp16)

```bash
python -m onnxruntime_genai.models.builder \
    -m Qwen/Qwen3-0.6B \
    -o models/qwen3-gpu \
    -p fp16 \
    -e cuda \
    --extra_options hf_token=false
```

### Parameters

| Parameter | Purpose | Common Values |
|-----------|---------|---------------|
| `-m` | Hugging Face model ID or local path | `Qwen/Qwen3-0.6B`, `microsoft/Phi-3.5-mini-instruct` |
| `-o` | Output directory | `models/qwen3` |
| `-p` | Quantisation precision | `int4`, `int8`, `fp16`, `fp32` |
| `-e` | Execution provider (target hardware) | `cpu`, `cuda`, `dml`, `NvTensorRtRtx`, `webgpu` |
| `--extra_options` | Additional options | `hf_token=false` (skip auth for public models) |

### Precision Trade-offs

| Precision | Size | Speed | Quality | Best For |
|-----------|------|-------|---------|----------|
| `int4` | Smallest | Fastest | Moderate loss | CPU development, low-RAM devices |
| `int8` | Small | Fast | Slight loss | Balanced trade-off |
| `fp16` | Large | Fast (GPU) | Very good | GPU inference |
| `fp32` | Largest | Slowest | Highest | Maximum quality |

### Hardware Targets

| Hardware | `-e` value | Recommended `-p` |
|----------|-----------|-------------------|
| CPU | `cpu` | `int4` |
| NVIDIA GPU | `cuda` | `fp16` or `int4` |
| Windows GPU (DirectML) | `dml` | `fp16` or `int4` |
| NVIDIA TensorRT RTX | `NvTensorRtRtx` | `fp16` |
| WebGPU | `webgpu` | `int4` |

---

## Step 3: Create inference_model.json

The `inference_model.json` tells Foundry Local how to format prompts. Generate it from the model's tokeniser:

```python
"""Generate an inference_model.json chat template for Foundry Local."""

import json
from transformers import AutoTokenizer

MODEL_PATH = "models/qwen3"

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)

messages = [
    {"role": "system", "content": "{Content}"},
    {"role": "user", "content": "{Content}"},
]

prompt_template = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
    enable_thinking=False,
)

inference_model = {
    "Name": "qwen3-0.6b",          # This becomes the model alias
    "PromptTemplate": {
        "assistant": "{Content}",
        "prompt": prompt_template,
    },
}

output_path = f"{MODEL_PATH}/inference_model.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(inference_model, f, indent=2, ensure_ascii=False)

print(f"Chat template written to {output_path}")
```

> **Important:** The `"Name"` field becomes the model alias used in all subsequent API calls and CLI commands.

---

## Step 4: Register in Foundry Local Cache

```bash
foundry cache cd models/qwen3
```

Verify:
```bash
foundry cache ls
```

---

## Step 5: Run the Model

### CLI
```bash
foundry model run qwen3-0.6b --verbose
```

### REST API
```bash
curl -X POST http://localhost:<PORT>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen3-0.6b", "messages": [{"role": "user", "content": "Hello!"}], "max_tokens": 100}'
```

### OpenAI SDK (Python)
```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:<PORT>/v1", api_key="not-required")

response = client.chat.completions.create(
    model="qwen3-0.6b",
    messages=[{"role": "user", "content": "What is the golden ratio?"}],
    max_tokens=200,
)
print(response.choices[0].message.content)
```

### Foundry Local SDK (Python)
```python
from foundry_local import FoundryLocalManager
import openai

manager = FoundryLocalManager()
manager.start_service()
manager.load_model("qwen3-0.6b")

client = openai.OpenAI(base_url=manager.endpoint, api_key=manager.api_key)
response = client.chat.completions.create(
    model="qwen3-0.6b",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

---

## Expected Output Directory

After compilation and chat template generation:

```
models/qwen3/
    model.onnx
    model.onnx.data
    genai_config.json          (auto-generated by model builder)
    chat_template.jinja        (auto-generated by model builder)
    inference_model.json       (you create this)
    tokenizer.json
    tokenizer_config.json
    vocab.json
    merges.txt
    special_tokens_map.json
    added_tokens.json
```

---

## Model Builder vs Microsoft Olive

| | **Model Builder** | **Olive** |
|---|---|---|
| **Package** | `onnxruntime-genai` | `olive-ai` |
| **Ease of use** | Single command | Multi-step workflow with YAML config |
| **Best for** | Quick compilation for Foundry Local | Production pipelines with fine-grained control |
| **Foundry Local compat** | Direct — output is immediately compatible | Requires `--use_ort_genai` flag |
| **Hardware scope** | CPU, CUDA, DirectML, TensorRT, WebGPU | All of above + Qualcomm QNN |

> **Recommendation:** Use the Model Builder for compiling individual models for Foundry Local. Use Olive when you need advanced optimisation (accuracy-aware quantisation, graph surgery, multi-pass tuning).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Model fails to load after registration | Verify `inference_model.json` exists and is valid JSON |
| `<think>` tags in output | Normal for reasoning models (Qwen3). Adjust prompt template to suppress |
| `hf_token` error | Add `--extra_options hf_token=false` for public models |
| Out of memory during compilation | Use a smaller model or `int4` precision |
| Compilation very slow | Expected — 5-15 min for small models, longer for large ones |

---

## Cross-References

- For service setup, see **setup**
- For chat completions with compiled models, see **chat**
- For testing model quality, see **evaluation**
