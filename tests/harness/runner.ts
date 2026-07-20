#!/usr/bin/env node
/**
 * Skill Evaluation Runner
 *
 * Main entry point for running skill evaluations. Coordinates loading scenarios,
 * generating code via Copilot, and evaluating against acceptance criteria.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Command } from "commander";
import { parse as parseYaml } from "yaml";
import chalk from "chalk";

import type {
  TestScenario,
  SkillTestSuite,
  EvaluationSummary,
  EvaluationResult,
  GenerationConfig,
  Finding,
} from "./types.js";
import {
  DEFAULT_GENERATION_CONFIG,
  Severity,
  createEvaluationResult,
  createFinding,
} from "./types.js";
import {
  CopilotGenerationError,
  SkillCopilotClient,
  checkCopilotAvailable,
} from "./copilot-client.js";
import { AcceptanceCriteriaLoader } from "./criteria-loader.js";
import { CodeEvaluator } from "./evaluator.js";
import {
  RalphLoopController,
  createRalphConfig,
  DEFAULT_RALPH_CONFIG,
  type RalphLoopConfig,
  type RalphLoopResult,
} from "./ralph-loop.js";

// =============================================================================
// Ralph Loop Summary
// =============================================================================

/**
 * Summary of Ralph Loop results across multiple scenarios.
 */
export interface RalphLoopSummary {
  skillName: string;
  scenariosRun: number;
  scenariosConverged: number;
  avgIterationsToConverge: number;
  avgFinalScore: number;
  avgImprovement: number;
  totalDurationMs: number;
  scenarioResults: Map<string, RalphLoopResult>;
}

// =============================================================================
// Runner Class
// =============================================================================

/**
 * Runs skill evaluations end-to-end.
 *
 * Workflow:
 * 1. Load test scenarios from tests/scenarios/<skill>/
 * 2. Load acceptance criteria from .github/skills/<skill>/
 * 3. Generate code for each scenario using Copilot SDK
 * 4. Evaluate generated code against criteria
 * 5. Report results
 */
export class SkillEvaluationRunner {
  private static readonly SCENARIOS_DIR = "scenarios";

  private basePath: string;
  private scenariosDir: string;
  private useMock: boolean;
  private verbose: boolean;

  private criteriaLoader: AcceptanceCriteriaLoader;
  private copilotClient: SkillCopilotClient;

  constructor(
    options: {
      basePath?: string;
      useMock?: boolean;
      verbose?: boolean;
    } = {},
  ) {
    this.basePath = options.basePath ?? this.findRepoRoot();
    // Scenarios are in tests/scenarios relative to repo root
    this.scenariosDir = join(
      this.basePath,
      "tests",
      SkillEvaluationRunner.SCENARIOS_DIR,
    );
    this.useMock = options.useMock ?? true;
    this.verbose = options.verbose ?? false;

    this.criteriaLoader = new AcceptanceCriteriaLoader(this.basePath);
    this.copilotClient = new SkillCopilotClient(this.basePath, this.useMock);
  }

  /**
   * Find the repository root by looking for .github/skills directory.
   */
  private findRepoRoot(): string {
    const cwd = process.cwd();

    // Check if we're in the tests directory
    const parentSkills = join(cwd, "..", ".github", "skills");
    if (existsSync(parentSkills)) {
      return resolve(cwd, "..");
    }

    // Check if we're at the repo root
    const rootSkills = join(cwd, ".github", "skills");
    if (existsSync(rootSkills)) {
      return cwd;
    }

    // Fallback to cwd
    return cwd;
  }

  /**
   * List skills that have both criteria and scenarios.
   */
  listAvailableSkills(): string[] {
    const skillsWithCriteria = new Set(
      this.criteriaLoader.listSkillsWithCriteria(),
    );
    const skillsWithScenarios = new Set<string>();

    if (existsSync(this.scenariosDir)) {
      for (const entry of readdirSync(this.scenariosDir, {
        withFileTypes: true,
      })) {
        if (entry.isDirectory()) {
          const scenariosFile = join(
            this.scenariosDir,
            entry.name,
            "scenarios.yaml",
          );
          if (existsSync(scenariosFile)) {
            skillsWithScenarios.add(entry.name);
          }
        }
      }
    }

    // Intersection of both sets
    const available = [...skillsWithCriteria].filter((s) =>
      skillsWithScenarios.has(s),
    );
    return available.sort();
  }

  /**
   * List all skills with acceptance criteria (even without scenarios).
   */
  listSkillsWithCriteria(): string[] {
    return this.criteriaLoader.listSkillsWithCriteria();
  }

