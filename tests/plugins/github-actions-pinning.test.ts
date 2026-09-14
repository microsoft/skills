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

function findMutableActionReferences(source: string, content: string): string[] {
  const findings: string[] = [];
  const isMarkdown = extname(source) === ".md";
  let inYamlFence = !isMarkdown;

  for (const [index, line] of content.split(/\r?\n/u).entries()) {
    if (isMarkdown && /^```ya?ml\s*$/iu.test(line.trim())) {
      inYamlFence = true;
      continue;
    }
    if (isMarkdown && inYamlFence && /^```\s*$/u.test(line.trim())) {
      inYamlFence = false;
      continue;
    }
    if (!inYamlFence) {
      continue;
    }

    const match = line.match(/^\s*(?:-\s*)?uses:\s*["']?([^"'#\s]+)["']?(?:\s+#.*)?$/u);
    const reference = match?.[1];
    if (
      !reference ||
      !reference.includes("@") ||
      reference.startsWith("./") ||
      reference.startsWith("docker://") ||
      fullShaReference.test(reference)
    ) {
      continue;
    }

    findings.push(`${source}:${index + 1}: ${reference}`);
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
