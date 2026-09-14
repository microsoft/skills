import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const yamlExtensions = new Set([".yml", ".yaml"]);
const distributedDirectoryNames = new Set(["examples", "fixtures", "templates"]);
const fullShaReference = /^[^@\s]+@[0-9a-fA-F]{40}$/;

function collectYamlFiles(root: string, includeFile: (path: string) => boolean): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectYamlFiles(path, includeFile));
    } else if (yamlExtensions.has(extname(entry.name)) && includeFile(path)) {
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

  for (const [index, line] of content.split(/\r?\n/u).entries()) {
    const match = line.match(/^\s*(?:-\s*)?uses:\s*["']?([^"'#\s]+)["']?(?:\s+#.*)?$/u);
    const reference = match?.[1];
    if (
      !reference ||
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
  ])("%s", (_name, content, expected) => {
    expect(findMutableActionReferences("fixture.yml", content)).toEqual(expected);
  });

  it("pins external actions in workflows and distributed YAML content to full SHAs", () => {
    const files = [
      ...collectYamlFiles(join(repoRoot, ".github", "workflows"), () => true),
      ...collectYamlFiles(
        join(repoRoot, ".github", "plugins"),
        isDistributedPluginYaml,
      ),
      ...collectYamlFiles(join(repoRoot, "tests", "scenarios"), () => true),
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
