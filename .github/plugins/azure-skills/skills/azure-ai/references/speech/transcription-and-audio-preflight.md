# Speech audio preflight and REST/batch transcription diagnostics

For local audio header validation, Speech endpoint/Entra auth preflight, Fast
Transcription (`2025-10-15`), Batch Transcription (`2025-10-15` / `2024-11-15`)
and Batch Synthesis (`2024-04-01`). For native Speech SDK text logs, use
[Speech SDK client diagnostics](diagnostics.md). Route Microsoft Foundry Voice
Agents (`kind: voice` / `azd ai agent`) to `microsoft-foundry`.

## Workflow

1. Confirm which Speech surface the app calls:

| Surface | Path & tier | Key public limits |
|---|---|---|
| Realtime STT / TTS | WebSocket / short REST (`F0`/`S0`) | STT: `F0` 1, `S0` 100 concurrent (STT + translation shared), diarization `<= 240 min`. TTS: `<= 10 min` audio, `<= 50` `<voice>`/`<audio>` tags, `<= 64 KB` WS SSML. |
| Fast Transcription | `POST /speechtotext/transcriptions:transcribe?api-version=2025-10-15` (`S0`) | Synchronous, `< 500 MB`, `< 5 hours`, shares `600 req/min` with Batch STT. |
| Batch Transcription | `POST /speechtotext/transcriptions:submit?api-version=2025-10-15` (`S0`) | Async (`contentContainerUrl` or `<= 1,000` `contentUrls`, `<= 10,000` blobs/container), `<= 1 GB`/file, diarization `<= 240 min`/file, `timeToLiveHours` `6h..31d`. |
| Batch Synthesis | `PUT /texttospeech/batchsyntheses/{id}?api-version=2024-04-01` (`S0`) | Payload `<= 2 MB`, `<= 10,000` inputs, ID `3-64` chars (`[A-Za-z0-9._-]`, alnum ends). Destination storage cannot be network-restricted (Long Audio retires 2027-04-01). |

2. Never ask for keys/SAS or paste transcripts/SSML. Check `node --version`
   (Node.js 22+). If missing/older, follow
   [audio checks without Node](audio-without-node.md). Otherwise run the
   [local inspector](../../scripts/inspect-speech-audio.mjs):

   ```bash
   node "<skill-directory>/scripts/inspect-speech-audio.mjs" --file "<local-audio-or-json>" --mode realtime-sdk
   ```

   ```powershell
   & node "<skill-directory>\scripts\inspect-speech-audio.mjs" --file "<local-audio-or-json>" --mode realtime-sdk
   ```

   Modes: `realtime-sdk`, `fast-transcription`, `batch-transcription`,
   `batch-transcription-files`, `batch-synthesis-job`.
   [Bash](../../scripts/inspect-speech-audio.sh) and
   [PowerShell](../../scripts/inspect-speech-audio.ps1) launchers use exit codes
   `0` report/`--help`, `1` file/JSON error, `2` usage error, `3` Node 22+ missing.

3. Check common failure patterns:
   - **`SPXERR_INVALID_HEADER`/`NoMatch` on `.wav`**: compressed audio renamed
     `.wav`, non-PCM `formatTag`, missing/empty/truncated `data` chunk, or
     leading all-zero PCM.
   - **Entra ID / Private Link `401`/`403`**: needs `customSubdomainName`,
     `Cognitive Services Speech Contributor` or `Speech User`, and
     `aad#<resourceId>#<entraToken>` on regional SDK hosts. Keys fail when
     `disableLocalAuth: true`.
   - **Batch `Succeeded` with missing outputs**: List Files has one
     `Transcription` per successful input plus a `TranscriptionReport`, no
     per-file status. Run `batch-transcription-files` on the list, then on the
     downloaded report (`failedTranscriptionsCount`).
   - **REST `429`/`499`/`5xx`**: SDK log analysis does not apply. Keep causes
     open from status codes; gather UTC times, region/endpoint, concurrency and
     response headers (no keys). A `429` within quota can occur while the
     service autoscales.

## Sources

- [Speech quotas and limits](https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits)
- [Speech-to-text REST API `2025-10-15`](https://learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text)
- [Fast transcription](https://learn.microsoft.com/azure/ai-services/speech-service/fast-transcription-create) | [Batch transcription](https://learn.microsoft.com/azure/ai-services/speech-service/batch-transcription-create) | [Batch synthesis](https://learn.microsoft.com/azure/ai-services/speech-service/batch-synthesis)