  /**
   * Load test scenarios for a skill.
   */
  loadScenarios(skillName: string): SkillTestSuite {
    const scenariosFile = join(this.scenariosDir, skillName, "scenarios.yaml");

    if (!existsSync(scenariosFile)) {
      // Return default scenarios if no file exists
      return this.defaultScenarios(skillName);
    }

    const content = readFileSync(scenariosFile, "utf-8");
    const data = parseYaml(content) as {
      config?: {
        model?: string;
        max_tokens?: number;
        temperature?: number;
      };
      scenarios?: Array<{
        name?: string;
        prompt?: string;
        expected_patterns?: string[];
        forbidden_patterns?: string[];
        tags?: string[];
        mock_response?: string;
      }>;
    };

    const scenarios: TestScenario[] = (data.scenarios ?? []).map((sc) => ({
      name: sc.name ?? "unnamed",
      prompt: sc.prompt ?? "",
      expectedPatterns: sc.expected_patterns ?? [],
      forbiddenPatterns: sc.forbidden_patterns ?? [],
      tags: sc.tags ?? [],
      mockResponse: sc.mock_response,
    }));

    const configData = data.config ?? {};
    const config: GenerationConfig = {
      model: configData.model ?? DEFAULT_GENERATION_CONFIG.model,
      maxTokens: configData.max_tokens ?? DEFAULT_GENERATION_CONFIG.maxTokens,
      temperature:
        configData.temperature ?? DEFAULT_GENERATION_CONFIG.temperature,
      includeSkillContext: DEFAULT_GENERATION_CONFIG.includeSkillContext,
    };

    return {
      skillName,
      scenarios,
      config,
    };
  }

  /**
   * Generate default test scenarios based on skill name.
   */
  private defaultScenarios(skillName: string): SkillTestSuite {
    const scenarios: TestScenario[] = [
      {
        name: "basic_usage",
        prompt: `Write a basic example using the ${skillName} SDK`,
        expectedPatterns: [],
        forbiddenPatterns: [],
        tags: ["basic"],
      },
      {
        name: "authentication",
        prompt: `Show how to authenticate with ${skillName}`,
        expectedPatterns: [],
        forbiddenPatterns: [],
        tags: ["auth"],
      },
    ];

    return {
      skillName,
      scenarios,
      config: DEFAULT_GENERATION_CONFIG,
    };
  }

  /**
   * Run evaluation for a skill.
   */
  async run(
    skillName: string,
    scenarioFilter?: string,
  ): Promise<EvaluationSummary> {
    const startTime = Date.now();

    // Load criteria and scenarios
    const criteria = this.criteriaLoader.load(skillName);
    const suite = this.loadScenarios(skillName);

    // Filter scenarios if requested
    let scenarios = suite.scenarios;
    if (scenarioFilter) {
      const filterLower = scenarioFilter.toLowerCase();
      scenarios = scenarios.filter(
        (s) =>
          s.name.toLowerCase().includes(filterLower) ||
          s.tags.some((t) => t.toLowerCase().includes(filterLower)),
      );
    }

    // Create evaluator
    const evaluator = new CodeEvaluator(criteria);

    // Run each scenario
    const results: EvaluationResult[] = [];

    for (const scenario of scenarios) {
      if (this.verbose) {
        console.log(`  Running scenario: ${scenario.name}`);
      }

      // Setup mock response if provided
      if (scenario.mockResponse && this.useMock) {
        this.copilotClient.addMockResponse(
          scenario.name,
          scenario.mockResponse,
        );
      }

      let evalResult: EvaluationResult;

      try {
        // Generate code
        const genResult = await this.copilotClient.generate(
          scenario.prompt,
          skillName,
          suite.config,
          scenario.name,
        );

        // Evaluate
        evalResult = evaluator.evaluate(genResult.code, scenario.name);
        evalResult.rawResponse = genResult.rawResponse;

        // Add scenario-specific checks
        this.checkScenarioPatterns(evalResult, scenario, genResult.code);
      } catch (error) {
        const kind =
          error instanceof CopilotGenerationError ? error.kind : "fatal";
        const message = error instanceof Error ? error.message : String(error);

        evalResult = createEvaluationResult(skillName, scenario.name, "");
        evalResult.passed = false;
        evalResult.errorCount = 1;
        evalResult.score = 0;
        evalResult.findings.push(
          createFinding({
            severity: Severity.ERROR,
            rule: `runtime:${kind}`,
            message: `Code generation failed (${kind}): ${message}`,
            suggestion: this.getGenerationFailureSuggestion(kind),
          }),
        );
      }

      results.push(evalResult);

      if (this.verbose) {
        const status = evalResult.passed ? chalk.green("✓") : chalk.red("✗");
        console.log(`    ${status} Score: ${evalResult.score.toFixed(1)}`);
        this.printVerboseScenarioResult(evalResult, scenario);
      }
    }

    const durationMs = Date.now() - startTime;

    // Calculate summary
    const passed = results.filter((r) => r.passed).length;
    const avgScore =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length
        : 0;

    return {
      skillName,
      totalScenarios: results.length,
      passed,
      failed: results.length - passed,
      avgScore,
      durationMs,
      results,
    };
  }

