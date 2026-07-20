/**
 * Copilot Client
 *
 * Wraps code generation for generating code with skill context.
 * Manages sessions, sends prompts, and captures generated code.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import type {
  GenerationResult,
  GenerationConfig,
  CopilotClient,
} from "./types.js";
import { DEFAULT_GENERATION_CONFIG } from "./types.js";
import { CopilotClient as SDKCopilotClient } from "@github/copilot-sdk";

export type CopilotGenerationErrorKind =
  | "timeout"
  | "auth"
  | "transient"
  | "fatal";

export class CopilotGenerationError extends Error {
  readonly kind: CopilotGenerationErrorKind;
  readonly retryable: boolean;

  constructor(
    kind: CopilotGenerationErrorKind,
    message: string,
    retryable: boolean,
  ) {
    super(message);
    this.name = "CopilotGenerationError";
    this.kind = kind;
    this.retryable = retryable;
  }
}

export function classifyCopilotError(error: unknown): CopilotGenerationError {
  if (error instanceof CopilotGenerationError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("authentication failed") ||
    normalized.includes("bad credentials") ||
    normalized.includes("failed to fetch github cli user login") ||
    normalized.includes("401")
  ) {
    return new CopilotGenerationError("auth", message, false);
  }

  if (
    normalized.includes("timeout") ||
    normalized.includes("session.idle") ||
    normalized.includes("timed out")
  ) {
    return new CopilotGenerationError("timeout", message, true);
  }

  if (
    normalized.includes("429") ||
    normalized.includes("rate limit") ||
    normalized.includes("econnreset") ||
    normalized.includes("etimedout") ||
    normalized.includes("enotfound") ||
    normalized.includes("socket hang up") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("service unavailable")
  ) {
    return new CopilotGenerationError("transient", message, true);
  }

  return new CopilotGenerationError("fatal", message, false);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

// =============================================================================
// Mock Client
// =============================================================================

/**
 * Mock client for testing without real SDK.
 * Returns predefined responses for test scenarios.
 */
export class MockCopilotClient implements CopilotClient {
  private mockResponses: Map<string, string> = new Map();

  /**
   * Add a mock response for a specific scenario.
   */
  addMockResponse(scenarioName: string, response: string): void {
    this.mockResponses.set(scenarioName, response);
  }

  /**
   * Generate a mock response.
   */
  async generate(
    prompt: string,
    skillName: string,
    config?: GenerationConfig,
    scenarioName?: string,
  ): Promise<GenerationResult> {
    // If scenarioName is provided, use it to look up the response
    if (scenarioName && this.mockResponses.has(scenarioName)) {
      return {
        code: this.mockResponses.get(scenarioName)!,
        prompt,
        skillName: "mock",
        model: "mock",
        tokensUsed: 0,
        durationMs: 0,
        rawResponse: "",
      };
    }

    // Default mock response (fallback for missing scenario)
    return {
      code: "# No mock response configured for this prompt\npass",
      prompt,
      skillName: "mock",
      model: "mock",
      tokensUsed: 0,
      durationMs: 0,
      rawResponse: "",
    };
  }
}

// =============================================================================
// Skill Copilot Client
// =============================================================================

/**
 * Client for generating code with skill context.
 *
 * Features:
 * - Loads skill content as context
 * - Manages conversation sessions
 * - Extracts code from responses
 * - Falls back to mock client if SDK unavailable
 */
export class SkillCopilotClient implements CopilotClient {
  private static readonly SKILLS_DIR = ".github/skills";
  private static readonly PLUGINS_DIR = ".github/plugins";
  private static readonly DEFAULT_TIMEOUT_MS = 120000;
  private static readonly DEFAULT_MAX_RETRIES = 2;

  private basePath: string;
  private skillsDir: string;
  private pluginsDir: string;
  private useMock: boolean;
  private mockClient: MockCopilotClient;
  private skillCache: Map<string, string> = new Map();

  constructor(basePath?: string, useMock: boolean = false) {
    this.basePath = basePath ?? process.cwd();
    this.skillsDir = join(this.basePath, SkillCopilotClient.SKILLS_DIR);
    this.pluginsDir = join(this.basePath, SkillCopilotClient.PLUGINS_DIR);
    this.useMock = useMock || !checkCopilotAvailable();
    this.mockClient = new MockCopilotClient();
  }

