# Collect useful client evidence

Confirm SDK language/version and host first. Use the
[logging APIs by language and platform](logging-apis.md), or the matching tab in
the official [Speech SDK logging](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-use-logging)
article, for exact APIs. Do not install or upgrade the SDK just to collect evidence.

## Native SDK logging

Prefer the diagnostic logger APIs when the installed binding has them. Their
availability differs by binding (see [logging APIs](logging-apis.md)), so check
the installed version before falling back to the legacy property:

| Logger | Use |
|---|---|
| FileLogger | A short, controlled reproduction to a local file |
| MemoryLogger | Intermittent failure; dump the bounded ring buffer promptly |
| EventLogger | Integrate diagnostics into an existing logging pipeline |

Loggers are process-wide; parallel objects interleave in one log. Capture before
constructing the affected recognizer/synthesizer and stop after the reproduction.
Keep the surrounding events; filters and fragments can remove correlation.
Use a new path to avoid overwriting evidence. Stop a logger only if the
application owns it; coordinate with existing process-wide logging.

Example for the reviewed C++ API, enclosing the existing reproduction:

```cpp
#include <speechapi_cxx.h>
#include <speechapi_cxx_file_logger.h>

namespace logging = Microsoft::CognitiveServices::Speech::Diagnostics::Logging;
logging::FileLogger::Start("speech-sdk-diagnostic.log");
try
{
    // Run the existing reproduction here, including SDK object creation.
}
catch (...)
{
    logging::FileLogger::Stop();
    throw;
}
logging::FileLogger::Stop();
```

This is a fragment, not a standalone program. Use an accessible, nonexisting
file in a restricted directory. Check whether other SDK objects are active. Do
not translate these C++ method names to other languages or SDK versions.

JavaScript has a separate implementation/log format:
[JavaScript SDK](https://github.com/microsoft/cognitive-services-speech-sdk-js).
The bundled native-format analyzer does not certify JavaScript coverage.
Preserve app-level events and follow the matching SDK documentation instead.

## Record app events alongside the SDK log

Record UTC with timezone, SDK package/version, OS/runtime, input type, endpoint
type, and the customer-observed failure. At the corresponding events record:

- SessionStarted/SessionStopped: SessionId.
- Recognizing/Recognized: ResultId and result reason, without recognized text.
- Canceled: available SessionId/ResultId, reason, error code, and locally
  reviewed/redacted error details.
- Synthesis: ResultId, reason and cancellation details when available.

API/event availability varies by binding. Use
[Speech samples](https://github.com/Azure-Samples/cognitive-services-speech-sdk)
and the installed SDK's API reference, not invented event fields. Correlate
app and SDK observations by explicit IDs, not adjacency.

Do not confuse local diagnostics with
[service-side audio/content logging](https://learn.microsoft.com/azure/ai-services/speech-service/logging-audio-transcription).
Do not enable that feature, record microphone audio, or upload sample audio
without explicit agreement about content, destination and retention.

Raw diagnostics may contain transcript, synthesis text/SSML, phrase lists,
reference text, URLs, paths and credentials. Keep originals local and restricted.
Do not request keys/tokens. Review even redacted output before external sharing;
the analyzer is an allowlist summary, not a general-purpose log sanitizer.
