// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Vally grader plugin: rust-cargo-build-failure-check (Rust-specific)
 *
 * Inspects the trajectory for shell tool_call events containing "cargo build",
 * "cargo check", "cargo clippy", or "cargo lint" and their corresponding
 * tool_result events. Detects failed Rust operations, extracts Rust compiler
 * errors (E0XXX codes), and scales the score by failure ratio: more failures => lower score.
 *
 * Usage in eval.yaml:
 *   graders:
 *     - type: rust-cargo-build-failure-check
 *
 * Load via CLI:
 *   vally eval -e eval.yaml --grader-plugin ./path/to/rust-cargo-build-failure
 */

import type {
  Grader,
  GraderInput,
  GraderMetadata,
  GraderRegistry,
  GraderResult,
  TrajectoryEvent,
} from "@microsoft/vally";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

interface CompilerError {
  errorCode: string;
  message: string;
  lineInfo?: string;
}

interface ErrorException {
  error_code: string;
  message_pattern: string;
  action: "ignore_for_fail";
}

interface GraderConfig {
  collect_trajectory_compiler_errors?: boolean;
  // Deprecated alias; use collect_trajectory_compiler_errors.
  collect_compiler_errors?: boolean;
  emit_in_metadata?: boolean;
  error_exceptions?: ErrorException[];
  execute_cargo_commands?: boolean;
  cargo_commands?: string[];
  commands?: Array<string | { command?: string }>;
  workspace_dir?: string;
}

interface BuildCall {
  toolCallId: string;
  toolName: string;
  command: string;
  failed: boolean;
  failureReason?: string;
  resultExcerpt?: string;
  compilerErrors?: CompilerError[];
}

// ── Helpers ────────────────────────────────────────────────────────────

const SHELL_TOOLS = new Set(["powershell", "bash"]);

function isShellTool(name: string): boolean {
  return SHELL_TOOLS.has(name.toLowerCase());
}

/** Normalize a 1–10 raw score to 0–1 range. */
function normalize(raw: number): number {
  return (raw - 1) / 9;
}

/**
 * Compute a raw score (1–10) based on failure ratio.
 * 0 failed => 10. Higher failure ratio => lower score, minimum 1.
 */
function scaledScore(failedCount: number, totalBuilds: number): number {
  if (totalBuilds === 0) return 7;
  const penalty = Math.ceil((failedCount / totalBuilds) * 9);
  return Math.max(1, 10 - penalty);
}

/** Truncate text to maxLen chars. */
function truncate(s: string, maxLen = 280): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + "...";
}

/**
 * Check if a command is a Rust cargo command (build, check, clippy, lint).
 */
function isCargoCommand(command: string): boolean {
  const lower = command.toLowerCase();
  return (
    lower.includes("cargo build") ||
    lower.includes("cargo check") ||
    lower.includes("cargo clippy") ||
    lower.includes("cargo lint")
  );
}

const DEFAULT_POST_CARGO_COMMANDS = [
  "cargo build",
  "cargo check",
  "cargo clippy",
];

function resolveConfiguredCargoCommands(config: GraderConfig): string[] {
  const fromCargoCommands =
    Array.isArray(config.cargo_commands) && config.cargo_commands.length > 0
      ? config.cargo_commands
      : [];

  const fromCommands = Array.isArray(config.commands)
    ? config.commands
        .map((entry) => {
          if (typeof entry === "string") return entry;
          if (
            entry &&
            typeof entry === "object" &&
            typeof entry.command === "string"
          ) {
            return entry.command;
          }
          return "";
        })
        .filter((entry) => entry.trim().length > 0)
    : [];

  const merged = [...fromCargoCommands, ...fromCommands]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  // Keep order, remove duplicates. Return only explicitly specified commands.
  return [...new Set(merged)];
}

/**
 * Search for Cargo.toml starting from startDir and going up the directory tree.
 * Returns the directory containing Cargo.toml, or undefined if not found.
 */
function findCargoToml(startDir: string): string | undefined {
  let current = resolve(startDir);
  const root = resolve("/");

  while (current !== root && current.length > 3) {
    if (existsSync(resolve(current, "Cargo.toml"))) {
      return current;
    }
    current = dirname(current);
  }

  return undefined;
}

