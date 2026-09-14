import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const yamlExtensions = new Set([".yml", ".yaml"]);
const distributedExtensions = new Set([".md", ...yamlExtensions]);
const distributedDirectoryNames = new Set(["examples", "fixtures", "templates"]);
const fullShaReference = /^[^@\s]+@[0-9a-fA-F]{40}$/;

function collectFiles(
  root: string,
  extensions: Set<string>,
  includeFile: (path: string) => boolean,
): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path, extensions, includeFile));
    } else if (extensions.has(extname(entry.name)) && includeFile(path)) {
      files.push(path);
    }
  }

  return files.sort();
}

function isDistributedPluginYaml(path: string): boolean {
  return relative(repoRoot, path)
    .split(sep)
    .some((segment) => distributedDirectoryNames.has(segment));
}

function isYamlCodePosition(line: string, index: number): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let position = 0; position < index; position += 1) {
    const character = line[position];

    if (inDoubleQuote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (inSingleQuote) {
      if (character === "'" && line[position + 1] === "'") {
        position += 1;
      } else if (character === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (character === "#") {
      return false;
    }
    if (character === "'") {
      inSingleQuote = true;
    } else if (character === '"') {
      inDoubleQuote = true;
    }
  }

  return !inSingleQuote && !inDoubleQuote;
}

function findActionReferences(line: string): string[] {
  const references = new Set<string>();
  const blockReference = line.match(
    /^\s*(?:-\s*)?uses:\s*["']?([^"'#\s]+)["']?\s*(?:#.*)?$/u,
  )?.[1];
  if (blockReference) {
    references.add(blockReference);
  }

  const flowReferencePattern =
    /(?:^|[,{]\s*)["']?uses["']?\s*:\s*["']?([^"'#,\]}\s]+)["']?/gu;
  for (const match of line.matchAll(flowReferencePattern)) {
    const usesIndex = (match.index ?? 0) + match[0].indexOf("uses");
    if (match[1] && isYamlCodePosition(line, usesIndex)) {
      references.add(match[1]);
    }
  }

  return [...references];
}

function findMutableActionReferences(source: string, content: string): string[] {
  const findings: string[] = [];
  const isMarkdown = extname(source) === ".md";
  let inYamlFence = !isMarkdown;

  for (const [index, line] of content.split(/\r?\n/u).entries()) {
    const normalizedLine = isMarkdown
      ? line.replace(/^\s*(?:>\s*)+/u, "")
      : line;

    if (isMarkdown && /^```ya?ml\s*$/iu.test(normalizedLine.trim())) {
      inYamlFence = true;
      continue;
    }
    if (isMarkdown && inYamlFence && /^```\s*$/u.test(normalizedLine.trim())) {
      inYamlFence = false;
      continue;
    }
    if (!inYamlFence) {
      continue;
    }

    for (const reference of findActionReferences(normalizedLine)) {
      if (
        !reference.includes("@") ||
        reference.startsWith("./") ||
        reference.startsWith("docker://") ||
        fullShaReference.test(reference)
      ) {
        continue;
      }

      findings.push(`${source}:${index + 1}: ${reference}`);
    }
  }

  return findings;
}

describe("GitHub Actions supply-chain pinning", () => {
  it.each([
    [
      "rejects mutable external references",
      "uses: actions/checkout@v4",
      ["fixture.yml:1: actions/checkout@v4"],
    ],
    [
      "rejects mutable external references with trailing whitespace",
      "uses: actions/checkout@v4 ",
      ["fixture.yml:1: actions/checkout@v4"],
    ],
    [
      "rejects mutable references in flow-style mappings",
      "steps: [{ uses: actions/checkout@v4 }]",
      ["fixture.yml:1: actions/checkout@v4"],
    ],
    [
      "ignores flow-style syntax inside quoted prose",
      'message: "steps: [{ uses: actions/checkout@v4 }]"',
      [],
    ],
    [
      "accepts full commit SHAs",
      "uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
      [],
    ],
    ["accepts local actions", "uses: ./path/to/action", []],
    ["accepts Docker actions", "uses: docker://alpine:3.22", []],
    ["ignores non-GitHub uses keys", "uses: teamsApp/create", []],
    [
      "rejects mutable references in Markdown YAML fences",
      ["```yaml", "uses: actions/checkout@v4", "```"].join("\n"),
      ["fixture.md:2: actions/checkout@v4"],
      "fixture.md",
    ],
    [
      "ignores mutable references outside Markdown YAML fences",
      ["Uses `actions/checkout@v4`.", "", "```text", "uses: actions/checkout@v4", "```"].join("\n"),
      [],
      "fixture.md",
    ],
    [
      "rejects mutable references in blockquoted Markdown YAML fences",
      ["> ```yaml", "> steps:", ">   - uses: actions/checkout@v4", "> ```"].join("\n"),
      ["prompt.md:3: actions/checkout@v4"],
      "prompt.md",
    ],
    [
      "ignores blockquoted YAML without GitHub actions",
      ["> ```yaml", "> - uses: aadApp/create", "> ```"].join("\n"),
      [],
      "prompt.md",
    ],
  ])("%s", (_name, content, expected, source = "fixture.yml") => {
    expect(findMutableActionReferences(source, content)).toEqual(expected);
  });

  it("pins external actions in workflows and distributed content to full SHAs", () => {
    const files = [
      ...collectFiles(
        join(repoRoot, ".github", "workflows"),
        yamlExtensions,
        () => true,
      ),
      ...collectFiles(
        join(repoRoot, ".github", "plugins"),
        distributedExtensions,
        (path) => extname(path) === ".md" || isDistributedPluginYaml(path),
      ),
      ...collectFiles(
        join(repoRoot, ".github", "prompts"),
        new Set([".md"]),
        () => true,
      ),
      ...collectFiles(
        join(repoRoot, "tests", "scenarios"),
        distributedExtensions,
        (path) => extname(path) === ".md" || yamlExtensions.has(extname(path)),
      ),
    ];
    const findings = files.flatMap((path) =>
      findMutableActionReferences(
        relative(repoRoot, path),
        readFileSync(path, "utf8"),
      ),
    );

    expect(files.length).toBeGreaterThan(0);
    expect(findings, findings.join("\n")).toEqual([]);
  });
});
