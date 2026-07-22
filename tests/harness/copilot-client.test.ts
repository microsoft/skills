import { describe, expect, it } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  CopilotGenerationError,
  SkillCopilotClient,
  classifyCopilotError,
} from "./copilot-client.js";

describe("SkillCopilotClient.extractCode", () => {
  it("keeps assignment line for multiline constructor call without fences", () => {
    const client = new SkillCopilotClient(process.cwd(), true);

    const response = [
      "from azure.identity import DefaultAzureCredential",
      "from azure.monitor.opentelemetry.exporter import AzureMonitorTraceExporter",
      "",
      "exporter = AzureMonitorTraceExporter(",
      "    credential=DefaultAzureCredential(),",
      '    storage_directory="/path/to/storage",',
      "    disable_offline_storage=False,",
      ")",
    ].join("\n");

    const extracted = (
      client as unknown as { extractCode: (r: string) => string }
    ).extractCode(response);

    expect(extracted).toContain("exporter = AzureMonitorTraceExporter(");
    expect(extracted).toContain("disable_offline_storage=False,");
    expect(extracted.trim().endsWith(")")).toBe(true);
  });

  it("prefers fenced code blocks when present", () => {
    const client = new SkillCopilotClient(process.cwd(), true);

    const response = [
      "Here is the implementation:",
      "```python",
      "x = 1",
      "print(x)",
      "```",
    ].join("\n");

    const extracted = (
      client as unknown as { extractCode: (r: string) => string }
    ).extractCode(response);

    expect(extracted).toBe("x = 1\nprint(x)");
  });
});

describe("SkillCopilotClient.loadSkillContext", () => {
  it("loads skill context from nested plugins/<plugin>/skills/<group>/<skill>", () => {
    const basePath = mkdtempSync(join(tmpdir(), "copilot-client-"));
    const nestedSkillDir = join(
      basePath,
      ".github/plugins/test-plugin/skills/rust/azure-cosmos-rust",
    );
    mkdirSync(nestedSkillDir, { recursive: true });
    writeFileSync(
      join(nestedSkillDir, "SKILL.md"),
      "---\nname: azure-cosmos-rust\ndescription: test\n---\n\ncontent",
      "utf-8",
    );

    try {
      const client = new SkillCopilotClient(basePath, true);
      const context = client.loadSkillContext("azure-cosmos-rust");
      expect(context).toContain("# Skill: azure-cosmos-rust");
      expect(context).toContain("content");
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it("does not match non-skill nested directories", () => {
    const basePath = mkdtempSync(join(tmpdir(), "copilot-client-"));
    const nonMatchingDir = join(
      basePath,
      ".github/plugins/test-plugin/skills/rust/not-the-skill",
    );
    mkdirSync(nonMatchingDir, { recursive: true });
    writeFileSync(
      join(nonMatchingDir, "SKILL.md"),
      "---\nname: not-the-skill\ndescription: test\n---\n\ncontent",
      "utf-8",
    );

    try {
      const client = new SkillCopilotClient(basePath, true);
      expect(() => client.loadSkillContext("azure-cosmos-rust")).toThrow(
        "Skill not found: azure-cosmos-rust",
      );
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });
});

describe("classifyCopilotError", () => {
  it("classifies timeout and marks retryable", () => {
    const classified = classifyCopilotError(
      new Error("Timeout after 120000ms waiting for session.idle"),
    );

    expect(classified.kind).toBe("timeout");
    expect(classified.retryable).toBe(true);
  });

  it("classifies auth and marks non-retryable", () => {
    const classified = classifyCopilotError(
      new Error(
        "Authentication failed: Failed to fetch GitHub CLI user login (401): Bad credentials",
      ),
    );

    expect(classified.kind).toBe("auth");
    expect(classified.retryable).toBe(false);
  });

  it("returns existing classified errors unchanged", () => {
    const original = new CopilotGenerationError("transient", "429", true);
    const classified = classifyCopilotError(original);

    expect(classified).toBe(original);
  });
});
