// Validates syntax for generated Python files.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const EXCLUDED_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  ".venv",
  "venv",
  "__pycache__",
  "node_modules",
  ".vally",
]);

// Read optional config file for file-level exclusions
let excludePatterns = [];
const configPath = process.argv[2];
if (configPath) {
  try {
    const configContent = readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent);
    excludePatterns = config.excludePatterns || [];
  } catch (err) {
    console.error(`Warning: Could not read config file "${configPath}":`, err.message);
  }
}

function matchGlobPattern(filePath, pattern) {
  // Simple glob pattern matcher (supports * and **)
  const regexPattern = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "___DOUBLE_STAR___")
    .replace(/\*/g, "[^/]*")
    .replace(/___DOUBLE_STAR___/g, ".*");
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

function shouldExcludeFile(filePath, baseDir) {
  const relativePath = relative(baseDir, filePath).replace(/\\/g, "/");
  for (const pattern of excludePatterns) {
    if (matchGlobPattern(relativePath, pattern)) {
      return true;
    }
  }
  return false;
}

function collectPythonFiles(dir, acc, baseDir) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") && entry !== ".vally") continue;
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectPythonFiles(full, acc, baseDir);
    } else if (entry.endsWith(".py")) {
      if (!shouldExcludeFile(full, baseDir)) {
        acc.push(full);
      }
    }
  }
}

const cwd = process.cwd();
const files = [];
collectPythonFiles(cwd, files, cwd);

if (files.length === 0) {
  console.error("No Python files found to validate.");
  process.exit(1);
}

const failures = [];
for (const file of files) {
  const result = spawnSync("python", ["-m", "py_compile", file], {
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    failures.push({ file, stderr: result.stderr?.trim() ?? "" });
  }
}

if (failures.length > 0) {
  console.error("Python syntax validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure.file}`);
    if (failure.stderr) {
      console.error(failure.stderr);
    }
  }
  process.exit(1);
}

const message = `Validated syntax for ${files.length} Python file(s).${
  excludePatterns.length > 0 ? ` (${excludePatterns.length} pattern(s) excluded)` : ""
}`;
console.log(message);