function resolveWorkspaceDir(
  input: GraderInput,
  config: GraderConfig,
): string | undefined {
  // 1. Check explicit config override
  if (typeof config.workspace_dir === "string" && config.workspace_dir.trim()) {
    return config.workspace_dir.trim();
  }

  // 2. Check trajectory.workDir (Vally provides this to every grader input)
  const rawInput = input as unknown as Record<string, unknown>;
  const trajectory = rawInput["trajectory"];
  if (trajectory && typeof trajectory === "object") {
    const trajectoryRecord = trajectory as Record<string, unknown>;
    if (
      typeof trajectoryRecord["workDir"] === "string" &&
      trajectoryRecord["workDir"].trim()
    ) {
      return trajectoryRecord["workDir"].trim();
    }
  }

  // 3. Check input-level workspace path candidates
  const candidateKeys = [
    "workspacePath",
    "workspace_path",
    "workspaceDir",
    "workspace_dir",
    "workspace",
  ];

  for (const key of candidateKeys) {
    const value = rawInput[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  // 4. Check metadata-level workspace path candidates
  const metadata = rawInput["metadata"];
  if (metadata && typeof metadata === "object") {
    const metadataRecord = metadata as Record<string, unknown>;
    for (const key of candidateKeys) {
      const value = metadataRecord[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  // 5. Last resort: search for Cargo.toml in the current directory and parent directories.
  const found = findCargoToml(process.cwd());
  return found;
}

function runPostCargoCommand(
  command: string,
  workspaceDir: string,
  collectCompilerErrorsInMetadata: boolean,
  errorExceptions: ErrorException[],
): BuildCall {
  const result = spawnSync(command, {
    cwd: workspaceDir,
    shell: true,
    encoding: "utf8",
  });

  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";
  const combined = `${stdout}\n${stderr}`.trim();

  const shouldParseCompilerErrors =
    combined.length > 0 &&
    (collectCompilerErrorsInMetadata || errorExceptions.length > 0);
  const compilerErrors = shouldParseCompilerErrors
    ? extractCompilerErrors(combined)
    : [];

  const failed =
    result.status !== 0 ||
    result.error !== undefined ||
    (combined.length > 0 && hasNonzeroExitMarker(combined.toLowerCase()));

  let shouldIgnoreFailure = false;
  if (failed && compilerErrors.length > 0) {
    shouldIgnoreFailure = !hasUnignoredCompilerErrors(
      compilerErrors,
      errorExceptions,
    );
  }

  const call: BuildCall = {
    toolCallId: `post:${command}`,
    toolName: "post_execution",
    command,
    failed: failed && !shouldIgnoreFailure,
  };

  if (collectCompilerErrorsInMetadata && compilerErrors.length > 0) {
    call.compilerErrors = compilerErrors;
  }

  if (call.failed) {
    if (result.error) {
      call.failureReason = `post execution error: ${result.error.message}`;
    } else if (typeof result.status === "number") {
      call.failureReason = `post command exited with code ${result.status}`;
    } else {
      call.failureReason = "post command failed";
    }
    if (combined) {
      call.resultExcerpt = truncate(combined);
    }
  }

  return call;
}

/**
 * Extract the command string from a tool_call event's arguments.
 */
function extractCommand(args: Record<string, unknown> | undefined): string {
  if (!args) return "";
  if (typeof args["command"] === "string") return args["command"];
  if (typeof args["commandLine"] === "string") return args["commandLine"];
  if (typeof args["command_line"] === "string") return args["command_line"];
  return "";
}

/**
 * Extract text content from a tool_result's result field.
 * The result field is typed as `unknown` — it may contain
 * { content: string } or { detailedContent: string }.
 */
function resultContent(result: unknown): string | undefined {
  if (result == null || typeof result !== "object") return undefined;
  const r = result as Record<string, unknown>;
  if (typeof r["detailedContent"] === "string") return r["detailedContent"];
  if (typeof r["content"] === "string") return r["content"];
  return undefined;
}

/** Check for non-zero exit code markers in output text. */
function hasNonzeroExitMarker(text: string): boolean {
  if (text.includes("<exited with exit code")) {
    return !text.includes("<exited with exit code 0>");
  }
  for (let code = 1; code <= 9; code++) {
    if (
      text.includes(`exit code: ${code}`) ||
      text.includes(`exit code ${code}`)
    ) {
      return true;
    }
  }
  return false;
}

/** Check if a tool_result event represents a failure.
 * Returns [reason, excerpt] if failed, or null if succeeded.
 */
function detectFailure(
  event: TrajectoryEvent,
): [reason: string, excerpt: string | undefined] | null {
  if (event.type !== "tool_result") return null;
  const data = event.data;

  // Explicit success=false
  if (data.success === false) {
    const content = resultContent(data.result);
    return ["tool_result.success=false", content ? content : undefined];
  }

  // Check result content for failure markers
  const content = resultContent(data.result);
  if (content) {
    const lower = content.toLowerCase();
    if (
      lower.includes("didn't exit successfully") ||
      lower.includes("did not exit successfully") ||
      lower.includes("error: process didn't exit successfully") ||
      hasNonzeroExitMarker(lower)
    ) {
      return [
        "non-zero process exit marker found in tool result content",
        truncate(content),
      ];
    }
  }

  return null;
}

/**
 * Extract Rust compiler errors from cargo output.
 * Looks for patterns like: error[E0277]: ...
 */
function extractCompilerErrors(text: string): CompilerError[] {
  const errors: CompilerError[] = [];
  // Match: error[EXXX]: message
  const errorPattern = /error\[([A-Z]\d+)\]:\s*(.+?)(?:\n|$)/g;
  let match;

  while ((match = errorPattern.exec(text)) !== null) {
    const errorCode = match[1];
    const rawMessage = match[2];
    if (!errorCode || rawMessage === undefined) continue;
    const message = rawMessage.trim();
    errors.push({
      errorCode,
      message,
    });
  }

  return errors;
}

/**
 * Check if a compiler error matches an exception rule and should be ignored for failure.
 */
function matchesException(
  error: CompilerError,
  exception: ErrorException,
): boolean {
  if (error.errorCode !== exception.error_code) return false;
  const pattern = exception.message_pattern;
  return error.message.includes(pattern);
}

/**
 * Check if any compiler errors should block grader failure (none matched an ignore_for_fail exception).
 * Returns true if there are unignored compiler errors, false otherwise.
 */
function hasUnignoredCompilerErrors(
  errors: CompilerError[],
  exceptions?: ErrorException[],
): boolean {
  if (errors.length === 0) return false;
  if (!exceptions || exceptions.length === 0) return true;

  for (const error of errors) {
    let ignored = false;
    for (const exception of exceptions) {
      if (
        exception.action === "ignore_for_fail" &&
        matchesException(error, exception)
      ) {
        ignored = true;
        break;
      }
    }
    if (!ignored) return true; // Found an unignored error
  }
  return false; // All errors were ignored
}

// ── Grader ─────────────────────────────────────────────────────────────

class CargoBuildTrajectoryGrader implements Grader {
  metadata: GraderMetadata = {
    name: "rust-cargo-build-failure-check",
    description:
      "Rust-specific grader: checks trajectory for failed cargo build tool calls, extracts Rust compiler errors (E0XXX), and scales score by failure ratio",
    behavior: { requiresWorkspace: false },
    determinism: "static",
    reference: "reference-free",
    temporalScope: "trajectory-level",
    costProfile: "free",
  };

  async grade(input: GraderInput): Promise<GraderResult> {
    const trajectory = input.trajectory;
    if (!trajectory) {
      return {
        name: this.metadata.name,
        kind: "code",
        passed: false,
        score: 0,
        evidence: "No trajectory provided",
        label: "incorrect",
        metadata: { error_kind: "missing_trajectory" },
      };
    }

    // Parse config
    const config: GraderConfig = (input.config || {}) as GraderConfig;
    const collectTrajectoryCompilerErrors =
      config.collect_trajectory_compiler_errors === true ||
      config.collect_compiler_errors === true; // default: false (opt-in)
    const includeTrajectory = collectTrajectoryCompilerErrors; // trajectory analysis is opt-in
    const emitInMetadata = config.emit_in_metadata !== false; // default: true
    const errorExceptions = config.error_exceptions || [];
    const specifiedCommands = resolveConfiguredCargoCommands(config);
    // Execute cargo commands based on this logic:
    // - If execute_cargo_commands is explicitly false, don't execute
    // - If execute_cargo_commands is explicitly true, execute (with commands or defaults)
    // - If execute_cargo_commands is undefined, execute if commands are explicitly specified
    const explicitExecuteFlag = config.execute_cargo_commands;
    let executeCargoCommands = false;
    let postCargoCommands: string[] = [];

    if (explicitExecuteFlag === false) {
      // Explicitly disabled
      executeCargoCommands = false;
      postCargoCommands = [];
    } else if (explicitExecuteFlag === true) {
      // Explicitly enabled - use provided commands or defaults
      executeCargoCommands = true;
      postCargoCommands =
        specifiedCommands.length > 0
          ? specifiedCommands
          : DEFAULT_POST_CARGO_COMMANDS;
    } else {
      // Undefined/not set - execute if commands are explicitly provided (implicit)
      if (specifiedCommands.length > 0) {
        executeCargoCommands = true;
        postCargoCommands = specifiedCommands;
      }
    }

    const events = trajectory.events;

    // Track build calls and match results.
    const trajectoryCalls: BuildCall[] = [];
    const pendingByCallId = new Map<string, number>();
    const pendingOrder: number[] = [];

    if (includeTrajectory) {
      for (const event of events) {
        if (event.type === "tool_call") {
          const { toolName, toolCallId, arguments: args } = event.data;
          const command = extractCommand(args);

          if (isShellTool(toolName) && isCargoCommand(command)) {
            const idx = trajectoryCalls.length;

            trajectoryCalls.push({
              toolCallId,
              toolName,
              command,
              failed: false,
            });

            if (toolCallId) {
              pendingByCallId.set(toolCallId, idx);
            }
            pendingOrder.push(idx);
          }
          continue;
        }

        if (event.type === "tool_result") {
          const { toolCallId } = event.data;

          // Match to a pending build call
          let matchedIdx: number | undefined;
          if (toolCallId && pendingByCallId.has(toolCallId)) {
            matchedIdx = pendingByCallId.get(toolCallId);
            pendingByCallId.delete(toolCallId);
          } else if (pendingOrder.length > 0) {
            // Fallback: match to oldest pending build
            matchedIdx = pendingOrder[0];
          } else {
            continue;
          }

          if (matchedIdx === undefined) continue;

          // Remove from pending
          const orderIdx = pendingOrder.indexOf(matchedIdx);
          if (orderIdx >= 0) pendingOrder.splice(orderIdx, 1);

          const build = trajectoryCalls[matchedIdx];
          if (!build) continue;

          // Extract compiler errors for ignore handling and optional metadata emission
          const content = resultContent(event.data.result);
          let compilerErrors: CompilerError[] = [];
          if (
            content &&
            (collectTrajectoryCompilerErrors || errorExceptions.length > 0)
          ) {
            compilerErrors = extractCompilerErrors(content);
          }

          if (collectTrajectoryCompilerErrors && compilerErrors.length > 0) {
            build.compilerErrors = compilerErrors;
          }

          // Detect failure
          const failure = detectFailure(event);
          if (failure) {
            // Check if this failure should be ignored due to error exceptions
            const shouldIgnore =
              compilerErrors.length > 0 &&
              !hasUnignoredCompilerErrors(compilerErrors, errorExceptions);

            if (!shouldIgnore) {
              build.failed = true;
              build.failureReason = failure[0];
              if (failure[1] !== undefined) {
                build.resultExcerpt = failure[1];
              }
            }
          }
        }
      }
    }

    // Run cargo quality commands against the final workspace after prompt execution.
    const workspaceDir = resolveWorkspaceDir(input, config);
    const postExecutionCalls: BuildCall[] = [];
    if (executeCargoCommands && workspaceDir) {
      for (const command of postCargoCommands) {
        if (!isCargoCommand(command)) continue;
        postExecutionCalls.push(
          runPostCargoCommand(command, workspaceDir, true, errorExceptions),
        );
      }
    }

    const allCalls = [...trajectoryCalls, ...postExecutionCalls];

    const totalBuilds = allCalls.length;
    const failedBuilds = allCalls.filter((b) => b.failed);
    const failedCount = failedBuilds.length;

    let passed: boolean;
    let rawScore: number;
    let label: string;
    let evidence: string;

    const gradingMode =
      includeTrajectory && executeCargoCommands
        ? "trajectory_and_post_execution"
        : includeTrajectory
          ? "trajectory"
          : executeCargoCommands
            ? "post_execution"
            : "none";

    if (totalBuilds === 0) {
      passed = true;
      rawScore = 7;
      label = "partially-correct";
      evidence =
        gradingMode === "post_execution"
          ? "No post-execution cargo command results were collected"
          : gradingMode === "trajectory"
            ? "No cargo command tool_call found in trajectory events"
            : "No cargo command results were collected";
    } else if (failedCount === 0) {
      passed = true;
      rawScore = 10;
      label = "correct";
      evidence =
        gradingMode === "post_execution"
          ? "No failed post-execution cargo commands detected"
          : gradingMode === "trajectory"
            ? "No failed cargo command tool_result detected for trajectory tool calls"
            : "No failed cargo commands detected";
    } else {
      passed = false;
      rawScore = scaledScore(failedCount, totalBuilds);
      label = "incorrect";
      evidence =
        gradingMode === "post_execution"
          ? `Detected ${failedCount} failed post-execution cargo command(s) out of ${totalBuilds} command(s)`
          : gradingMode === "trajectory"
            ? `Detected ${failedCount} failed trajectory cargo command(s) out of ${totalBuilds} command(s)`
            : `Detected ${failedCount} failed cargo command(s) out of ${totalBuilds} command(s)`;
    }

    const failures = failedBuilds.map(
      (b) =>
        `${b.failureReason ?? "failed cargo build"} (call_id=${b.toolCallId || "<none>"})`,
    );

    const metadata: Record<string, unknown> = {
      cargo_calls_found: totalBuilds,
      failed_cargo_count: failedCount,
      failed_cargo_ratio: totalBuilds > 0 ? failedCount / totalBuilds : 0,
      raw_score: rawScore,
      grading_mode: gradingMode,
      trajectory_analysis_enabled: includeTrajectory,
      trajectory_compiler_errors_enabled: collectTrajectoryCompilerErrors,
      post_execution_attempted: executeCargoCommands,
      summary: passed
        ? gradingMode === "post_execution"
          ? "Cargo post-execution check passed"
          : gradingMode === "trajectory"
            ? "Cargo trajectory check passed"
            : "Cargo command check passed"
        : gradingMode === "post_execution"
          ? "Cargo post-execution check failed"
          : gradingMode === "trajectory"
            ? "Cargo trajectory check failed"
            : "Cargo command check failed",
      failures,
      cargo_calls: allCalls.map((b) => ({
        tool_call_id: b.toolCallId,
        tool_name: b.toolName,
        command: b.command,
        failed: b.failed,
      })),
      failed_cargo_commands: failedBuilds.map((b) => ({
        tool_call_id: b.toolCallId,
        tool_name: b.toolName,
        command: b.command,
        reason: b.failureReason,
        result_excerpt: b.resultExcerpt,
      })),
    };

    if (executeCargoCommands) {
      metadata["post_execution_workspace"] = workspaceDir;
      metadata["post_execution_commands"] = postCargoCommands;
      metadata["post_execution_calls_found"] = postExecutionCalls.length;
    }

    if (includeTrajectory) {
      metadata["trajectory_calls_found"] = trajectoryCalls.length;
      metadata["trajectory_calls"] = trajectoryCalls.map((b) => ({
        tool_call_id: b.toolCallId,
        tool_name: b.toolName,
        command: b.command,
        failed: b.failed,
      }));
    }

    // Emit compiler errors in metadata if configured
    if (emitInMetadata) {
      const allCompilerErrors: CompilerError[] = [];
      const buildCallsWithErrors = allCalls.filter(
        (b) => b.compilerErrors && b.compilerErrors.length > 0,
      );

      for (const build of buildCallsWithErrors) {
        if (build.compilerErrors) {
          allCompilerErrors.push(...build.compilerErrors);
        }
      }

      if (allCompilerErrors.length > 0) {
        metadata["compiler_errors_collected"] = true;
        metadata["compiler_errors"] = allCompilerErrors;
        metadata["compiler_error_count"] = allCompilerErrors.length;
      }
    }

    return {
      name: this.metadata.name,
      kind: "code",
      passed,
      score: normalize(rawScore),
      evidence,
      label,
      metadata,
    };
  }
}

// ── Plugin entry point ─────────────────────────────────────────────────

/**
 * Called by Vally's loadGraderPlugin().
 */
export function registerGraders(registry: GraderRegistry): void {
  registry.register(new CargoBuildTrajectoryGrader());
}
