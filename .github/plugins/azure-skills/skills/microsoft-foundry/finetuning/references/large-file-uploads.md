# Large File Uploads

## The Problem

The standard `client.files.create()` method silently fails on JSONL files larger than roughly 150MB. Azure returns a 500 server error during fine-tuning job execution, with no indication that the file upload itself was the issue. This is especially confusing because the upload step appears to succeed.

## Solution: Chunked Uploads API

For large files, use the OpenAI Uploads API which splits the file into chunks. The `upload_file()` helper in `common.py` triggers this automatically at 100MB (a safety margin below the ~150MB failure point):

```python
import os
import openai

client = openai.AzureOpenAI(
    azure_endpoint="https://<resource>.openai.azure.com",
    api_key="<KEY>",
    api_version="2025-04-01-preview",
)

filepath = "large_training_data.jsonl"
file_size = os.path.getsize(filepath)
chunk_size = 64 * 1024 * 1024  # 64MB chunks

# 1. Create upload session
upload = client.uploads.create(
    filename="large_training_data.jsonl",
    purpose="fine-tune",
    bytes=file_size,
    mime_type="application/jsonl",
)

# 2. Upload chunks
part_ids = []
with open(filepath, "rb") as f:
    while chunk := f.read(chunk_size):
        part = client.uploads.parts.create(upload_id=upload.id, data=chunk)
        part_ids.append(part.id)

# 3. Complete and get file ID
completed = client.uploads.complete(upload_id=upload.id, part_ids=part_ids)
file_id = completed.file.id  # Use this for fine-tuning
```

## Important Notes

- **Client type matters**: The Uploads API requires `openai.AzureOpenAI()` (not `openai.OpenAI()` with a `/v1/` base URL). The project `/v1/` endpoint returns 404 for upload operations.
- **Chunk size**: 64MB is a safe default. The maximum part size is not documented, but 64MB works reliably.
- **The `common.py` helper handles this automatically**: `upload_file()` detects files over 100MB and switches to chunked upload. Just make sure to pass an `AzureOpenAI` client for large files.
- **Processing time**: Large files may take several minutes to process after upload completes. The helper polls until ready.

## When to Use

| File Size | Method | Function |
|-----------|--------|----------|
| < 100MB | Standard `files.create()` | `upload_file()` (auto) |
| 100MB+ | Chunked Uploads API | `upload_file()` (auto, needs `AzureOpenAI` client) |
| > 5GB | Split dataset into multiple files | Manual |

## Symptoms of the Silent Failure

If you uploaded a large file with `files.create()` and your fine-tuning job fails with:

```json
{"code": "500", "message": "A system error was encountered, please try again later."}
```

Re-upload using the chunked Uploads API. The file upload appeared to succeed but the data was likely corrupted or incomplete on the server side.
