#!/usr/bin/env node
// Local allowlist inspector for Azure Speech audio containers and batch status/files JSON.
// Exit codes: 0 = report written to stdout or --help, 1 = file/read/size/JSON error, 2 = usage/argument error.
import { realpathSync } from "node:fs";
import { open } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FAST_MAX_BYTES = 500 * 1024 * 1024;
const FAST_MAX_SECONDS = 5 * 3600;
const BATCH_MAX_BYTES = 1024 * 1024 * 1024;
const MAX_JSON_BYTES = 32 * 1024 * 1024;
const MODES = new Set([
  "realtime-sdk",
  "fast-transcription",
  "batch-transcription",
  "batch-transcription-files",
  "batch-synthesis-job",
]);
const WAV_TAGS = new Map([
  [0x0001, "pcm"],
  [0x0003, "ieee_float"],
  [0x0006, "alaw"],
  [0x0007, "mulaw"],
  [0x0055, "mp3"],
  [0xfffe, "extensible"],
]);
// Bytes 2..16 of KSDATAFORMAT_SUBTYPE_WAVEFORMATEX: 00000000-0000-0010-8000-00AA00389B71 (after 2-byte LE tag).
const KS_WAVEFORMATEX_GUID_TAIL = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71,
]);
const SAFE_CODE = /^[A-Za-z0-9._:-]{1,80}$/;

function usage() {
  return [
    "Usage: node inspect-speech-audio.mjs --file <audio-or-json-path> [--mode realtime-sdk|fast-transcription|batch-transcription|batch-transcription-files|batch-synthesis-job]",
    "",
    "Inspects local audio headers or Speech batch status/files JSON offline without emitting audio or transcript content.",
    "Exit codes: 0 = report written or --help, 1 = file/read/size/JSON error, 2 = usage/argument error.",
  ].join("\n");
}

async function readSlice(handle, offset, length) {
  const buffer = Buffer.alloc(Math.max(0, length));
  if (buffer.length === 0) return buffer;
  const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
  return buffer.subarray(0, bytesRead);
}

const MAX_WAV_CHUNKS = 4096;

async function parseWav(handle, byteLength) {
  if (byteLength < 12) return { container: "unrecognized" };
  let offset = 12;
  let fmt;
  let dataOffset;
  let declaredDataBytes;
  let chunksSeen = 0;

  // Walk chunk headers across the whole file (8 bytes each) so large LIST/JUNK/bext chunks before
  // "data" are skipped instead of hiding the data chunk.
  while (offset + 8 <= byteLength && chunksSeen < MAX_WAV_CHUNKS) {
    chunksSeen += 1;
    const header = await readSlice(handle, offset, 8);
    if (header.length < 8) break;
    const id = header.toString("ascii", 0, 4);
    const chunkSize = header.readUInt32LE(4);
    const bodyStart = offset + 8;
    if (id === "fmt " && chunkSize >= 16) {
      const body = await readSlice(handle, bodyStart, Math.min(chunkSize, 64));
      if (body.length >= 16) {
        const formatTag = body.readUInt16LE(0);
        let codec;
        if (formatTag === 0xfffe) {
          const validExtensible =
            chunkSize >= 40 &&
            body.length >= 40 &&
            body.readUInt16LE(16) >= 22 &&
            body.subarray(26, 40).equals(KS_WAVEFORMATEX_GUID_TAIL);
          if (validExtensible) {
            const subFormatTag = body.readUInt16LE(24);
            codec = subFormatTag !== 0xfffe
              ? (WAV_TAGS.get(subFormatTag) ?? `extensible_tag_${subFormatTag}`)
              : "extensible_unknown";
          } else {
            codec = "extensible_unknown";
          }
        } else {
          codec = WAV_TAGS.get(formatTag) ?? `tag_${formatTag}`;
        }
        fmt = {
          formatTag,
          codec,
          isExtensible: formatTag === 0xfffe,
          channels: body.readUInt16LE(2),
          sampleRate: body.readUInt32LE(4),
          byteRate: body.readUInt32LE(8),
          blockAlign: body.readUInt16LE(12),
          bitsPerSample: body.readUInt16LE(14),
        };
      }
    } else if (id === "data") {
      dataOffset = bodyStart;
      declaredDataBytes = chunkSize;
      break;
    }
    offset = bodyStart + chunkSize + (chunkSize % 2);
  }

  const chunkScanIncomplete = dataOffset === undefined && offset + 8 <= byteLength && chunksSeen >= MAX_WAV_CHUNKS;

  let actualRemainingBytes;
  let truncated = false;
  let rawDurationSeconds;
  let durationSeconds;
  let sampledZeroSilence;
  if (dataOffset !== undefined && declaredDataBytes !== undefined) {
    actualRemainingBytes = Math.max(0, byteLength - dataOffset);
    truncated = declaredDataBytes !== 0xffffffff && actualRemainingBytes < declaredDataBytes;
    const effectiveBytes = Math.min(declaredDataBytes, actualRemainingBytes);
    if (fmt && fmt.byteRate > 0) {
      rawDurationSeconds = effectiveBytes / fmt.byteRate;
      durationSeconds = Number(rawDurationSeconds.toFixed(3));
    }
    if (fmt && fmt.codec === "pcm" && effectiveBytes > 0) {
      const sampleLen = Math.min(effectiveBytes, 64 * 1024);
      const pcmWindow = await readSlice(handle, dataOffset, sampleLen);
      if (fmt.bitsPerSample === 8) {
        sampledZeroSilence = pcmWindow.length > 0 && pcmWindow.every((b) => b === 0x80);
      } else if (fmt.bitsPerSample >= 16 && fmt.bitsPerSample % 8 === 0) {
        sampledZeroSilence = pcmWindow.length > 0 && pcmWindow.every((b) => b === 0x00);
      }
    }
  }

  return {
    container: "wav",
    ...(chunkScanIncomplete ? { chunkScanIncomplete: true } : {}),
    ...(rawDurationSeconds !== undefined ? { _rawDurationSeconds: rawDurationSeconds } : {}),
    ...(fmt ? { wavFormat: fmt } : {}),
    ...(declaredDataBytes !== undefined
      ? {
          dataChunk: {
            declaredBytes: declaredDataBytes,
            availableBytes: actualRemainingBytes,
            truncated,
            ...(durationSeconds !== undefined ? { estimatedDurationSeconds: durationSeconds } : {}),
            ...(sampledZeroSilence !== undefined ? { firstWindowAllZero: sampledZeroSilence } : {}),
          },
        }
      : {}),
  };
}

