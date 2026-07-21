/**
 * Tests for Ralph Loop Controller
 *
 * Tests the iterative code generation and improvement system.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RalphLoopController,
  createRalphConfig,
  createRalphLoopController,
  DEFAULT_RALPH_CONFIG,
  type RalphLoopConfig,
  type IterationResult,
  type RalphLoopResult,
} from "./ralph-loop.js";
import { CodeEvaluator } from "./evaluator.js";
import {
  type AcceptanceCriteria,
  type CopilotClient,
  type EvaluationResult,
  type GenerationConfig,
  type GenerationResult,
  Severity,
  createAcceptanceCriteria,
  createFinding,
} from "./types.js";

// =============================================================================
// Mock Implementations
// =============================================================================

/**
 * Mock CopilotClient that returns configurable responses.
 */
class MockClient implements CopilotClient {
  private responses: Map<number, string> = new Map();
  private callCount = 0;

  /**
   * Set response for a specific iteration (1-indexed).
   */
  setResponse(iteration: number, code: string): void {
    this.responses.set(iteration, code);
  }

  /**
   * Set responses for all iterations.
   */
  setResponses(codes: string[]): void {
    codes.forEach((code, i) => this.responses.set(i + 1, code));
  }

  async generate(
    _prompt: string,
    _skillName: string,
    _config?: GenerationConfig,
    _scenarioName?: string,
  ): Promise<GenerationResult> {
    this.callCount++;
    const code =
      this.responses.get(this.callCount) ?? "# Default mock response\npass";
    return {
      code,
      prompt: _prompt,
      skillName: _skillName,
      model: "mock",
      tokensUsed: 0,
      durationMs: 10,
      rawResponse: code,
    };
  }

  getCallCount(): number {
    return this.callCount;
  }

  reset(): void {
    this.callCount = 0;
  }
}

/**
 * Mock evaluator that returns configurable scores.
 */
class MockEvaluator {
  private scores: number[] = [];
  private currentIndex = 0;

  setScores(scores: number[]): void {
    this.scores = scores;
    this.currentIndex = 0;
  }

  evaluate(code: string, scenario: string): EvaluationResult {
    const score = this.scores[this.currentIndex] ?? 50;
    this.currentIndex++;

    // Generate findings based on score
    const findings =
      score < 100
        ? [
            createFinding({
              severity: score < 50 ? Severity.ERROR : Severity.WARNING,
              rule: "test-rule",
              message: `Score is ${score}`,
            }),
          ]
        : [];

    return {
      skillName: "test-skill",
      scenario,
      generatedCode: code,
      rawResponse: code,
      findings,
      matchedCorrect: [],
      matchedIncorrect: score < 70 ? ["some-section"] : [],
      score,
      passed: score >= 50,
      errorCount: findings.filter((f) => f.severity === Severity.ERROR).length,
      warningCount: findings.filter((f) => f.severity === Severity.WARNING)
        .length,
    };
  }
}

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestCriteria(): AcceptanceCriteria {
  return createAcceptanceCriteria({
    skillName: "test-skill",
    sourcePath: "/test/path",
    language: "python",
    rules: [],
    correctPatterns: [],
    incorrectPatterns: [],
  });
}

// =============================================================================
// Tests
// =============================================================================