  /**
   * Check scenario-specific expected/forbidden patterns.
   */
  private checkScenarioPatterns(
    result: EvaluationResult,
    scenario: TestScenario,
    code: string,
  ): void {
    // Check expected patterns
    for (const pattern of scenario.expectedPatterns) {
      if (!code.includes(pattern)) {
        result.findings.push(
          createFinding({
            severity: Severity.WARNING,
            rule: `scenario:${scenario.name}`,
            message: `Expected pattern not found: ${pattern}`,
          }),
        );
        result.warningCount++;
      }
    }

    // Check forbidden patterns
    for (const pattern of scenario.forbiddenPatterns) {
      if (code.includes(pattern)) {
        result.findings.push(
          createFinding({
            severity: Severity.ERROR,
            rule: `scenario:${scenario.name}`,
            message: `Forbidden pattern found: ${pattern}`,
          }),
        );
        result.errorCount++;
        result.passed = false;
      }
    }

    // Recalculate score after scenario pattern checks
    result.score = this.calculateScore(result);
  }

  /**
   * Calculate score for an evaluation result.
   */
  private calculateScore(result: EvaluationResult): number {
    let score = 100;
    score -= result.errorCount * 20;
    score -= result.warningCount * 5;
    score -= result.matchedIncorrect.length * 15;
    score += result.matchedCorrect.length * 5;
    return Math.max(0, Math.min(100, score));
  }

  private getSeverityStyle(
    severity: Severity | string,
  ): (text: string) => string {
    const severityValue = typeof severity === "string" ? severity : severity;
    switch (severityValue) {
      case "error":
        return chalk.red;
      case "warning":
        return chalk.yellow;
      case "info":
        return chalk.blue;
      default:
        return chalk.white;
    }
  }

  private getGenerationFailureSuggestion(
    kind: "timeout" | "auth" | "transient" | "fatal",
  ): string {
    switch (kind) {
      case "timeout":
        return "Retry with HARNESS_COPILOT_TIMEOUT_MS set higher (for example 240000), or re-run this scenario.";
      case "auth":
        return "Refresh GitHub authentication (gh auth login) or set GH_TOKEN/GITHUB_TOKEN with valid Copilot access.";
      case "transient":
        return "This looks transient; retry the run. If it repeats, verify network stability and API availability.";
      default:
        return "Inspect diagnostics and rerun with --verbose for additional context.";
    }
  }

  private printFinding(finding: Finding): void {
    const severityStyle = this.getSeverityStyle(finding.severity);
    const severityLabel = finding.severity.toUpperCase();

    console.log(
      `      ${severityStyle(`[${severityLabel}]`)} ${finding.rule}: ${finding.message}`,
    );

    if (finding.suggestion) {
      console.log(`        💡 ${finding.suggestion}`);
    }

    if (finding.codeSnippet) {
      console.log(chalk.dim(`        ${finding.codeSnippet}`));
    }
  }

  private printFindings(findings: Finding[]): void {
    if (findings.length === 0) {
      return;
    }

    console.log("    Findings:");
    for (const finding of findings) {
      this.printFinding(finding);
    }
  }

  private printScenarioPatternChecks(
    code: string,
    scenario: TestScenario,
  ): void {
    const expectedPatterns = scenario.expectedPatterns ?? [];
    const forbiddenPatterns = scenario.forbiddenPatterns ?? [];

    if (expectedPatterns.length === 0 && forbiddenPatterns.length === 0) {
      return;
    }

    console.log("    Scenario checks:");

    for (const pattern of expectedPatterns) {
      const found = code.includes(pattern);
      const status = found ? chalk.green("✓") : chalk.red("✗");
      console.log(`      ${status} Expected: ${pattern}`);
    }

    for (const pattern of forbiddenPatterns) {
      const found = code.includes(pattern);
      const status = found ? chalk.red("✗") : chalk.green("✓");
      console.log(`      ${status} Forbidden: ${pattern}`);
    }
  }

