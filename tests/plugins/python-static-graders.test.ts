import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { fileURLToPath } from "node:url";

const syntaxCheckerPath = fileURLToPath(
  new URL("../scenarios/_shared/vally/tools/check-python-syntax.mjs", import.meta.url),
);
const idiomaticCheckerPath = fileURLToPath(
  new URL("../scenarios/_shared/vally/tools/check-python-idiomatic.mjs", import.meta.url),
);

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "python-graders-"));
  tempDirs.push(dir);
  return dir;
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function createPythonStub(workspace: string): string {
  const stubContent = `#!/usr/bin/env node
const { readFileSync } = require("node:fs");

const args = process.argv.slice(2);

if (args.includes("-V") || args.includes("--version")) {
  process.stdout.write("Python 3.12.0\\n");
  process.exit(0);
}

if (args[0] === "-m" && args[1] === "py_compile") {
  const file = args[2];
  const text = readFileSync(file, "utf-8");
  if (text.includes("SYNTAX_ERROR")) {
    process.stderr.write(\`File "\${file}", line 1\\nSyntaxError: invalid syntax\\n\`);
    process.exit(1);
  }
  process.exit(0);
}

if (args[0] === "-m" && args[1] === "pylint") {
  const files = args.filter((arg) => arg.endsWith(".py"));
  const failures = [];
  for (const file of files) {
    const text = readFileSync(file, "utf-8");
    if (/from\\s+\\w+(?:\\.\\w+)*\\s+import\\s+\\*/.test(text)) {
      failures.push(\`\${file}:1:0: W0401: Wildcard import example (wildcard-import)\`);
    }
    if (/^\\s*except\\s*:/m.test(text)) {
      failures.push(\`\${file}:1:0: W0702: No exception type(s) specified (bare-except)\`);
    }
  }

  if (failures.length > 0) {
    process.stdout.write(\`\${failures.join("\\n")}\\n\`);
    process.exit(16);
  }

  process.exit(0);
}

process.stderr.write(\`Unexpected python stub arguments: \${args.join(" ")}\\n\`);
process.exit(2);
`;

  if (process.platform === "win32") {
    const scriptPath = join(workspace, "python-stub.mjs");
    const wrapperPath = join(workspace, "python-stub.cmd");
    writeFile(scriptPath, stubContent);
    writeFile(wrapperPath, `@echo off\r\nnode "%~dp0\\python-stub.mjs" %*\r\n`);
    return wrapperPath;
  }

  const stubPath = join(workspace, "python-stub");
  writeFile(stubPath, stubContent);
  chmodSync(stubPath, 0o755);
  return stubPath;
}