describe("RalphLoopController", () => {
  let mockClient: MockClient;
  let mockEvaluator: MockEvaluator;
  let criteria: AcceptanceCriteria;

  beforeEach(() => {
    mockClient = new MockClient();
    mockEvaluator = new MockEvaluator();
    criteria = createTestCriteria();
  });

  describe("basic functionality", () => {
    it("should run a single iteration when quality threshold met immediately", async () => {
      mockClient.setResponses(["# Perfect code"]);
      mockEvaluator.setScores([85]); // Above default threshold of 80

      const controller = new RalphLoopController(
        criteria,
        mockEvaluator as unknown as CodeEvaluator,
        mockClient,
        { qualityThreshold: 80 },
      );

      const result = await controller.run("Generate code", "test-scenario");

      expect(result.iterations).toHaveLength(1);
      expect(result.finalScore).toBe(85);
      expect(result.converged).toBe(true);
      expect(result.stopReason).toBe("quality_threshold_met");
    });

    it("should iterate until quality threshold met", async () => {
      mockClient.setResponses([
        "# First attempt",
        "# Second attempt",
        "# Third attempt",
      ]);
      mockEvaluator.setScores([40, 60, 85]); // Improving scores

      const controller = new RalphLoopController(
        criteria,
        mockEvaluator as unknown as CodeEvaluator,
        mockClient,
        { qualityThreshold: 80, improvementThreshold: 10 },
      );

      const result = await controller.run("Generate code", "test-scenario");

      expect(result.iterations).toHaveLength(3);
      expect(result.finalScore).toBe(85);
      expect(result.converged).toBe(true);
      expect(result.stopReason).toBe("quality_threshold_met");
      expect(result.improvement).toBe(45); // 85 - 40
    });

    it("should stop at max iterations if threshold not met", async () => {
      mockClient.setResponses(["# Attempt 1", "# Attempt 2", "# Attempt 3"]);
      mockEvaluator.setScores([30, 40, 50]); // Never reaches 80

      const controller = new RalphLoopController(
        criteria,
        mockEvaluator as unknown as CodeEvaluator,
        mockClient,
        { maxIterations: 3, qualityThreshold: 80, improvementThreshold: 5 },
      );

      const result = await controller.run("Generate code", "test-scenario");

      expect(result.iterations).toHaveLength(3);
      expect(result.finalScore).toBe(50);
      expect(result.converged).toBe(false);
      expect(result.stopReason).toBe("max_iterations_reached");
    });
  });

  describe("early stopping conditions", () => {
    it("should stop early on perfect score", async () => {
      mockClient.setResponses(["# Perfect code"]);
      mockEvaluator.setScores([100]);

      const controller = new RalphLoopController(
        criteria,
        mockEvaluator as unknown as CodeEvaluator,
        mockClient,
        { earlyStopOnPerfect: true },
      );

      const result = await controller.run("Generate code", "test-scenario");

      expect(result.iterations).toHaveLength(1);
      expect(result.stopReason).toBe("perfect_score");
      expect(result.converged).toBe(true);
    });

    it("should stop on score regression", async () => {
      mockClient.setResponses(["# First", "# Second"]);
      mockEvaluator.setScores([60, 50]); // Score went down

      const controller = new RalphLoopController(
        criteria,
        mockEvaluator as unknown as CodeEvaluator,
        mockClient,
        { qualityThreshold: 80, improvementThreshold: 5 },
      );

      const result = await controller.run("Generate code", "test-scenario");

      expect(result.iterations).toHaveLength(2);
      expect(result.stopReason).toBe("score_regression");
      expect(result.converged).toBe(false);
    });

    it("should stop when no meaningful improvement", async () => {
      mockClient.setResponses(["# First", "# Second"]);
      mockEvaluator.setScores([60, 62]); // Only +2, below threshold of 5

      const controller = new RalphLoopController(
        criteria,
        mockEvaluator as unknown as CodeEvaluator,
        mockClient,
        { qualityThreshold: 80, improvementThreshold: 5 },
      );

      const result = await controller.run("Generate code", "test-scenario");

      expect(result.iterations).toHaveLength(2);
      expect(result.stopReason).toBe("no_improvement");
      expect(result.converged).toBe(false);
    });
  });

  describe("best iteration tracking", () => {
    it("should track the best iteration correctly", async () => {
      mockClient.setResponses(["# First", "# Second", "# Third"]);
      mockEvaluator.setScores([50, 75, 60]); // Best is iteration 2

      const controller = new RalphLoopController(
        criteria,
        mockEvaluator as unknown as CodeEvaluator,
        mockClient,
        { maxIterations: 3, qualityThreshold: 80, improvementThreshold: 0 },
      );

      const result = await controller.run("Generate code", "test-scenario");

      expect(result.bestIteration).toBe(2);
      // Note: finalScore is the LAST iteration's score, not the best
      expect(result.finalScore).toBe(60);
    });
  });

  describe("iteration results", () => {
    it("should include all iteration details", async () => {
      mockClient.setResponses(["# Code 1", "# Code 2"]);
      mockEvaluator.setScores([50, 85]);

      const controller = new RalphLoopController(
        criteria,
        mockEvaluator as unknown as CodeEvaluator,
        mockClient,
        { qualityThreshold: 80, improvementThreshold: 10 },
      );

      const result = await controller.run("Generate code", "test-scenario");

      expect(result.iterations).toHaveLength(2);

      // Check first iteration
      const iter1 = result.iterations[0]!;
      expect(iter1.iteration).toBe(1);
      expect(iter1.score).toBe(50);
      expect(iter1.generatedCode).toBe("# Code 1");
      expect(iter1.durationMs).toBeGreaterThanOrEqual(0);

      // Check second iteration
      const iter2 = result.iterations[1]!;
      expect(iter2.iteration).toBe(2);
      expect(iter2.score).toBe(85);
      expect(iter2.generatedCode).toBe("# Code 2");
    });

    it("should include feedback in iteration results", async () => {
      mockClient.setResponses(["# Code with issues", "# Fixed code"]);
      mockEvaluator.setScores([40, 85]); // First has errors, second passes

      const controller = new RalphLoopController(
        criteria,
        mockEvaluator as unknown as CodeEvaluator,
        mockClient,
        {
          qualityThreshold: 80,
          includeFeedback: true,
          improvementThreshold: 10,
        },
      );

      const result = await controller.run("Generate code", "test-scenario");

      // First iteration should have feedback for next iteration
      const iter1 = result.iterations[0]!;
      expect(iter1.feedbackProvided).toContain("Issues Found");
    });
  });

  describe("timing", () => {
    it("should track total duration", async () => {
      mockClient.setResponses(["# Code"]);
      mockEvaluator.setScores([90]);

      const controller = new RalphLoopController(
        criteria,
        mockEvaluator as unknown as CodeEvaluator,
        mockClient,
      );

      const result = await controller.run("Generate code", "test-scenario");

      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Configuration", () => {
  describe("DEFAULT_RALPH_CONFIG", () => {
    it("should have sensible defaults", () => {
      expect(DEFAULT_RALPH_CONFIG.maxIterations).toBe(5);
      expect(DEFAULT_RALPH_CONFIG.qualityThreshold).toBe(80);
      expect(DEFAULT_RALPH_CONFIG.improvementThreshold).toBe(5);
      expect(DEFAULT_RALPH_CONFIG.earlyStopOnPerfect).toBe(true);
      expect(DEFAULT_RALPH_CONFIG.includeFeedback).toBe(true);
    });
  });

  describe("createRalphConfig", () => {
    it("should create config with defaults", () => {
      const config = createRalphConfig();
      expect(config).toEqual(DEFAULT_RALPH_CONFIG);
    });

    it("should allow partial overrides", () => {
      const config = createRalphConfig({
        maxIterations: 10,
        qualityThreshold: 90,
      });

      expect(config.maxIterations).toBe(10);
      expect(config.qualityThreshold).toBe(90);
      expect(config.improvementThreshold).toBe(5); // Default
      expect(config.earlyStopOnPerfect).toBe(true); // Default
    });
  });
});

describe("Factory Functions", () => {
  describe("createRalphLoopController", () => {
    it("should create controller with default evaluator", () => {
      const criteria = createTestCriteria();
      const mockClient = new MockClient();

      const controller = createRalphLoopController(criteria, mockClient);

      expect(controller).toBeInstanceOf(RalphLoopController);
    });

    it("should accept custom config", () => {
      const criteria = createTestCriteria();
      const mockClient = new MockClient();

      const controller = createRalphLoopController(criteria, mockClient, {
        maxIterations: 10,
      });

      expect(controller).toBeInstanceOf(RalphLoopController);
    });
  });
});