  private printAcceptanceCriteriaMatches(
    matchedCorrect: string[],
    matchedIncorrect: string[],
  ): void {
    const uniqueCorrect = Array.from(new Set(matchedCorrect));
    const uniqueIncorrect = Array.from(new Set(matchedIncorrect));

    if (uniqueCorrect.length === 0 && uniqueIncorrect.length === 0) {
      return;
    }

    console.log("    Acceptance criteria:");
    if (uniqueCorrect.length > 0) {
      console.log(
        `      ${chalk.green("✓")} Matched sections: ${uniqueCorrect.join(", ")}`,
      );
    }
    if (uniqueIncorrect.length > 0) {
      console.log(
        `      ${chalk.red("✗")} Incorrect sections: ${uniqueIncorrect.join(", ")}`,
      );
    }
  }

  private printVerboseScenarioResult(
    result: EvaluationResult,
    scenario: TestScenario,
  ): void {
    this.printScenarioPatternChecks(result.generatedCode, scenario);
    this.printAcceptanceCriteriaMatches(
      result.matchedCorrect,
      result.matchedIncorrect,
    );
    this.printFindings(result.findings);
  }

  private printVerboseRalphResult(
    result: RalphLoopResult,
    scenario: TestScenario,
  ): void {
    if (result.iterations.length === 0) {
      return;
    }

    const scoreTrail = result.iterations
      .map(
        (iteration) => `#${iteration.iteration} ${iteration.score.toFixed(1)}`,
      )
      .join(" → ");

    console.log(`    Iterations: ${scoreTrail}`);
    console.log(
      `    Improvement: ${result.improvement >= 0 ? "+" : ""}${result.improvement.toFixed(1)} pts`,
    );

    const lastIteration = result.iterations[result.iterations.length - 1];
    if (!lastIteration) {
      return;
    }
    this.printScenarioPatternChecks(lastIteration.generatedCode, scenario);
    this.printFindings(lastIteration.findings);
  }

  async runWithLoop(
    skillName: string,
    scenarioFilter?: string,
    config?: Partial<RalphLoopConfig>,
  ): Promise<RalphLoopSummary> {
    const startTime = Date.now();

    const criteria = this.criteriaLoader.load(skillName);
    const suite = this.loadScenarios(skillName);

    let scenarios = suite.scenarios;
    if (scenarioFilter) {
      const filterLower = scenarioFilter.toLowerCase();
      scenarios = scenarios.filter(
        (s) =>
          s.name.toLowerCase().includes(filterLower) ||
          s.tags.some((t) => t.toLowerCase().includes(filterLower)),
      );
    }

    const ralphConfig = createRalphConfig(config);
    const evaluator = new CodeEvaluator(criteria);
    const controller = new RalphLoopController(
      criteria,
      evaluator,
      this.copilotClient,
      ralphConfig,
    );

    const scenarioResults = new Map<string, RalphLoopResult>();
    let totalIterations = 0;
    let convergedCount = 0;

    for (const scenario of scenarios) {
      if (this.verbose) {
        console.log(`  Running scenario: ${scenario.name}`);
      }

      if (scenario.mockResponse && this.useMock) {
        this.copilotClient.addMockResponse(
          scenario.name,
          scenario.mockResponse,
        );
      }

      const result = await controller.run(scenario.prompt, scenario.name);
      scenarioResults.set(scenario.name, result);

      if (result.converged) {
        convergedCount++;
      }
      totalIterations += result.iterations.length;

      if (this.verbose) {
        const status = result.converged ? chalk.green("✓") : chalk.yellow("○");
        console.log(
          `    ${status} Score: ${result.finalScore.toFixed(1)} (${result.iterations.length} iterations, ${result.stopReason})`,
        );
        this.printVerboseRalphResult(result, scenario);
      }
    }

    const durationMs = Date.now() - startTime;

    const results = Array.from(scenarioResults.values());
    const avgFinalScore =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.finalScore, 0) / results.length
        : 0;
    const avgImprovement =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.improvement, 0) / results.length
        : 0;
    const avgIterations =
      convergedCount > 0 ? totalIterations / convergedCount : totalIterations;

    return {
      skillName,
      scenariosRun: scenarios.length,
      scenariosConverged: convergedCount,
      avgIterationsToConverge: avgIterations,
      avgFinalScore,
      avgImprovement,
      totalDurationMs: durationMs,
      scenarioResults,
    };
  }
}

// =============================================================================
// Summary Serialization
// =============================================================================

/**
 * Convert evaluation summary to a plain object for JSON serialization.
 */
