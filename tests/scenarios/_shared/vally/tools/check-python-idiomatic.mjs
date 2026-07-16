// Heuristic checks for non-idiomatic Python patterns.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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
  console.error("No Python files found to evaluate for idiomatic checks.");
  process.exit(1);
}

const failures = [];
for (const file of files) {
  const text = readFileSync(file, "utf-8");
  if (text.includes("\t")) {
    failures.push(`${file}: contains tab indentation`);
  }
  if (/^\s*from\s+\S+\s+import\s+\*/m.test(text)) {
    failures.push(`${file}: uses wildcard import`);
  }
  if (/^\s*except\s*:\s*$/m.test(text)) {
    failures.push(`${file}: uses bare except`);
  }
}

if (failures.length > 0) {
  console.error("Non-idiomatic Python patterns found:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`No non-idiomatic patterns detected in ${files.length} Python file(s).${
  excludePatterns.length > 0 ? ` (${excludePatterns.length} pattern(s) excluded)` : ""
}`);