async function detectAudioContainer(handle, byteLength) {
  if (byteLength === 0) return { container: "empty" };
  const head = await readSlice(handle, 0, Math.min(byteLength, 4096));
  if (head.length >= 12 && head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WAVE") {
    return parseWav(handle, byteLength);
  }
  if (head.length >= 4 && head.toString("ascii", 0, 4) === "fLaC") return { container: "flac" };
  if (head.length >= 4 && head.toString("ascii", 0, 4) === "OggS") return { container: "ogg" };
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    return { container: "webm_or_matroska" };
  }
  if (head.length >= 12 && head.toString("ascii", 4, 8) === "ftyp") return { container: "mp4_or_m4a" };
  if (head.length >= 5 && head.toString("ascii", 0, 5) === "#!AMR") return { container: "amr" };
  if (
    (head.length >= 3 && head.toString("ascii", 0, 3) === "ID3") ||
    (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0)
  ) {
    return { container: "mp3" };
  }
  return { container: "unrecognized" };
}

function inspectBatchJson(raw, mode) {
  const findings = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("INVALID_BATCH_JSON");
  }
  if (mode === "batch-synthesis-job") {
    const status = typeof raw.status === "string" && SAFE_CODE.test(raw.status) ? raw.status : "unknown";
    const props = raw.properties && typeof raw.properties === "object" ? raw.properties : {};
    const succeeded = Number.isInteger(props.succeededAudioCount) ? props.succeededAudioCount : undefined;
    const failed = Number.isInteger(props.failedAudioCount) ? props.failedAudioCount : undefined;
    const errorCode = typeof raw.error?.code === "string" && SAFE_CODE.test(raw.error.code) ? raw.error.code : undefined;

    if (status === "Succeeded" && typeof failed === "number" && failed > 0) {
      findings.push({
        code: "PARTIAL_SYNTHESIS_FAILURES",
        severity: "warning",
        detail: `Batch synthesis job status is Succeeded, but failedAudioCount is ${failed}.`,
      });
    }
    if (status === "Failed") {
      findings.push({
        code: "BATCH_SYNTHESIS_FAILED",
        severity: "error",
        detail: `Batch synthesis job ended in Failed state${errorCode ? ` (code: ${errorCode})` : ""}.`,
      });
    }
    return {
      mode,
      status: findings.some((f) => f.severity === "error")
        ? "failed_preflight"
        : status === "unknown"
          ? "unknown"
          : findings.some((f) => f.severity === "warning") ? "passed_with_warnings" : "passed_local_checks",
      batchSynthesis: {
        jobStatus: status,
        inputKind: ["SSML", "PlainText"].includes(raw.inputKind) ? raw.inputKind : "unknown",
        ...(succeeded !== undefined ? { succeededAudioCount: succeeded } : {}),
        ...(failed !== undefined ? { failedAudioCount: failed } : {}),
        hasResultArchive: Boolean(raw.outputs?.result),
        ...(errorCode ? { errorCode } : {}),
      },
      findings,
    };
  }

  // Transcription report file (the contentUrl of the "TranscriptionReport" entry): the only place
  // where per-input outcomes appear. Only the documented count fields and details[].status are read;
  // details[].source (may carry SAS) and any other per-entry text are never echoed.
  const isReport = Number.isInteger(raw.successfulTranscriptionsCount)
    || Number.isInteger(raw.failedTranscriptionsCount)
    || (Array.isArray(raw.details) && !Array.isArray(raw.values));
  if (isReport) {
    const details = Array.isArray(raw.details) ? raw.details : [];
    let failedDetails = 0;
    for (const d of details) {
      if (d && typeof d === "object" && d.status === "Failed") failedDetails += 1;
    }
    const failed = Number.isInteger(raw.failedTranscriptionsCount)
      ? Math.max(raw.failedTranscriptionsCount, failedDetails)
      : failedDetails;
    const succeeded = Number.isInteger(raw.successfulTranscriptionsCount) ? raw.successfulTranscriptionsCount : undefined;
    if (failed > 0) {
      findings.push({
        code: "BATCH_FILE_FAILURES_PRESENT",
        severity: "error",
        detail: `Transcription report lists ${failed} failed input(s); review the details[] entries with status Failed locally (sources are not echoed here).`,
      });
    } else if (succeeded === 0) {
      findings.push({
        code: "NO_SUCCESSFUL_TRANSCRIPTIONS",
        severity: "warning",
        detail: "Transcription report lists 0 successful and 0 failed inputs; confirm contentUrls/contentContainerUrl matched any audio.",
      });
    }
    return {
      mode,
      status: findings.some((f) => f.severity === "error")
        ? "failed_preflight"
        : findings.some((f) => f.severity === "warning") ? "passed_with_warnings" : "passed_local_checks",
      batchTranscriptionReport: {
        ...(succeeded !== undefined ? { successfulTranscriptionsCount: succeeded } : {}),
        failedTranscriptionsCount: failed,
        detailEntries: details.length,
      },
      findings,
    };
  }

  const values = Array.isArray(raw.values) ? raw.values : undefined;
  if (!values) {
    findings.push({
      code: "UNRECOGNIZED_BATCH_FILES_JSON",
      severity: "warning",
      detail: "Expected a Transcriptions - List Files payload (top-level values[]) or a transcription report file (successfulTranscriptionsCount / failedTranscriptionsCount / details).",
    });
    return { mode, status: "unknown", findings };
  }

  // Transcriptions - List Files: one "Transcription" entry per successfully transcribed input plus one
  // "TranscriptionReport" per job. Entries carry no per-file status, so failures cannot be judged here.
  const hasNextLink = typeof raw["@nextLink"] === "string" && raw["@nextLink"].length > 0;
  const kindCounts = {};
  for (const item of values) {
    if (!item || typeof item !== "object") continue;
    const kind = typeof item.kind === "string" && SAFE_CODE.test(item.kind) ? item.kind : "unknown";
    kindCounts[kind] = (kindCounts[kind] ?? 0) + 1;
  }
  const reportListed = (kindCounts.TranscriptionReport ?? 0) > 0;

  if (hasNextLink) {
    findings.push({
      code: "PAGINATED_FILES_INCOMPLETE",
      severity: "warning",
      detail: "@nextLink is present; this JSON captures only one page of result files (the report entry may be on another page).",
    });
  }
  if (!reportListed && !hasNextLink) {
    findings.push({
      code: "TRANSCRIPTION_REPORT_NOT_LISTED",
      severity: "warning",
      detail: "No TranscriptionReport entry in a complete file list; confirm the transcription status is Succeeded before reading results.",
    });
  }
  findings.push({
    code: "FAILURES_ONLY_IN_TRANSCRIPTION_REPORT",
    severity: "info",
    detail: "List Files has one Transcription entry per successful input and no per-file status. Download the TranscriptionReport contentUrl locally and re-run this mode on that file to count failed inputs.",
  });

  return {
    mode,
    status: "unknown",
    batchTranscriptionFiles: {
      retainedEntries: values.length,
      paginationComplete: !hasNextLink,
      kindCounts,
      transcriptionResultFiles: kindCounts.Transcription ?? 0,
      transcriptionReportListed: reportListed,
    },
    findings,
  };
}

