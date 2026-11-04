# Public source and compatibility contract

Reviewed: **Speech SDK v1.51.2**, commit
**`d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5`**. Do not substitute `main`.

| Rule | Public source |
|---|---|
| Source/binary/extension limits | [README](https://github.com/microsoft-foundry/SpeechSDK/blob/d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5/README.md) |
| Property IDs to logged names | [property_id_2_name_map.h](https://github.com/microsoft-foundry/SpeechSDK/blob/d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5/source/core/common/include/property_id_2_name_map.h) |
| Property writes | [property_bag_impl.cpp](https://github.com/microsoft-foundry/SpeechSDK/blob/d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5/source/core/common/property_bag_impl.cpp) |
| Context construction and pre-send trace | [usp_reco_engine_adapter.cpp](https://github.com/microsoft-foundry/SpeechSDK/blob/d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5/source/core/sr/usp_reco_engine_adapter.cpp#L1300-L1345) |
| Feature serialization | [context builders](https://github.com/microsoft-foundry/SpeechSDK/blob/d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5/source/core/sr/usp_reco_engine_adapter.cpp#L2265-L3120) |
| Session creation/events | [audio_stream_session.cpp](https://github.com/microsoft-foundry/SpeechSDK/blob/d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5/source/core/sr/audio_stream_session.cpp) |
| Connection header | [usp_connection.cpp](https://github.com/microsoft-foundry/SpeechSDK/blob/d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5/source/core/usp/usp_connection.cpp#L636-L643) |
| STT result/phrase IDs | [recognition_result.cpp](https://github.com/microsoft-foundry/SpeechSDK/blob/d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5/source/core/sr/recognition_result.cpp) |
| TTS result/request IDs | [synthesis_result.cpp](https://github.com/microsoft-foundry/SpeechSDK/blob/d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5/source/core/tts/synthesis_result.cpp) |
| Synthesis start/done traces | [synthesizer.cpp](https://github.com/microsoft-foundry/SpeechSDK/blob/d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5/source/core/tts/synthesizer.cpp) |
| Relative trace clock/thread marker | [trace_message.cpp](https://github.com/microsoft-foundry/SpeechSDK/blob/d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5/source/core/logging/trace_message.cpp) |
| C++ collection API | [speechapi_cxx_file_logger.h](https://github.com/microsoft-foundry/SpeechSDK/blob/d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5/source/public/cxx_api/speechapi_cxx_file_logger.h) |

Source proves that revision, not the customer's runtime or service behavior.
Bindings/extensions and JavaScript need separate verification. Do not infer
server defaults, retry ceilings, capacity, billing or effective network behavior.

## Analyzer scope

The analyzer recognizes selected native text-log shapes, not every binding,
OS, version or feature. No version evidence means unknown. For other versions,
retain literal observations; review matching source before interpretation.

Thread markers are reduced hashes, not unique object identifiers. Object
addresses can be reused. Only IDs explicit in a record are attached to it.
Property-bag addresses are not assumed to be recognizer/session objects.
Result and synthesis traces log `__FUNCTION__`, which MSVC qualifies with the
class name and GCC/Clang do not; the analyzer accepts both spellings. Property
values are logged between quotes without escaping, so values can contain `'`.

The trace clock is not guaranteed process start or UTC. Clock resets, combined
processes, late capture and filtered logs limit reconstruction.

## Updating support

For new releases/shapes, review changed functions and capture APIs; add synthetic
and non-sensitive runtime fixtures; run regressions and built-plugin Vally cases.
Source review is not cross-platform runtime validation. Never publish customer
logs, internal sources, credentials or support-case identifiers.
