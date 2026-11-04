# Interpret observations, not assumptions

Read [source boundaries](source-contract.md) for the reviewed release. Every
finding needs an analyzer line anchor; avoid broad root-cause statements.

## Configuration and feature evidence

`property` observations distinguish a property **write** from a **read** on a
property-bag object. Neither proves the user explicitly configured it, nor that
it belongs to the nearest session. Values can change; retain conflicting
observations, not a process-global "last value".

`request_context` observations summarize selected `speech.context` JSON fields:
language identification, pronunciation assessment presence, phrase-list count,
segmentation, output options, and speaker diarization. They mean the SDK
generated that context, not that transport succeeded or the server adopted it.
Do not print phrase/reference text, JSON bodies or unknown properties.

| Observation | Safe interpretation |
|---|---|
| Locale, voice or format property | A value was observed on that object |
| LID context with mode/candidate languages | Those fields occurred in generated context |
| Pronunciation assessment object | Assessment configuration was present; scoring success is unknown |
| Speaker diarization context | Diarization configuration was present; not proof of speaker accuracy |
| Detailed output/word timings | Requested output; may be set by another feature |
| No feature entry | Not observed, not disabled |

## IDs and lifecycle

The ID inventory is typed, not a count of unique business requests. Session ID
is not ResultId. STT intermediate/final IDs can reflect phrase IDs; do not count
every occurrence as a new request. TTS result/request equivalence is supported
only by the reviewed implementation. One connection can serve multiple synthesis
requests. Preserve protocol request IDs separately.

Final recognition records retain numeric `reasonCode`, not a guessed cause.
For the reviewed version, [ResultReason](https://github.com/microsoft-foundry/SpeechSDK/blob/d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5/source/public/cxx_api/speechapi_cxx_enums.h)
defines NoMatch as 0 and RecognizedSpeech as 3. Other values/versions require
their matching enum; cancellation details must come from app events when the
native trace does not expose them.

Only IDs explicit in the same record are attached to observations. Result IDs
on unrelated records remain unassociated. Same thread,
time overlap, or similar GUID spelling is insufficient.

| Client evidence | Next check; not a conclusion |
|---|---|
| WebSocket upgrade status other than 101 | Preserve exact status; compare endpoint/auth mode and error details |
| DNS error code | Resolve the confirmed host from the affected environment |
| 401/403 | Verify resource/endpoint, auth method and relevant configuration; no single-cause mapping |
| NoMatch | Read NoMatch details and inspect input/configuration; do not label an outage |
| TLS certificate verification error (not extracted by the analyzer) | Keep the exact line; compare the trust store and any TLS-inspecting proxy of the affected host; never disable validation |
| Log ends without a terminal event | Incomplete capture is possible; do not invent a disconnect |

The analyzer does not implement all these diagnoses or echo unknown errors.

Relative milliseconds are not wall-clock UTC or audio offsets. Embedded
timestamps are separate observations, not automatic cross-clock anchors.
SDK latency properties are reported as SDK metrics, not microphone-to-display
or playback latency. Use matching API definitions before deriving a breakdown:
[TTS latency](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-lower-speech-synthesis-latency).

Never disable certificate validation, remove network controls, rotate keys,
increase quota, or delete/recreate resources as a generic troubleshooting fix.