function summaryToDict(summary: EvaluationSummary): Record<string, unknown> {
  return {
    skill_name: summary.skillName,
    total_scenarios: summary.totalScenarios,
    passed: summary.passed,
    failed: summary.failed,
    pass_rate:
      summary.totalScenarios > 0 ? summary.passed / summary.totalScenarios : 0,
    avg_score: summary.avgScore,
    duration_ms: summary.durationMs,
    results: summary.results.map((r) => ({
      skill_name: r.skillName,
      scenario: r.scenario,
      generated_code: r.generatedCode,
      raw_response: r.rawResponse,
      passed: r.passed,
      score: r.score,
      error_count: r.errorCount,
      warning_count: r.warningCount,
      matched_correct: r.matchedCorrect,
      matched_incorrect: r.matchedIncorrect,
      findings: r.findings.map((f) => ({
        severity: f.severity,
        rule: f.rule,
        message: f.message,
        line: f.line,
        suggestion: f.suggestion,
      })),
    })),
  };
}

/**
 * Convert all-skills summary to a plain object for JSON serialization.
 */
function allSkillsSummaryToDict(
  summary: AllSkillsSummary,
): Record<string, unknown> {
  return {
    total_skills: summary.totalSkills,
    passed_skills: summary.passedSkills,
    failed_skills: summary.failedSkills,
    total_scenarios: summary.totalScenarios,
    passed_scenarios: summary.passedScenarios,
    failed_scenarios: summary.failedScenarios,
    avg_score: summary.avgScore,
    duration_ms: summary.durationMs,
    mode: summary.mode,
    skills: summary.skills.map((s) => summaryToDict(s)),
  };
}

/**
 * Format all-skills summary as a markdown table for GitHub Actions job summary.
 */