function runChecker(
  scriptPath: string,
  workspace: string,
  pythonStub: string,
  configContents?: string,
): SpawnSyncReturns<string> {
  const args = [scriptPath];
  if (configContents !== undefined) {
    const configPath = join(workspace, "config.json");
    writeFile(configPath, configContents);
    args.push(configPath);
  }

  return spawnSync(process.execPath, args, {
    cwd: workspace,
    encoding: "utf-8",
    env: {
      ...process.env,
      PYTHON: pythonStub,
    },
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("python static graders", () => {
  describe("check-python-syntax", () => {
    it("distinguishes * from ** in exclude patterns", () => {
      const workspace = makeTempDir();
      const pythonStub = createPythonStub(workspace);
      writeFile(join(workspace, "assets", "top_level.py"), "print('ok')\n");
      writeFile(join(workspace, "assets", "nested", "broken.py"), "SYNTAX_ERROR\n");

      const result = runChecker(
        syntaxCheckerPath,
        workspace,
        pythonStub,
        JSON.stringify({ excludePatterns: ["assets/*.py"] }),
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("assets/nested/broken.py");
      expect(result.stderr).not.toContain("assets/top_level.py");
    });

    it("matches exclude patterns against normalized relative paths", () => {
      const workspace = makeTempDir();
      const pythonStub = createPythonStub(workspace);
      writeFile(join(workspace, "main.py"), "print('ok')\n");
      writeFile(join(workspace, "templates", "generated.py"), "SYNTAX_ERROR\n");

      const result = runChecker(
        syntaxCheckerPath,
        workspace,
        pythonStub,
        JSON.stringify({ excludePatterns: ["templates/generated.py"] }),
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Validated syntax for 1 Python file(s).");
    });

    it("warns on malformed config and still validates files", () => {
      const workspace = makeTempDir();
      const pythonStub = createPythonStub(workspace);
      writeFile(join(workspace, "main.py"), "print('ok')\n");

      const result = runChecker(syntaxCheckerPath, workspace, pythonStub, "{");

      expect(result.status).toBe(0);
      expect(result.stderr).toContain('Warning: Could not read config file');
      expect(result.stdout).toContain("Validated syntax for 1 Python file(s).");
    });

    it("reports syntax failures for included files", () => {
      const workspace = makeTempDir();
      const pythonStub = createPythonStub(workspace);
      writeFile(join(workspace, "main.py"), "SYNTAX_ERROR\n");

      const result = runChecker(syntaxCheckerPath, workspace, pythonStub);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Python syntax validation failed:");
      expect(result.stderr).toContain("main.py");
    });

    it("fails when no python files are present", () => {
      const workspace = makeTempDir();
      const pythonStub = createPythonStub(workspace);

      const result = runChecker(syntaxCheckerPath, workspace, pythonStub);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("No Python files found to validate.");
    });
  });

  describe("check-python-idiomatic", () => {
    it("allows clean files and tabs inside string literals", () => {
      const workspace = makeTempDir();
      const pythonStub = createPythonStub(workspace);
      writeFile(
        join(workspace, "main.py"),
        [
          "def separator() -> str:",
          '    value = "\\t"',
          "    return value",
          "",
        ].join("\n"),
      );

      const result = runChecker(idiomaticCheckerPath, workspace, pythonStub);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Pylint idiomatic checks passed for 1 Python file(s).");
    });

    it("fails on tab indentation without flagging tabs in strings", () => {
      const workspace = makeTempDir();
      const pythonStub = createPythonStub(workspace);
      writeFile(
        join(workspace, "main.py"),
        [
          "def demo() -> None:",
          '\tprint("hello")',
          '    separator = "\\t"',
          "",
        ].join("\n"),
      );

      const result = runChecker(idiomaticCheckerPath, workspace, pythonStub);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("contains tab indentation");
      expect(result.stderr).not.toContain("separator");
    });

    it("fails on wildcard imports", () => {
      const workspace = makeTempDir();
      const pythonStub = createPythonStub(workspace);
      writeFile(join(workspace, "main.py"), "from math import *\n");

      const result = runChecker(idiomaticCheckerPath, workspace, pythonStub);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Pylint idiomatic checks failed.");
      expect(result.stderr).toContain("W0401");
    });

    it("fails on bare except blocks", () => {
      const workspace = makeTempDir();
      const pythonStub = createPythonStub(workspace);
      writeFile(
        join(workspace, "main.py"),
        ["try:", "    work()", "except:", "    pass", ""].join("\n"),
      );

      const result = runChecker(idiomaticCheckerPath, workspace, pythonStub);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("W0702");
    });

    it("ignores excluded directories", () => {
      const workspace = makeTempDir();
      const pythonStub = createPythonStub(workspace);
      writeFile(join(workspace, "main.py"), "print('ok')\n");
      writeFile(join(workspace, ".vally", "generated.py"), "from math import *\n");

      const result = runChecker(idiomaticCheckerPath, workspace, pythonStub);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Pylint idiomatic checks passed for 1 Python file(s).");
    });

    it("fails when no python files are present", () => {
      const workspace = makeTempDir();
      const pythonStub = createPythonStub(workspace);

      const result = runChecker(idiomaticCheckerPath, workspace, pythonStub);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("No Python files found to evaluate for idiomatic checks.");
    });
  });
});
