#!/usr/bin/env node
// Local allowlist analyzer for native Azure Speech SDK diagnostic logs.
// Exit codes: 0 = analysis written to stdout or --help, 1 = file/read/size error, 2 = usage/argument error.
import { createReadStream, realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_COMMIT = "d0d08a34f40cd7a6d421f42fb14c2aab4f905ac5";
const MAX_BYTES = 256 * 1024 * 1024;
const MAX_RECORD_CHARS = 256 * 1024;
const ID = "(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12})";
const POINTER = "(?:0x)?[a-fA-F0-9]{4,16}";
const HEADER = /^\[(\d{1,6})\]:\s*(\d{1,13})ms\s+(SPX_[A-Z_]+):\s+(?:AZ_LOG_[A-Z]+:\s+)?(\S+):(\d+)\s+(.*)$/;
const numeric = (value) => /^\d{1,10}$/.test(value) ? Number(value) : undefined;
const choice = (...values) => (value) => values.includes(value) ? value : undefined;
const locale = (value) => /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(value) ? value : undefined;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const pointer = (value) => value.toLowerCase().replace(/^0x/, "").replace(/^0+(?=.)/, "");
const identifier = (value) => typeof value === "string" && new RegExp(`^${ID}$`).test(value) ? value : undefined;
const PROPERTIES = new Map([
  ["SPEECH-RecoLanguage", locale],
  ["SPEECH-SynthLanguage", locale],
  ["SPEECH-RecoMode", choice("INTERACTIVE", "CONVERSATION", "DICTATION", "Interactive", "Conversation", "Dictation")],
  ["SPEECH-LanguageIdMode", choice("AtStart", "Continuous", "AtStartHighAccuracy")],
  ["SPEECH-SegmentationStrategy", choice("Default", "Time", "Semantic")],
  ["SPEECH-SegmentationSilenceTimeoutMs", numeric],
  ["SPEECH-SegmentationMaximumTimeMs", numeric],
  ["SPEECH-InitialSilenceTimeoutMs", numeric],
  ["SPEECH-EndSilenceTimeoutMs", numeric],
  ["AudioConfig_NumberOfChannelsForCapture", numeric],
  ["AudioConfig_SampleRateForCapture", numeric],
  ["AudioConfig_BitsPerSampleForCapture", numeric],
  ["AudioConfig_AudioSource", choice("Microphones", "Stream", "File")],
  ["AZAC-SDK-PROGRAMMING-LANGUAGE", choice("C++", "C#", "Java", "Python", "Objective-C", "Swift", "Go")],
  ["SpeechServiceResponse_RequestWordLevelTimestamps", choice("true", "false", "1", "0")],
  ["SpeechServiceResponse_DiarizeIntermediateResults", choice("true", "false", "1", "0")],
  ["PronunciationAssessment_EnableMiscue", choice("true", "false", "1", "0")],
  ["PronunciationAssessment_EnableProsodyAssessment", choice("true", "false", "1", "0")],
  ["PronunciationAssessment_Granularity", choice("FullText", "Word", "Phoneme")],
  ["PronunciationAssessment_GradingSystem", choice("FivePoint", "HundredMark")],
  ["RESULT-RecognitionLatencyMs", numeric],
  ["RESULT-SynthesisFirstByteLatencyMs", numeric],
  ["RESULT-SynthesisFinishLatencyMs", numeric],
  ["RESULT-SynthesisUnderrunTimeMs", numeric],
  ["RESULT-SynthesisConnectionLatencyMs", numeric],
  ["RESULT-SynthesisNetworkLatencyMs", numeric],
  ["RESULT-SynthesisServiceLatencyMs", numeric],
]);
// Presence only: these fields can carry free text or account-specific identifiers.
const PRESENCE_PROPERTIES = new Set([
  "SPEECH-SynthVoice", "SPEECH-SynthOutputFormat", "SPEECH-ModelId",
  "SPEECH-Endpoint", "SPEECH-Region", "Auto-Detect-Source-Languages",
  "PronunciationAssessment_ReferenceText", "PronunciationAssessment_Params",
]);

function contextFeatures(context) {
  const features = {};
  const detection = object(context.phraseDetection) ? context.phraseDetection : {};
  if (object(context.languageId)) {
    features.languageIdentification = { present: true };
    const lid = features.languageIdentification;
    const mode = choice("DetectContinuous", "DetectSegments", "DetectAtAudioStart")(context.languageId.mode);
    if (mode !== undefined) lid.mode = mode;
    if (Array.isArray(context.languageId.languages)) {
      lid.candidateCount = context.languageId.languages.length;
      lid.languages = context.languageId.languages.filter((item) => typeof item === "string" && locale(item)).slice(0, 100);
      lid.omittedCandidates = lid.candidateCount - lid.languages.length;
    }
  }
  if (object(detection.enrichment?.pronunciationAssessment)) {
    features.pronunciationAssessment = { present: true };
  }
  if (object(detection.speakerDiarization)) {
    features.speakerDiarization = { present: true };
    const mode = choice("Anonymous")(detection.speakerDiarization.mode);
    if (mode !== undefined) features.speakerDiarization.mode = mode;
    const diarize = choice("True", "False")(detection.speakerDiarization.diarizeIntermediates);
    if (diarize !== undefined) features.speakerDiarization.diarizeIntermediates = diarize;
  }
  for (const mode of ["INTERACTIVE", "CONVERSATION", "DICTATION"]) {
    const segmentation = detection[mode]?.segmentation;
    if (!object(segmentation)) continue;
    const entry = { recognitionMode: mode };
    const strategy = choice("Normal", "Custom", "Semantic")(segmentation.mode);
    if (strategy !== undefined) entry.mode = strategy;
    for (const key of ["segmentationSilenceTimeoutMs", "segmentationForcedTimeoutMs"]) {
      if (Number.isSafeInteger(segmentation[key]) && segmentation[key] >= 0) entry[key] = segmentation[key];
    }
    (features.segmentation ??= []).push(entry);
  }
  if (object(context.phraseOutput)) {
    features.output = {};
    const format = choice("Simple", "Detailed")(context.phraseOutput.format);
    if (format !== undefined) features.output.format = format;
    const options = context.phraseOutput.detailed?.options;
    if (Array.isArray(options)) {
      features.output.options = options.filter((item) => ["WordTimings", "WordConfidence", "SNR"].includes(item)).slice(0, 10);
    }
  }
  if (Array.isArray(context.dgi?.Groups)) {
    let count = 0;
    for (const group of context.dgi.Groups) {
      if (Array.isArray(group?.Items)) count += group.Items.length;
    }
    features.phraseList = { itemCount: count };
  }
  return features;
}

async function* lines(file) {
  const stream = createReadStream(file, { encoding: "utf8" });
  let pending = "";
  let oversized = false;
  let bytes = 0;
  for await (const chunk of stream) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > MAX_BYTES) throw new Error("INPUT_TOO_LARGE");
    let start = 0;
    for (let index = chunk.indexOf("\n"); index !== -1; index = chunk.indexOf("\n", start)) {
      const part = chunk.slice(start, index);
      yield oversized || pending.length + part.length > MAX_RECORD_CHARS ? null : (pending + part).replace(/\r$/, "");
      pending = "";
      oversized = false;
      start = index + 1;
    }
    const tail = chunk.slice(start);
    if (!oversized && pending.length + tail.length <= MAX_RECORD_CHARS) pending += tail;
    else {
      oversized = true;
      pending = "";
    }
  }
  if (oversized) yield null;
  else if (pending) yield pending.replace(/\r$/, "");
}