  /**
   * Resolve a skill directory from either .github/skills/<name>
   * or .github/plugins/{plugin}/skills/<name>.
   */
  private resolveSkillDir(skillName: string): string | null {
    const directPath = join(this.skillsDir, skillName);
    if (existsSync(directPath)) {
      return directPath;
    }

    if (existsSync(this.pluginsDir)) {
      const pluginEntries = readdirSync(this.pluginsDir, {
        withFileTypes: true,
      });
      for (const entry of pluginEntries) {
        if (!entry.isDirectory()) {
          continue;
        }
        const candidate = join(
          this.pluginsDir,
          entry.name,
          "skills",
          skillName,
        );
        if (existsSync(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  }

  /**
   * Load skill content as context for code generation.
   */
  loadSkillContext(skillName: string): string {
    if (this.skillCache.has(skillName)) {
      return this.skillCache.get(skillName)!;
    }

    const skillDir = this.resolveSkillDir(skillName);
    if (!skillDir) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    const contextParts: string[] = [];

    // Load main SKILL.md
    const skillMd = join(skillDir, "SKILL.md");
    if (existsSync(skillMd)) {
      contextParts.push(`# Skill: ${skillName}\n\n`);
      contextParts.push(readFileSync(skillMd, "utf-8"));
    }

    // Load reference files
    const refsDir = join(skillDir, "references");
    if (existsSync(refsDir)) {
      const refFiles = readdirSync(refsDir).filter((f) => f.endsWith(".md"));
      for (const refFile of refFiles) {
        const refPath = join(refsDir, refFile);
        const stem = refFile.replace(/\.md$/, "");
        contextParts.push(`\n\n# Reference: ${stem}\n\n`);
        contextParts.push(readFileSync(refPath, "utf-8"));
      }
    }

    const context = contextParts.join("\n");
    this.skillCache.set(skillName, context);
    return context;
  }

  /**
   * Generate code using Copilot with skill context.
   */
  async generate(
    prompt: string,
    skillName: string,
    config?: GenerationConfig,
    scenarioName?: string,
  ): Promise<GenerationResult> {
    const cfg = config ?? DEFAULT_GENERATION_CONFIG;

    // Build full prompt with skill context
    let skillContext = "";
    if (cfg.includeSkillContext) {
      skillContext = this.loadSkillContext(skillName);
    }

    if (this.useMock) {
      return this.mockClient.generate(prompt, skillName, config, scenarioName);
    }

    // Use real SDK
    return this.generateWithCopilot(prompt, skillName, skillContext, cfg);
  }

  /**
   * Build the full prompt with skill context.
   */
  private buildPrompt(userPrompt: string, skillContext: string): string {
    return `You are an expert developer. Use the following skill documentation as reference for correct SDK usage patterns.

<skill-context>
${skillContext}
</skill-context>

<task>
${userPrompt}
</task>

Generate only code. Follow the patterns from the skill documentation exactly.
`;
  }

  /**
   * Generate code using the actual Copilot SDK.
   */
  private async generateWithCopilot(
    prompt: string,
    skillName: string,
    skillContext: string,
    config: GenerationConfig,
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    const fullPrompt = this.buildPrompt(prompt, skillContext);
    const timeoutMs = this.getTimeoutMs();
    const maxRetries = this.getMaxRetries();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const client = new SDKCopilotClient();
      let session: unknown;

      try {
        session = await client.createSession({
          model: config.model,
        });

        const response = await (
          session as {
            sendAndWait: (
              request: { prompt: string },
              timeout: number,
            ) => Promise<{ data?: { content?: string } }>;
          }
        ).sendAndWait({ prompt: fullPrompt }, timeoutMs);

        const rawResponse = response?.data?.content ?? "";
        const code = this.extractCode(rawResponse);

        return {
          code,
          prompt: fullPrompt,
          skillName,
          model: config.model,
          tokensUsed: 0,
          durationMs: Date.now() - startTime,
          rawResponse,
        };
      } catch (error) {
        const classified = classifyCopilotError(error);
        if (!classified.retryable || attempt === maxRetries) {
          throw classified;
        }

        // Exponential backoff with jitter for transient SDK/network failures.
        const backoffMs = Math.min(1000 * 2 ** attempt, 8000);
        const jitterMs = Math.floor(Math.random() * 300);
        await sleep(backoffMs + jitterMs);
      } finally {
        const s = session as {
          disconnect?: () => Promise<void>;
          destroy?: () => Promise<void>;
        };
        if (s && typeof s.disconnect === "function") {
          await s.disconnect();
        } else if (s && typeof s.destroy === "function") {
          await s.destroy();
        }
        await client.stop();
      }
    }

    throw new CopilotGenerationError(
      "fatal",
      "Code generation failed after all retry attempts.",
      false,
    );
  }

  private getTimeoutMs(): number {
    const raw = process.env["HARNESS_COPILOT_TIMEOUT_MS"];
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : SkillCopilotClient.DEFAULT_TIMEOUT_MS;
  }

  private getMaxRetries(): number {
    const raw = process.env["HARNESS_COPILOT_MAX_RETRIES"];
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : SkillCopilotClient.DEFAULT_MAX_RETRIES;
  }

  /**
   * Extract code from a response.
   */
  private extractCode(response: string): string {
    // Look for code blocks
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    const blocks: string[] = [];
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      if (match[1]) {
        blocks.push(match[1].trim());
      }
    }

    if (blocks.length > 0) {
      return blocks.join("\n\n");
    }

    // If no code blocks, try to find code-like content
    const lines = response.split("\n");
    const codeLines: string[] = [];
    let inCode = false;

    const assignmentRegex = /^[A-Za-z_][A-Za-z0-9_]*\s*=\s*.+$/;
    const callStartRegex = /^[A-Za-z_][A-Za-z0-9_.]*\s*\(.+$/;

    for (const line of lines) {
      const trimmed = line.trim();
      const isCodeLikeLine =
        line.startsWith("import ") ||
        line.startsWith("from ") ||
        line.startsWith("def ") ||
        line.startsWith("class ") ||
        line.startsWith("function ") ||
        line.startsWith("const ") ||
        line.startsWith("let ") ||
        line.startsWith("using ") ||
        line.startsWith("    ") ||
        line.startsWith("\t") ||
        assignmentRegex.test(trimmed) ||
        callStartRegex.test(trimmed);

      // Heuristic: lines starting with import, def, class, or indented
      if (isCodeLikeLine) {
        inCode = true;
        codeLines.push(line);
      } else if (inCode && line.trim() === "") {
        codeLines.push(line);
      } else if (inCode && !line.startsWith("#") && line.trim()) {
        // Non-code line, might be end of code
        if (line.length > 0 && !/^[a-zA-Z]/.test(line.charAt(0))) {
          codeLines.push(line);
        }
      }
    }

    return codeLines.join("\n").trim() || response;
  }

  /**
   * Add a mock response for a specific test scenario.
   */
  addMockResponse(scenarioName: string, response: string): void {
    this.mockClient.addMockResponse(scenarioName, response);
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if Copilot authentication is available.
 *
 * The SDK can authenticate in two ways:
 * 1. Via `copilot` CLI (interactive login via `gh auth`)
 * 2. Via PAT with "Copilot Requests" permission (GH_TOKEN or GITHUB_TOKEN env var)
 *
 * @returns true if either CLI is available OR PAT is set
 */
export function checkCopilotAvailable(): boolean {
  // Check for PAT authentication first (preferred in CI)
  if (checkCopilotToken()) {
    return true;
  }

  // Fall back to CLI check
  return checkCopilotCli();
}

/**
 * Check if a Copilot-compatible token is available via environment variables.
 * The Copilot CLI checks GH_TOKEN first, then GITHUB_TOKEN.
 */
export function checkCopilotToken(): boolean {
  const token = process.env["GH_TOKEN"] || process.env["GITHUB_TOKEN"];
  return !!token && token.length > 0;
}

/**
 * Check if Copilot CLI is available in PATH.
 */
export function checkCopilotCli(): boolean {
  try {
    execSync("copilot --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a client based on availability.
 */
export function createClient(
  basePath?: string,
  useMock: boolean = false,
): SkillCopilotClient {
  return new SkillCopilotClient(basePath, useMock);
}
