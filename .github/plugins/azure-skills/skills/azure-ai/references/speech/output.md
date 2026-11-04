# Analyzer output reference

The analyzer prints one JSON object: `schemaVersion`, `source` (the reviewed SDK
version and commit), `coverage`, `ids`, `observations` and `limits` (standing
caveats to keep when sharing a report). Each observation has a `kind`, `scope`,
and the anchors `lineStart`, `lineEnd`, `relativeMs`, `threadMarker`, `codeFile`
and `codeLine`. Cite the line range; the relative time, thread marker and object
value are not UTC, a unique thread or an object identity.

## Observation kinds

| Kind | Fields | Meaning |
|---|---|---|
| `sdk_version` | `version` | Version in the logged `speech.config` |
| `property` | `access`, `object`, `name`, `value` | Allowlisted property read or write on one object; `value` can be `present_value_withheld` or `value_not_allowlisted` |
| `session_property` | `access`, `object`, `name`, `sessionId` | `SessionId` property |
| `request_property` | `access`, `object`, `name`, `protocolRequestId` | `RESULT-RequestId` property |
| `request_context` | `features`, `evidence`, `sessionId` | Features in the SDK-generated `speech.context`, always `generated_context_only`; `sessionId` only when the context carries one |
| `session_event` | `object`, `event`, `sessionId` | SessionStarted or SessionStopped trace |
| `recognition_result` | `stage`, `resultId`, `reasonCode` | STT result ID; `reasonCode` is numeric and only on final results |
| `synthesis_event` | `event`, `synthesisRequestId` | TTS `started` or `done` trace; `done` is not success |
| `connection_configuration` | `sessionId` | Session ID set on a connection |
| `connection_header` | `connectionId` | Standalone `X-ConnectionId` header |
| `websocket_upgrade` | `statusCode` | Literal upgrade response status |
| `websocket_open_error` | `object`, `resultCode`, `errorCode` | Numeric open failure |
| `dns_error` | `errorCode` | Numeric lookup failure; one per occurrence |

`scope` states what an observation is tied to, using IDs in that one record only:
`explicit_session`, `explicit_synthesis_request`, `explicit_result`, `object_only`
or `unassociated`.

## Coverage

| Field | Meaning |
|---|---|
| `format` | `native_text` or `unrecognized` |
| `lines`, `nativeRecords`, `unrecognizedLines` | Input size and how much matched the native header |
| `unhandledNativeRecords` | Native records with no extractor; not a clean bill of health |
| `oversizedRecords`, `malformedJsonRecords` | Records skipped or unparsed |
| `relativeClockRegressions` | Times that moved backwards, as in combined or restarted traces |
| `omittedObservations`, `omittedVersions` | Output limits reached |
| `observedVersions`, `sourceCompatibility` | Logged versions; `unknown`, `matches_reviewed_version` or `unreviewed_or_mixed_versions` |
| `utcMapping`, `sessionAttribution`, `captureCompleteness` | Always `not_established`, `explicit_ids_only` and `unknown` |

`ids` lists distinct values by type (`sessions`, `results`, `synthesisRequests`,
`protocolRequests`, `connections`) from retained observations only.

## Example

A log line, then its observation with the anchors trimmed:

```text
[7]: 105ms SPX_TRACE_INFO: AZ_LOG_INFO: uws_client.c:1250 Received WebSocket upgrade response with status code 401
```

```json
{"kind":"websocket_upgrade","statusCode":401,"codeFile":"uws_client.c","scope":"unassociated"}
```

Report it as: observed, upgrade status 401 at that line; interpretation, an HTTP
401 on the upgrade, with the endpoint and authentication method as candidates to
check; unknown, which session or request it belongs to.