function jsonPayload(message, label) {
  const match = message.match(new RegExp(`^${label}(?:='([\\s\\S]*)'|\\s+([\\s\\S]*))$`));
  if (!match) return undefined;
  return JSON.parse(match[1] ?? match[2]);
}

export async function analyze(file, maxObservations = 1000) {
  if (!Number.isInteger(maxObservations) || maxObservations < 1 || maxObservations > 10000) throw new Error("INVALID_LIMIT");
  const info = await stat(file);
  if (!info.isFile()) throw new Error("NOT_A_FILE");
  if (info.size > MAX_BYTES) throw new Error("INPUT_TOO_LARGE");
  const coverage = {
    format: "unrecognized", lines: 0, nativeRecords: 0, unrecognizedLines: 0,
    oversizedRecords: 0, malformedJsonRecords: 0, unhandledNativeRecords: 0,
    omittedObservations: 0, relativeClockRegressions: 0, observedVersions: [], omittedVersions: 0,
    sourceCompatibility: "unknown", utcMapping: "not_established",
    sessionAttribution: "explicit_ids_only",
    captureCompleteness: "unknown",
  };
  const observations = [];
  const versions = new Set();
  let record;
  let previousTime;
  function emit(entry) {
    if (observations.length < maxObservations) observations.push(entry);
    else coverage.omittedObservations++;
  }
  function consume(current) {
    if (!current) return;
    if (current.oversized) {
      coverage.oversizedRecords++;
      return;
    }
    const { message, ...anchor } = current;
    const add = (kind, fields) => emit({ kind, ...anchor, ...fields });
    const source = current.codeFile;
    let match;
    let headerObserved = false;
    if (["web_socket.cpp", "usp_connection.cpp", "uws_client.c"].includes(source)) {
      // Only standalone protocol headers, never GUID-like strings in free text.
      for (const header of message.matchAll(new RegExp(`^X-ConnectionId: (${ID})\\r?$`, "gm"))) {
        add("connection_header", { connectionId: header[1] });
        headerObserved = true;
      }
    }
    if (source === "named_properties.h" || source === "property_bag_impl.cpp") {
      // The SDK does not escape apostrophes in logged values, so take everything up to the final delimiter.
      match = message.match(new RegExp(`^ISpx(?:NamedProperties|PropertyBagImpl)::(GetStringValue|SetStringValue): this=(${POINTER}); name='([^']+)'; value='([\\s\\S]*)'$`));
      if (match) {
        const [, method, address, name, raw] = match;
        const fields = { access: method === "SetStringValue" ? "write" : "read", object: pointer(address), name };
        if (name === "SessionId" && identifier(raw)) {
          add("session_property", { ...fields, sessionId: raw });
        } else if (name === "RESULT-RequestId" && identifier(raw)) {
          add("request_property", { ...fields, protocolRequestId: raw });
        } else if (PRESENCE_PROPERTIES.has(name)) {
          add("property", { ...fields, value: "present_value_withheld" });
        } else if (PROPERTIES.has(name)) {
          const value = PROPERTIES.get(name)(raw);
          add("property", { ...fields, value: value ?? "value_not_allowlisted" });
        }
        return;
      }
    }
    if (source === "usp_reco_engine_adapter.cpp" || source === "usp_tts_engine_adapter.cpp") {
      for (const label of ["speech.config", "speech.context"]) {
        if (!message.startsWith(label)) continue;
        try {
          const payload = jsonPayload(message, label.replace(".", "\\."));
          if (!object(payload)) {
            coverage.malformedJsonRecords++;
            return;
          }
          if (label === "speech.config") {
            const version = payload.context?.system?.version;
            if (typeof version === "string" && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(version)) {
              if (versions.size < 100 || versions.has(version)) versions.add(version);
              else coverage.omittedVersions++;
              add("sdk_version", { version });
            }
          } else {
            const fields = { features: contextFeatures(payload), evidence: "generated_context_only" };
            const session = identifier(payload.phraseDetection?.speakerDiarization?.audioSessionId);
            if (session) fields.sessionId = session;
            add("request_context", fields);
          }
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
          coverage.malformedJsonRecords++;
        }
        return;
      }
    }
    if (source === "audio_stream_session.cpp") {
      match = message.match(new RegExp(`^\\[(${POINTER})\\]CSpxAudioStreamSession::FireSession(Started|Stopped)Event: Firing Session(?:Started|Stopped) event: SessionId: (${ID})\\s*$`));
      if (match) {
        add("session_event", { object: pointer(match[1]), event: match[2] === "Started" ? "started" : "stopped", sessionId: match[3] });
        return;
      }
    }
    if (source === "recognition_result.cpp") {
      // These traces log __FUNCTION__: MSVC includes the class prefix, GCC/Clang do not.
      match = message.match(new RegExp(`^(?:CSpxRecognitionResult::)?Init(Intermediate|Final)Result: resultId=(${ID})(?:\\s|$)`));
      if (match) {
        const fields = { stage: match[1].toLowerCase(), resultId: match[2] };
        const reason = message.match(new RegExp(`^(?:CSpxRecognitionResult::)?InitFinalResult: resultId=${ID} reason=(\\d{1,6}),`));
        if (reason) fields.reasonCode = Number(reason[1]);
        add("recognition_result", fields);
        return;
      }
    }
    if (source === "synthesizer.cpp") {
      match = message.match(new RegExp(`^(?:CSpxSynthesizer::)?ExecuteSynthesis: synthesis (started|done), request id: (${ID});`));
      if (match) {
        add("synthesis_event", { event: match[1], synthesisRequestId: match[2] });
        return;
      }
    }
    if (source === "usp_connection.cpp") {
      match = message.match(new RegExp(`^CSpxUspConnection::SetConfiguration Set UspConnection Configuration with SessionId: (${ID})\\s*$`));
      if (match) {
        add("connection_configuration", { sessionId: match[1] });
        return;
      }
    }
    if (source === "uws_client.c") {
      match = message.match(/^Received WebSocket upgrade response with status code (\d{3})(?:\r?\n|$)/);
      if (match) {
        add("websocket_upgrade", { statusCode: Number(match[1]) });
        return;
      }
    }
    if (source === "web_socket.cpp") {
      match = message.match(new RegExp(`^WS \\[(${POINTER})\\] open operation failed with result=(\\d{1,6})\\([A-Z_]+\\), code=(-?\\d{1,10})(?:\\[|,)`));
      if (match) {
        add("websocket_open_error", { object: pointer(match[1]), resultCode: Number(match[2]), errorCode: Number(match[3]) });
        return;
      }
    }
    if (/^socketio_(?:win32|berkeley)\.c$/.test(source)) {
      match = message.match(/^Failure: getaddrinfo failure (-?\d{1,10})(?:\s|$)/);
      if (match) {
        add("dns_error", { errorCode: Number(match[1]) });
        return;
      }
    }
    if (!headerObserved) coverage.unhandledNativeRecords++;
  }
  for await (let line of lines(file)) {
    coverage.lines++;
    if (coverage.lines === 1 && line !== null) line = line.replace(/^\uFEFF/, "");
    if (line === null) {
      consume(record);
      record = undefined;
      coverage.oversizedRecords++;
      continue;
    }
    const match = line.match(HEADER);
    if (match) {
      consume(record);
      const time = Number(match[2]);
      if (previousTime !== undefined && time < previousTime) coverage.relativeClockRegressions++;
      previousTime = time;
      coverage.nativeRecords++;
      record = {
        lineStart: coverage.lines, lineEnd: coverage.lines,
        relativeMs: time, threadMarker: Number(match[1]),
        codeFile: match[4].split(/[\\/]/).at(-1), codeLine: Number(match[5]),
        message: match[6],
      };
    } else if (record) {
      coverage.unrecognizedLines++;
      record.lineEnd = coverage.lines;
      if (record.message.length + line.length + 1 <= MAX_RECORD_CHARS && !record.oversized) record.message += `\n${line}`;
      else record.oversized = true;
    } else {
      coverage.unrecognizedLines++;
    }
  }
  consume(record);
  coverage.format = coverage.nativeRecords ? "native_text" : "unrecognized";
  coverage.observedVersions = [...versions].sort();
  coverage.sourceCompatibility = versions.size === 0 ? "unknown"
    : versions.size === 1 && versions.has("1.51.2") ? "matches_reviewed_version" : "unreviewed_or_mixed_versions";
  if (coverage.omittedVersions) coverage.sourceCompatibility = "unreviewed_or_mixed_versions";
  const ids = { sessions: [], results: [], synthesisRequests: [], protocolRequests: [], connections: [] };
  for (const entry of observations) {
    entry.scope = entry.sessionId ? "explicit_session" : entry.synthesisRequestId ? "explicit_synthesis_request"
      : entry.resultId ? "explicit_result" : entry.object ? "object_only" : "unassociated";
    for (const [key, list] of [["sessionId", "sessions"], ["resultId", "results"], ["synthesisRequestId", "synthesisRequests"], ["protocolRequestId", "protocolRequests"], ["connectionId", "connections"]]) {
      if (entry[key] && !ids[list].includes(entry[key])) ids[list].push(entry[key]);
    }
  }
  return {
    schemaVersion: 1,
    source: { sdkVersion: "1.51.2", commit: SOURCE_COMMIT },
    coverage, ids, observations,
    limits: [
      "Allowlist summary, not a sanitized copy of the input.",
      "IDs and observations are unverified log claims; review before external sharing.",
      "No thread/time-only session attribution. Missing observations do not mean disabled or healthy.",
      "Relative time is not UTC. No automatic root cause or service-health conclusion.",
    ],
  };
}

