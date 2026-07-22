// Validates syntax for generated Python files.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, matchesGlob, relative } from "node:path";
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

function shouldExcludeFile(filePath, baseDir) {
  const relativePath = relative(baseDir, filePath).replace(/\\/g, "/");
  for (const pattern of excludePatterns) {
    if (matchesGlob(relativePath, pattern)) {
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

function isWindowsStoreStubOutput(text) {
  return /install from the Microsoft Store/i.test(text || "");
}

function commandWorks(command, args = []) {
  const probe = spawnSync(command, [...args, "-V"], { encoding: "utf-8", shell: process.platform === "win32" });
  const combined = `${probe.stdout || ""}\n${probe.stderr || ""}`;
  if (probe.error) return false;
  if (isWindowsStoreStubOutput(combined)) return false;
  return probe.status === 0;
}

function collectInstalledPythonCandidates() {
  const localPrograms = process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "Programs", "Python")
    : null;
  if (!localPrograms || !existsSync(localPrograms)) {
    return [];
  }

  const candidates = [];
  for (const entry of readdirSync(localPrograms)) {
    if (!/^Python/i.test(entry)) continue;
    const pythonExe = join(localPrograms, entry, "python.exe");
    if (existsSync(pythonExe)) {
      candidates.push(pythonExe);
    }
  }
  return candidates;
}

function collectParentVenvCandidates(startDir) {
  const dirs = [];
  let current = startDir;
  while (true) {
    dirs.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  const names = [".venv", "venv"];
  const candidates = [];
  for (const dir of dirs) {
    for (const name of names) {
      candidates.push(join(dir, name, "Scripts", "python.exe"));
      candidates.push(join(dir, name, "bin", "python"));
    }
  }
  return candidates;
}

function resolvePythonCommand() {
  const envCandidates = [process.env.PYTHON, process.env.PYTHON_EXE].filter(Boolean);
  const venvCandidates = [];
  if (process.env.VIRTUAL_ENV) {
    venvCandidates.push(join(process.env.VIRTUAL_ENV, "Scripts", "python.exe"));
    venvCandidates.push(join(process.env.VIRTUAL_ENV, "bin", "python"));
  }

  const pathCandidates = [
    ...envCandidates,
    ...venvCandidates,
    ...collectParentVenvCandidates(process.cwd()),
    ...collectInstalledPythonCandidates(),
    "python",
    "python3",
  ];

  for (const candidate of pathCandidates) {
    if (!candidate) continue;
    if (candidate.includes("\\") || candidate.includes("/")) {
      if (!existsSync(candidate)) continue;
    }
    if (commandWorks(candidate)) {
      return { command: candidate, args: [] };
    }
  }

  // Last resort on Windows: Python launcher
  if (commandWorks("py", ["-3"])) {
    return { command: "py", args: ["-3"] };
  }

  return null;
}

const cwd = process.cwd();
const files = [];
collectPythonFiles(cwd, files, cwd);

const python = resolvePythonCommand();
if (!python) {
  console.error(
    "Could not locate a usable Python interpreter. Checked VIRTUAL_ENV, PYTHON/PYTHON_EXE, Local Programs installs, PATH, and py launcher.",
  );
  process.exit(1);
}

if (files.length === 0) {
  console.error("No Python files found to validate.");
  process.exit(1);
}

const failures = [];
for (const file of files) {
  const result = spawnSync(python.command, [...python.args, "-m", "py_compile", file], {
    encoding: "utf-8",
    shell: process.platform === "win32",
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