function formatAllSkillsMarkdown(summary: AllSkillsSummary): string {
  const lines: string[] = [];

  // Header
  lines.push("# Skill Evaluation Results");
  lines.push("");
  lines.push(`**Mode:** ${summary.mode}`);
  lines.push(`**Duration:** ${(summary.durationMs / 1000).toFixed(1)}s`);
  lines.push("");

  // Summary stats
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Skills | ${summary.totalSkills} |`);
  lines.push(`| Passed Skills | ${summary.passedSkills} |`);
  lines.push(`| Failed Skills | ${summary.failedSkills} |`);
  lines.push(
    `| Pass Rate | ${((summary.passedSkills / summary.totalSkills) * 100).toFixed(1)}% |`,
  );
  lines.push(`| Total Scenarios | ${summary.totalScenarios} |`);
  lines.push(`| Passed Scenarios | ${summary.passedScenarios} |`);
  lines.push(`| Average Score | ${summary.avgScore.toFixed(1)} |`);
  lines.push("");

  // Skills table
  lines.push("## Skills");
  lines.push("");
  lines.push("| Skill | Scenarios | Passed | Failed | Score | Status |");
  lines.push("|-------|-----------|--------|--------|-------|--------|");

  for (const skill of summary.skills) {
    const passRate =
      skill.totalScenarios > 0
        ? ((skill.passed / skill.totalScenarios) * 100).toFixed(0)
        : "N/A";
    const status = skill.failed === 0 ? "✅" : "❌";
    lines.push(
      `| ${skill.skillName} | ${skill.totalScenarios} | ${skill.passed} | ${skill.failed} | ${skill.avgScore.toFixed(1)} (${passRate}%) | ${status} |`,
    );
  }

  // Failed skills details (if any)
  const failedSkills = summary.skills.filter((s) => s.failed > 0);
  if (failedSkills.length > 0) {
    lines.push("");
    lines.push("## Failed Scenarios");
    lines.push("");

    for (const skill of failedSkills) {
      lines.push(`### ${skill.skillName}`);
      lines.push("");
      for (const result of skill.results) {
        if (!result.passed) {
          lines.push(
            `- **${result.scenario}** (score: ${result.score.toFixed(1)})`,
          );
          if (result.findings.length > 0) {
            const errors = result.findings.filter(
              (f) => f.severity === Severity.ERROR,
            );
            const warnings = result.findings.filter(
              (f) => f.severity === Severity.WARNING,
            );
            const infos = result.findings.filter(
              (f) => f.severity === Severity.INFO,
            );
            const ordered = [...errors, ...warnings, ...infos].slice(0, 5);
            for (const finding of ordered) {
              const severity = finding.severity.toUpperCase();
              lines.push(`  - [${severity}] ${finding.message}`);
              if (finding.suggestion) {
                lines.push(`    - 💡 ${finding.suggestion}`);
              }
            }
          }
          if (result.matchedIncorrect.length > 0) {
            lines.push("  - Incorrect sections:");
            for (const section of result.matchedIncorrect) {
              lines.push(`    - ${section}`);
            }
          }
          if (result.matchedCorrect.length > 0) {
            lines.push("  - Matched sections:");
            for (const section of result.matchedCorrect) {
              lines.push(`    - ${section}`);
            }
          }
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function convertRalphToSummary(ralph: RalphLoopSummary): EvaluationSummary {
  const results: EvaluationResult[] = [];

  for (const [scenarioName, loopResult] of ralph.scenarioResults) {
    const lastIteration =
      loopResult.iterations[loopResult.iterations.length - 1];
    if (lastIteration) {
      results.push({
        skillName: ralph.skillName,
        scenario: scenarioName,
        generatedCode: lastIteration.generatedCode,
        rawResponse: "",
        findings: lastIteration.findings,
        matchedCorrect: [],
        matchedIncorrect: [],
        score: lastIteration.score,
        passed: loopResult.converged,
        errorCount: lastIteration.findings.filter(
          (f) => f.severity === Severity.ERROR,
        ).length,
        warningCount: lastIteration.findings.filter(
          (f) => f.severity === Severity.WARNING,
        ).length,
      });
    }
  }

  return {
    skillName: ralph.skillName,
    totalScenarios: ralph.scenariosRun,
    passed: ralph.scenariosConverged,
    failed: ralph.scenariosRun - ralph.scenariosConverged,
    avgScore: ralph.avgFinalScore,
    durationMs: ralph.totalDurationMs,
    results,
  };
}

// =============================================================================
// CLI
// =============================================================================

interface CLIOptions {
  list?: boolean;
  all?: boolean;
  filter?: string;
  mock?: boolean;
  verbose?: boolean;
  output?: string;
  outputFile?: string;
  ralph?: boolean;
  maxIterations?: number;
  threshold?: number;
}

type CliErrorKind = "timeout" | "auth" | "transient" | "fatal";

interface AllSkillsSummary {
  totalSkills: number;
  passedSkills: number;
  failedSkills: number;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  avgScore: number;
  durationMs: number;
  mode: string;
  skills: EvaluationSummary[];
}

function classifyCliError(error: unknown): CliErrorKind {
  if (error instanceof CopilotGenerationError) {
    return error.kind;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (
    message.includes("authentication failed") ||
    message.includes("bad credentials") ||
    message.includes("401")
  ) {
    return "auth";
  }
  if (message.includes("timeout") || message.includes("session.idle")) {
    return "timeout";
  }
  if (message.includes("rate limit") || message.includes("429")) {
    return "transient";
  }
  return "fatal";
}

function writeCliErrorOutput(
  options: CLIOptions,
  skillName: string | undefined,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const payload = {
    status: "ERROR",
    error_kind: classifyCliError(error),
    error: message,
    skill: skillName ?? null,
    timestamp: new Date().toISOString(),
  };
  const output = JSON.stringify(payload, null, 2);

  if (options.outputFile) {
    writeFileSync(options.outputFile, output);
    console.log(`Results written to: ${options.outputFile}`);
    return;
  }

  console.log(output);
}

async function main(): Promise<number> {
  const program = new Command();

  program
    .name("harness")
    .description("Run skill evaluations against acceptance criteria")
    .argument("[skill]", "Skill name to evaluate (e.g., azure-ai-agents-py)")
    .option("--list", "List available skills with test scenarios")
    .option("--all", "Run evaluation on all available skills")
    .option("--filter <pattern>", "Filter scenarios by name or tag")
    .option("--mock", "Use mock responses instead of Copilot SDK")
    .option("-v, --verbose", "Verbose output")
    .option("--output <format>", "Output format (text/json/markdown)", "text")
    .option("--output-file <file>", "Write results to file")
    .option("--ralph", "Enable Ralph Loop iterative improvement mode")
    .option(
      "--max-iterations <n>",
      "Max iterations for Ralph Loop (default: 5)",
      parseInt,
    )
    .option(
      "--threshold <n>",
      "Quality threshold for Ralph Loop (default: 80)",
      parseInt,
    );

  program.parse();

  const options = program.opts<CLIOptions>();
  const skillArg = program.args[0];

  // Check Copilot availability
  const copilotAvailable = checkCopilotAvailable();
  const useMock = options.mock || !copilotAvailable;

  if (!copilotAvailable && !options.mock) {
    console.log(chalk.yellow("⚠️  Copilot SDK not available, using mock mode"));
    console.log("   Install: npm install @github/copilot-sdk");
    console.log();
  }

  const runner = new SkillEvaluationRunner({
    useMock,
    verbose: options.verbose ?? false,
  });

  if (options.list) {
    const skills = runner.listAvailableSkills();
    if (skills.length === 0) {
      console.log(
        "No skills with both acceptance criteria and test scenarios found.",
      );
      console.log("\nSkills with criteria only:");
      for (const skill of runner.listSkillsWithCriteria()) {
        console.log(`  - ${skill}`);
      }
    } else {
      console.log(`Available skills (${skills.length}):`);
      for (const skill of skills) {
        console.log(`  - ${skill}`);
      }
    }
    return 0;
  }

  if (options.all) {
    const skills = runner.listAvailableSkills();
    if (skills.length === 0) {
      console.log(
        chalk.red(
          "No skills with both acceptance criteria and test scenarios found.",
        ),
      );
      return 1;
    }

    console.log(
      `Running evaluation on ${chalk.cyan(skills.length.toString())} skills`,
    );
    console.log(
      `Mode: ${useMock ? chalk.yellow("mock") : chalk.green("copilot")}`,
    );
    console.log("-".repeat(50));

    const startTime = Date.now();
    const skillResults: EvaluationSummary[] = [];
    let passedSkills = 0;
    let failedSkills = 0;

    for (const skillName of skills) {
      if (options.verbose) {
        console.log(`\n${chalk.cyan(skillName)}:`);
      } else {
        process.stdout.write(`${skillName}... `);
      }

      try {
        const summary = await runner.run(skillName, options.filter);
        skillResults.push(summary);

        if (summary.failed === 0) {
          passedSkills++;
          if (!options.verbose) {
            console.log(chalk.green(`✓ ${summary.avgScore.toFixed(0)}`));
          }
        } else {
          failedSkills++;
          if (options.verbose) {
            console.log(
              `  Failed scenarios: ${summary.failed}/${summary.totalScenarios}`,
            );
            for (const result of summary.results) {
              if (!result.passed) {
                console.log(
                  `    - ${result.scenario} (score: ${result.score.toFixed(1)})`,
                );
                const errors = result.findings.filter(
                  (finding) => finding.severity === Severity.ERROR,
                );
                for (const error of errors.slice(0, 3)) {
                  console.log(
                    `        ${chalk.red("[ERROR]")} ${error.message}`,
                  );
                  if (error.suggestion) {
                    console.log(`          💡 ${error.suggestion}`);
                  }
                }
              }
            }
          }
          if (!options.verbose) {
            console.log(
              chalk.red(`✗ ${summary.passed}/${summary.totalScenarios}`),
            );
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failedSkills++;
        skillResults.push({
          skillName,
          totalScenarios: 0,
          passed: 0,
          failed: 1,
          avgScore: 0,
          durationMs: 0,
          results: [],
        });
        if (!options.verbose) {
          console.log(chalk.red(`✗ Error: ${message}`));
        } else {
          console.log(chalk.red(`  Error: ${message}`));
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const totalScenarios = skillResults.reduce(
      (sum, s) => sum + s.totalScenarios,
      0,
    );
    const passedScenarios = skillResults.reduce((sum, s) => sum + s.passed, 0);
    const failedScenarios = skillResults.reduce((sum, s) => sum + s.failed, 0);
    const avgScore =
      skillResults.length > 0
        ? skillResults.reduce((sum, s) => sum + s.avgScore, 0) /
          skillResults.length
        : 0;

    const allSummary: AllSkillsSummary = {
      totalSkills: skills.length,
      passedSkills,
      failedSkills,
      totalScenarios,
      passedScenarios,
      failedScenarios,
      avgScore,
      durationMs,
      mode: useMock ? "mock" : "copilot",
      skills: skillResults,
    };

    let output: string;
    if (options.output === "json") {
      output = JSON.stringify(allSkillsSummaryToDict(allSummary), null, 2);
    } else if (options.output === "markdown") {
      output = formatAllSkillsMarkdown(allSummary);
    } else {
      const passRate = ((passedSkills / skills.length) * 100).toFixed(1);
      const lines = [
        "",
        "=".repeat(50),
        `All Skills Evaluation Summary`,
        "=".repeat(50),
        `Skills: ${skills.length} (${chalk.green(passedSkills.toString())} passed, ${failedSkills > 0 ? chalk.red(failedSkills.toString()) : "0"} failed)`,
        `Scenarios: ${totalScenarios} (${passedScenarios} passed, ${failedScenarios} failed)`,
        `Pass Rate: ${passRate}%`,
        `Average Score: ${avgScore.toFixed(1)}`,
        `Duration: ${(durationMs / 1000).toFixed(1)}s`,
      ];

      if (failedSkills > 0) {
        lines.push("");
        lines.push(chalk.red("Failed Skills:"));
        for (const skill of skillResults.filter((s) => s.failed > 0)) {
          lines.push(
            `  - ${skill.skillName}: ${skill.passed}/${skill.totalScenarios} passed (score: ${skill.avgScore.toFixed(1)})`,
          );
        }
      }

      output = lines.join("\n");
    }

    if (options.outputFile) {
      writeFileSync(options.outputFile, output);
      console.log(`\nResults written to: ${options.outputFile}`);
    } else {
      console.log(output);
    }

    return failedSkills === 0 ? 0 : 1;
  }

  if (!skillArg) {
    program.help();
    return 1;
  }

  // Run evaluation
  console.log(`Evaluating skill: ${chalk.cyan(skillArg)}`);
  console.log(
    `Mode: ${useMock ? chalk.yellow("mock") : chalk.green("copilot")}`,
  );
  if (options.ralph) {
    const maxIter = options.maxIterations ?? DEFAULT_RALPH_CONFIG.maxIterations;
    const threshold =
      options.threshold ?? DEFAULT_RALPH_CONFIG.qualityThreshold;
    console.log(
      `Ralph Loop: ${chalk.cyan("enabled")} (max ${maxIter} iterations, threshold ${threshold})`,
    );
  }
  console.log("-".repeat(50));

  let summary: EvaluationSummary;
  let ralphSummary: RalphLoopSummary | undefined;

  try {
    if (options.ralph) {
      ralphSummary = await runner.runWithLoop(skillArg, options.filter, {
        maxIterations:
          options.maxIterations ?? DEFAULT_RALPH_CONFIG.maxIterations,
        qualityThreshold:
          options.threshold ?? DEFAULT_RALPH_CONFIG.qualityThreshold,
      });
      summary = convertRalphToSummary(ralphSummary);
    } else {
      summary = await runner.run(skillArg, options.filter);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.output === "json") {
      writeCliErrorOutput(options, skillArg, err);
      return 1;
    }
    console.log(chalk.red(`Error: ${message}`));
    return 1;
  }

  // Output results
  let output: string;

  if (options.output === "json") {
    output = JSON.stringify(summaryToDict(summary), null, 2);
  } else {
    const passRate =
      summary.totalScenarios > 0
        ? ((summary.passed / summary.totalScenarios) * 100).toFixed(1)
        : "N/A";

    const lines = [
      "",
      `Evaluation Summary: ${summary.skillName}`,
      "=".repeat(50),
      `Scenarios: ${summary.totalScenarios}`,
      `Passed: ${chalk.green(summary.passed.toString())}`,
      `Failed: ${summary.failed > 0 ? chalk.red(summary.failed.toString()) : "0"}`,
      `Pass Rate: ${passRate}%`,
      `Average Score: ${summary.avgScore.toFixed(1)}`,
      `Duration: ${summary.durationMs.toFixed(0)}ms`,
    ];

    if (ralphSummary) {
      lines.push("");
      lines.push(chalk.cyan("Ralph Loop Stats:"));
      lines.push(
        `  Converged: ${ralphSummary.scenariosConverged}/${ralphSummary.scenariosRun}`,
      );
      lines.push(
        `  Avg Iterations: ${ralphSummary.avgIterationsToConverge.toFixed(1)}`,
      );
      lines.push(
        `  Avg Improvement: ${ralphSummary.avgImprovement >= 0 ? "+" : ""}${ralphSummary.avgImprovement.toFixed(1)} pts`,
      );
    }

    if (summary.failed > 0) {
      lines.push("");
      lines.push(chalk.red("Failed Scenarios:"));
      for (const result of summary.results) {
        if (!result.passed) {
          lines.push(`  - ${result.scenario}`);
          for (const finding of result.findings) {
            if (finding.severity === Severity.ERROR) {
              lines.push(
                `      ${chalk.red(`[${finding.severity}]`)} ${finding.message}`,
              );
            }
          }
        }
      }
    }

    output = lines.join("\n");
  }

  if (options.outputFile) {
    writeFileSync(options.outputFile, output);
    console.log(`Results written to: ${options.outputFile}`);
  } else {
    console.log(output);
  }

  // Return exit code based on pass rate
  return summary.failed === 0 ? 0 : 1;
}

// Run CLI
main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