async function main(args) {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    console.log("Usage: node analyze-speech-sdk-log.mjs --file <UTF-8-log> [--max-observations <1-10000>]");
    return;
  }
  let file;
  let limit = 1000;
  const seen = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!["--file", "--max-observations"].includes(flag) || seen.has(flag) || !value) throw new Error("INVALID_ARGUMENTS");
    seen.add(flag);
    if (flag === "--file") file = value;
    else {
      if (!/^\d{1,5}$/.test(value)) throw new Error("INVALID_LIMIT");
      limit = Number(value);
    }
  }
  if (!file) throw new Error("MISSING_FILE");
  console.log(JSON.stringify(await analyze(file, limit), null, 2));
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]))) {
  main(process.argv.slice(2)).catch((error) => {
    const usageErrors = new Set(["INVALID_ARGUMENTS", "INVALID_LIMIT", "MISSING_FILE"]);
    const known = new Set([...usageErrors, "NOT_A_FILE", "INPUT_TOO_LARGE"]);
    const code = known.has(error.message) ? error.message
      : ["ENOENT", "EACCES", "EPERM", "EISDIR"].includes(error.code) ? error.code : "READ_OR_ANALYSIS_FAILED";
    console.error(JSON.stringify({ error: code, help: "Use --help. Input contents and paths are withheld." }));
    process.exitCode = usageErrors.has(code) ? 2 : 1;
  });
}
