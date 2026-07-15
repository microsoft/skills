/**
 * Type definitions for the skill evaluation test harness.
 *
 * Mirrors the Python dataclasses from criteria_loader.py and evaluator.py
 */

// =============================================================================
// Criteria Loader Types
// =============================================================================

/**
 * A code pattern that represents correct or incorrect usage.
 */
export interface CodePattern {
  code: string;
  language: Language;
  description: string;
  isCorrect: boolean;
  section: string;
}

/**
 * Supported programming languages for code patterns.
 */
export type Language = "python" | "csharp" | "typescript" | "java";

/**
 * A rule for validating generated code.
 */
export interface ValidationRule {
  name: string;
  description: string;
  correctPatterns: CodePattern[];
  incorrectPatterns: CodePattern[];
  requiredImports: string[];
  forbiddenImports: string[];
  requiredPatterns: string[];
  forbiddenPatterns: string[];
}

/**
 * Complete acceptance criteria for a skill.
 */
export interface AcceptanceCriteria {
  skillName: string;
  sourcePath: string;
  rules: ValidationRule[];
  correctPatterns: CodePattern[];
  incorrectPatterns: CodePattern[];
  language: Language;
}

// =============================================================================
// Evaluator Types
// =============================================================================

/**
 * Severity levels for evaluation findings.
 */
export enum Severity {
  ERROR = "error", // Incorrect pattern found
  WARNING = "warning", // Missing recommended pattern
  INFO = "info", // Informational finding
}

/**
 * A single finding from code evaluation.
 */
export interface Finding {
  severity: Severity;
  rule: string;
  message: string;
  line?: number;
  column?: number;
  codeSnippet: string;
  suggestion: string;
}

/**
 * Result of evaluating code against criteria.
 */
export interface EvaluationResult {
  skillName: string;
  scenario: string;
  generatedCode: string;
  rawResponse: string;
  findings: Finding[];
  matchedCorrect: string[];
  matchedIncorrect: string[];
  score: number;
  passed: boolean;
  errorCount: number;
  warningCount: number;
}

// =============================================================================
// Runner Types
// =============================================================================

/**
 * Configuration for code generation.
 */
export interface GenerationConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  includeSkillContext: boolean;
}

/**
 * Default generation configuration.
 */
export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  model: "gpt-5.5",
  maxTokens: 2000,
  temperature: 0.3,
  includeSkillContext: true,
};

/**
 * A test scenario for evaluating skill code generation.
 */
export interface TestScenario {
  name: string;
  prompt: string;
  expectedPatterns: string[];
  forbiddenPatterns: string[];
  tags: string[];
  mockResponse?: string | undefined;
}

/**
 * Test suite for a skill containing scenarios and config.
 */
export interface SkillTestSuite {
  skillName: string;
  scenarios: TestScenario[];
  config: GenerationConfig;
}

/**
 * Summary of evaluation results for a skill.
 */
export interface EvaluationSummary {
  skillName: string;
  totalScenarios: number;
  passed: number;
  failed: number;
  avgScore: number;
  durationMs: number;
  results: EvaluationResult[];
}

// =============================================================================
// Copilot Client Types
// =============================================================================

/**
 * Result from code generation.
 */
export interface GenerationResult {
  code: string;
  prompt: string;
  skillName: string;
  model: string;
  tokensUsed: number;
  durationMs: number;
  rawResponse: string;
}

/**
 * Interface for code generation clients.
 */
export interface CopilotClient {
  generate(
    prompt: string,
    skillName: string,
    config?: GenerationConfig,
    scenarioName?: string,
  ): Promise<GenerationResult>;
}

// =============================================================================
// Reporter Types
// =============================================================================

/**
 * Output format for reports.
 */
export type OutputFormat = "text" | "json" | "markdown";

/**
 * Options for the CLI runner.
 */
export interface RunnerOptions {
  skillName?: string;
  mock: boolean;
  verbose: boolean;
  filter?: string;
  output: OutputFormat;
  outputFile?: string;
  list: boolean;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Detect language from skill name suffix.
 */
export function detectLanguage(skillName: string): Language {
  const name = skillName.toLowerCase();
  if (name.endsWith("-py")) return "python";
  if (name.endsWith("-dotnet")) return "csharp";
  if (name.endsWith("-ts")) return "typescript";
  if (name.endsWith("-java")) return "java";
  return "python"; // default
}

/**
 * Create an empty evaluation result.
 */
export function createEvaluationResult(
  skillName: string,
  scenario: string,
  generatedCode: string,
): EvaluationResult {
  return {
    skillName,
    scenario,
    generatedCode,
    rawResponse: "",
    findings: [],
    matchedCorrect: [],
    matchedIncorrect: [],
    score: 0,
    passed: true,
    errorCount: 0,
    warningCount: 0,
  };
}

/**
 * Create an empty code pattern.
 */
export function createCodePattern(
  partial: Partial<CodePattern> = {},
): CodePattern {
  return {
    code: "",
    language: "python",
    description: "",
    isCorrect: true,
    section: "",
    ...partial,
  };
}

/**
 * Create an empty validation rule.
 */
export function createValidationRule(
  partial: Partial<ValidationRule> = {},
): ValidationRule {
  return {
    name: "",
    description: "",
    correctPatterns: [],
    incorrectPatterns: [],
    requiredImports: [],
    forbiddenImports: [],
    requiredPatterns: [],
    forbiddenPatterns: [],
    ...partial,
  };
}

/**
 * Create an empty acceptance criteria.
 */
export function createAcceptanceCriteria(
  partial: Partial<AcceptanceCriteria> = {},
): AcceptanceCriteria {
  return {
    skillName: "",
    sourcePath: "",
    rules: [],
    correctPatterns: [],
    incorrectPatterns: [],
    language: "python",
    ...partial,
  };
}

/**
 * Create an empty finding.
 */
export function createFinding(partial: Partial<Finding> = {}): Finding {
  return {
    severity: Severity.INFO,
    rule: "",
    message: "",
    codeSnippet: "",
    suggestion: "",
    ...partial,
  };
}