export async function inspectSpeechAudio({ file, mode = "realtime-sdk" } = {}) {
  if (!file) throw new Error("MISSING_INPUT");
  const normalizedMode = String(mode).toLowerCase();
  if (!MODES.has(normalizedMode)) throw new Error("INVALID_MODE");

  let handle;
  try {
    handle = await open(file, "r");
  } catch (err) {
    if (err?.code === "EISDIR") throw new Error("NOT_A_FILE");
    throw err;
  }

  let info;
  let parsedAudio;
  try {
    info = await handle.stat();
    if (!info.isFile()) throw new Error("NOT_A_FILE");

    if (normalizedMode === "batch-transcription-files" || normalizedMode === "batch-synthesis-job") {
      if (info.size > MAX_JSON_BYTES) throw new Error("INPUT_TOO_LARGE");
      const parsed = JSON.parse(await handle.readFile("utf8"));
      return inspectBatchJson(parsed, normalizedMode);
    }

    parsedAudio = await detectAudioContainer(handle, info.size);
  } finally {
    await handle.close();
  }

  const { _rawDurationSeconds: rawDurationSeconds, ...audio } = parsedAudio;
  const extension = extname(file).toLowerCase();
  const findings = [];

  if (audio.container === "empty") {
    findings.push({ code: "EMPTY_AUDIO_FILE", severity: "error", detail: "Audio file is 0 bytes." });
  } else if (audio.container === "unrecognized") {
    findings.push({
      code: "UNRECOGNIZED_AUDIO_CONTAINER",
      severity: "warning",
      detail: "Header bytes did not match WAV, MP3, FLAC, OGG, WebM, MP4/M4A, or AMR.",
    });
  }

  if (extension === ".wav" && audio.container !== "wav" && audio.container !== "empty" && audio.container !== "unrecognized") {
    // Only the SDK's WAV file input depends on a RIFF/WAVE header; Fast and Batch REST accept
    // compressed formats such as MP3, OGG/OPUS, FLAC and WebM.
    const sdk = normalizedMode === "realtime-sdk";
    findings.push({
      code: "WAV_EXTENSION_CONTAINER_MISMATCH",
      severity: sdk ? "error" : "info",
      detail: sdk
        ? `File has a '.wav' extension, but header bytes indicate '${audio.container}'; Speech SDK WAV file input needs a RIFF/WAVE header.`
        : `File has a '.wav' extension, but header bytes indicate '${audio.container}'; check that this format is in the REST supported-format list.`,
    });
  }

  if (audio.container === "wav") {
    if (!audio.wavFormat) {
      if (!audio.chunkScanIncomplete) {
        findings.push({ code: "MISSING_WAV_FMT_CHUNK", severity: "error", detail: "WAV file has no readable fmt chunk." });
      }
    } else {
      if (normalizedMode === "realtime-sdk" && audio.wavFormat.codec !== "pcm") {
        findings.push({
          code: "NON_PCM_WAV_FOR_REALTIME_SDK",
          severity: "warning",
          detail: `WAV codec is '${audio.wavFormat.codec}'; Speech SDK FromWavFileInput expects uncompressed PCM unless GStreamer/compressed input stream is configured.`,
        });
      }
      if (normalizedMode === "realtime-sdk" && (audio.wavFormat.sampleRate !== 16000 || audio.wavFormat.bitsPerSample !== 16)) {
        findings.push({
          code: "NON_DEFAULT_SDK_PCM_FORMAT",
          severity: "info",
          detail: `Observed ${audio.wavFormat.sampleRate} Hz / ${audio.wavFormat.bitsPerSample}-bit / ${audio.wavFormat.channels}-ch; pass explicit AudioStreamFormat if feeding PushAudioInputStream.`,
        });
      }
    }
    if (audio.chunkScanIncomplete) {
      findings.push({
        code: "WAV_CHUNK_SCAN_INCOMPLETE",
        severity: "warning",
        detail: `WAV chunk scan stopped after ${MAX_WAV_CHUNKS} chunks before reaching a 'data' chunk; audio data presence and duration remain unknown.`,
      });
    } else if (!audio.dataChunk) {
      findings.push({ code: "MISSING_WAV_DATA_CHUNK", severity: "error", detail: "WAV file has no data chunk (header-only or malformed chunk list)." });
    } else if (audio.dataChunk.declaredBytes === 0 || audio.dataChunk.availableBytes === 0) {
      findings.push({ code: "EMPTY_WAV_DATA_CHUNK", severity: "error", detail: "WAV data chunk contains no audio samples." });
    }
    if (audio.dataChunk?.truncated) {
      findings.push({
        code: "TRUNCATED_WAV_DATA_CHUNK",
        severity: "warning",
        detail: `WAV data chunk declares ${audio.dataChunk.declaredBytes} bytes, only ${audio.dataChunk.availableBytes} bytes exist.`,
      });
    }
    if (audio.dataChunk?.firstWindowAllZero) {
      findings.push({
        code: "LEADING_DIGITAL_SILENCE",
        severity: "warning",
        detail: "Initial PCM window contains only digital-silence samples; verify microphone/capture routing if NoMatch occurs.",
      });
    }
  } else if (normalizedMode === "realtime-sdk" && audio.container !== "empty" && audio.container !== "unrecognized") {
    findings.push({
      code: "COMPRESSED_AUDIO_REQUIRES_GSTREAMER_OR_REST",
      severity: "warning",
      detail: `Container '${audio.container}' is compressed; Speech SDK requires PushAudioInputStream with AudioStreamContainerFormat + GStreamer, or use Fast/Batch Transcription REST API.`,
    });
  }

  if (normalizedMode === "fast-transcription") {
    if (info.size >= FAST_MAX_BYTES) {
      findings.push({
        code: "EXCEEDS_FAST_TRANSCRIPTION_SIZE_LIMIT",
        severity: "error",
        detail: `File size (${info.size} bytes) meets or exceeds the < 500 MB Fast Transcription limit.`,
      });
    }
    if (rawDurationSeconds === undefined) {
      findings.push({
        code: "DURATION_NOT_DETERMINED",
        severity: "info",
        detail: "Duration could not be computed locally for this container; the < 5 hour Fast Transcription limit was not checked.",
      });
    } else if (rawDurationSeconds >= FAST_MAX_SECONDS) {
      const shownDuration = audio.dataChunk?.estimatedDurationSeconds ?? Number(rawDurationSeconds.toFixed(3));
      findings.push({
        code: "EXCEEDS_FAST_TRANSCRIPTION_DURATION_LIMIT",
        severity: "error",
        detail: `Estimated duration (${shownDuration}s) meets or exceeds the < 5 hour Fast Transcription limit.`,
      });
    }
  } else if (normalizedMode === "batch-transcription" && info.size > BATCH_MAX_BYTES) {
    findings.push({
      code: "EXCEEDS_BATCH_TRANSCRIPTION_SIZE_LIMIT",
      severity: "error",
      detail: `File size (${info.size} bytes) exceeds the 1 GB Batch Transcription per-file limit.`,
    });
  }

  const hasError = findings.some((f) => f.severity === "error");
  const status = hasError
    ? "failed_preflight"
    : audio.container === "unrecognized" || audio.chunkScanIncomplete
      ? "unknown"
      : findings.some((f) => f.severity === "warning") ? "passed_with_warnings" : "passed_local_checks";

  return {
    mode: normalizedMode,
    status,
    audio: {
      extension: /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : extension ? "(other)" : "(none)",
      byteLength: info.size,
      ...audio,
    },
    findings,
  };
}

function parseCli(argv) {
  const opts = { mode: "realtime-sdk" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--file") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.file = resolve(argv[++i]);
    } else if (arg === "--mode") {
      if (!argv[i + 1] || argv[i + 1].startsWith("-")) throw new Error("USAGE");
      opts.mode = argv[++i];
    } else {
      throw new Error("USAGE");
    }
  }
  if (!opts.file || !MODES.has(String(opts.mode).toLowerCase())) throw new Error("USAGE");
  return opts;
}

async function main() {
  let opts;
  try {
    opts = parseCli(process.argv.slice(2));
  } catch {
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }
  if (opts.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  try {
    const report = await inspectSpeechAudio(opts);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (err) {
    const code = err instanceof SyntaxError ? "INVALID_JSON" : (err?.code || err?.message || "READ_ERROR");
    process.stderr.write(`${JSON.stringify({ error: String(code) })}\n`);
    process.exit(1);
  }
}

try {
  if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    await main();
  }
} catch {
  // Imported as module
}
