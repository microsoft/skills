# Speech SDK logging APIs by language and platform

Copied from the official
[Enable logging in the Speech SDK](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-use-logging)
article and the per-language API references (checked 2026-10-21); they are
authoritative if they differ. Pick the API for the user's language and installed
SDK version. Loggers are process-wide; scope and privacy are in
[collection](collection.md). `path` is the log file path.

## Diagnostic loggers (FileLogger, MemoryLogger, EventLogger)

Availability is binding-specific. When `FileLogger` was added, per source:

| Binding | Added in | Source |
|---|---|---|
| C++ | 1.20.0 | pinned C++ header |
| C# | 1.20.0 | .NET API reference |
| Java | 1.42.0 | Java API reference |
| Python | 1.43.0 | Python API reference |
| Others | not checked | installed package's API reference |

The how-to article recommends the static loggers from 1.43.0 onward; that is
guidance, not an availability limit for every binding. Use these loggers when
the installed binding has them, and the [legacy property](#legacy-property)
only when it does not.

| Language | File logger | Memory logger dump |
|---|---|---|
| C# | `FileLogger.Start(path)`, `FileLogger.Stop()` (`Microsoft.CognitiveServices.Speech.Diagnostics.Logging`) | `MemoryLogger.Dump(path)` |
| C++ | `FileLogger::Start(path)`, `FileLogger::Stop()` | `MemoryLogger::Dump(path)` |
| Java | `FileLogger.start(path)`, `FileLogger.stop()` (`com.microsoft.cognitiveservices.speech.diagnostics.logging`) | `MemoryLogger.dump(path)` |
| Python | `FileLogger.start(path)`, `FileLogger.stop()` (`azure.cognitiveservices.speech.diagnostics.logging`) | `MemoryLogger.dump(path)` |
| Objective-C | `[SPXFileLogger start:path]`, `[SPXFileLogger stop]` | `[SPXMemoryLogger dumpToFile:path]` |
| Swift (iOS) | `SPXFileLogger.start(path)` | see the article |
| JavaScript | `sdk.Diagnostics.SetLoggingLevel(sdk.LogLevel.Debug)`, `sdk.Diagnostics.SetLogOutputPath(path)` | not applicable |

JavaScript uses a separate implementation and log format, so the native-format
analyzer does not apply. For Go the article documents only the legacy property.
EventLogger callbacks and filters are in the article's per-language samples.

## Legacy property

For a binding without the loggers above, the article documents the legacy
`Speech_LogFilename` property on the speech configuration:

| Language | Call |
|---|---|
| C# | `speechConfig.SetProperty(PropertyId.Speech_LogFilename, path)` |
| C++ | `speechConfig->SetProperty(PropertyId::Speech_LogFilename, path)` |
| Java | `speechConfig.setProperty(PropertyId.Speech_LogFilename, path)` |
| Python | `speech_config.set_property(speechsdk.PropertyId.Speech_LogFilename, path)` |
| Objective-C | `[speechConfig setPropertyTo:path byId:SPXSpeechLogFilename]` |
| Go | `speechConfig.SetProperty(common.SpeechLogFilename, path)` |

Creating a recognizer from that configuration enables logging for all
recognizers. A `SpeechSynthesizer` created from it does not enable logging,
although synthesizer diagnostics appear when logging is already enabled; the
article's C++ helper enables logging with a temporary recognizer for that reason.
The latest recognizer created sets the file for all SDK logging, and releasing an
object does not stop logging; the article stops it by creating a new object with
an empty path.

## Log file location by platform

- Windows and Linux: any path the user can write.
- UWP: an application data folder (local, roaming or temporary).
- Android: internal, external or cache storage. The article's example uses
  `context.getExternalFilesDir(null)` and lists the manifest permission and Unity
  setting it requires.
- iOS: only the app sandbox (documents, library, temp). Files in the documents
  directory can be exposed to users with the two `Info.plist` keys in the article.

Other operating systems can restrict writes by default.
