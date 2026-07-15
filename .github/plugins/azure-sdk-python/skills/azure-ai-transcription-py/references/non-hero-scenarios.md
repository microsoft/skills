# azure-ai-transcription-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

## Operational hardening

### Retry Policy

Configure retries for transient failures via `azure-core` retry policy:

```python
import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.transcription import TranscriptionClient
from azure.core.pipeline.policies import RetryPolicy

retry_policy = RetryPolicy(retry_total=3, retry_backoff_factor=2)

with TranscriptionClient(
    endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"]),
    retry_policy=retry_policy,
) as client:
    job = client.begin_transcription(
        name="meeting-transcription",
        locale="en-US",
        content_urls=["https://<storage>/audio.wav"],
    )
    result = job.result()
```

### LRO Poll with Timeout

Avoid blocking indefinitely on long-running batch jobs:

```python
import os
import time
from azure.core.credentials import AzureKeyCredential
from azure.ai.transcription import TranscriptionClient

with TranscriptionClient(
    endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"]),
) as client:
    job = client.begin_transcription(
        name="long-audio",
        locale="en-US",
        content_urls=["https://<storage>/long-audio.wav"],
    )
    # Poll with an explicit deadline; job.result() does not raise on timeout
    deadline = time.monotonic() + 300
    while not job.done():
        if time.monotonic() > deadline:
            raise TimeoutError("Transcription did not complete within 300 s")
        time.sleep(5)
    result = job.result()
    print(result.status)
```

### List and Paginate Transcriptions

`list_transcriptions()` returns a lazy iterator; paginate explicitly to avoid loading everything at once:

```python
import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.transcription import TranscriptionClient

with TranscriptionClient(
    endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"]),
) as client:
    for index, transcription in enumerate(client.list_transcriptions()):
        print(f"[{index}] {transcription.name}: {transcription.status}")
```

### Delete Completed Transcriptions

Remove completed jobs to keep the account tidy:

```python
import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.transcription import TranscriptionClient

with TranscriptionClient(
    endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
    credential=AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"]),
) as client:
    for transcription in client.list_transcriptions():
        if transcription.status == "Succeeded":
            client.delete_transcription(transcription.transcription_id)
```

### Async Batch Transcription

Use the async client for non-blocking workflows:

```python
import os
from azure.core.credentials import AzureKeyCredential
from azure.ai.transcription.aio import TranscriptionClient

async def run_async_transcription():
    async with TranscriptionClient(
        endpoint=os.environ["TRANSCRIPTION_ENDPOINT"],
        credential=AzureKeyCredential(os.environ["TRANSCRIPTION_KEY"]),
    ) as client:
        job = await client.begin_transcription(
            name="async-meeting",
            locale="en-US",
            content_urls=["https://<storage>/audio.wav"],
            diarization_enabled=True,
        )
        result = await job.result()
        print(result.status)
```
