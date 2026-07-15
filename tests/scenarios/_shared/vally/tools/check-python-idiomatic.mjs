// Heuristic checks for non-idiomatic Python patterns.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

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

function collectPythonFiles(dir, acc) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") && entry !== ".vally") continue;
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectPythonFiles(full, acc);
    } else if (entry.endsWith(".py")) {
      acc.push(full);
    }
  }
}

const files = [];
collectPythonFiles(process.cwd(), files);

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

console.log(`No non-idiomatic patterns detected in ${files.length} Python file(s).`);
