import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

type Grader = {
  type?: string;
  model?: string;
  config?: {
    model?: string;
  };
};

type EvalSpec = {
  defaults?: {
    model?: string;
    judge_model?: string;
  };
  stimuli?: Array<{
    graders?: Grader[];
  }>;
};

type ExperimentSpec = {
  evals?: string[];
  variants?: Record<
    string,
    {
      overrides?: {
        model?: string;
        judge_model?: string;
      };
    }
  >;
};

const scenariosDirectory = resolve(import.meta.dirname, "../scenarios");
const generatorModel = "${MODEL=gpt-5.6-terra}";
const graderModel = "${GRADER_MODEL=claude-sonnet-4.6}";

function findYamlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? findYamlFiles(path)
      : /\.ya?ml$/i.test(entry.name)
        ? [path]
        : [];
  });
}

function readYaml<T>(path: string): T {
  return parse(readFileSync(path, "utf8")) as T;
}

function promptGraderModels(spec: EvalSpec, judgeModel: string): string[] {
  return (spec.stimuli ?? []).flatMap((stimulus) =>
    (stimulus.graders ?? [])
      .filter((grader) => grader.type === "prompt")
      .map((grader) => grader.model ?? grader.config?.model ?? judgeModel),
  );
}

function expectSeparateModels(
  label: string,
  executionModel: string | undefined,
  judgeModel: string | undefined,
  spec: EvalSpec,
): void {
  expect(executionModel, `${label} must use the configured generator model`).toBe(
    generatorModel,
  );
  expect(judgeModel, `${label} must use the configured grader model`).toBe(
    graderModel,
  );
  expect(judgeModel, `${label} must use a different judge model`).not.toBe(
    executionModel,
  );

  for (const promptGraderModel of promptGraderModels(spec, judgeModel ?? "")) {
    expect(
      promptGraderModel,
      `${label} has a prompt grader using a different grader model`,
    ).toBe(graderModel);
  }
}

const yamlFiles = findYamlFiles(scenariosDirectory);
const evalFiles = yamlFiles.filter((path) =>
  /^eval(?:-[^.]+)?\.ya?ml$/i.test(basename(path)),
);
const experimentFiles = yamlFiles.filter(
  (path) => basename(path) === "skill_effectiveness_experiment.yaml",
);

describe("Vally eval model separation", () => {
  for (const evalFile of evalFiles) {
    const label = relative(scenariosDirectory, evalFile);

    it(`${label} separates execution and grader models`, () => {
      const spec = readYaml<EvalSpec>(evalFile);
      expectSeparateModels(
        label,
        spec.defaults?.model,
        spec.defaults?.judge_model,
        spec,
      );
    });
  }

  for (const experimentFile of experimentFiles) {
    const experiment = readYaml<ExperimentSpec>(experimentFile);

    for (const evalReference of experiment.evals ?? []) {
      const evalFile = resolve(dirname(experimentFile), evalReference);
      const spec = readYaml<EvalSpec>(evalFile);

      for (const [variantName, variant] of Object.entries(
        experiment.variants ?? {},
      )) {
        const label = `${relative(scenariosDirectory, experimentFile)} (${variantName}, ${evalReference})`;

        it(`${label} separates execution and grader models`, () => {
          expect(
            variant.overrides?.model,
            `${label} must inherit the parameterized generator model`,
          ).toBeUndefined();
          expect(
            variant.overrides?.judge_model,
            `${label} must inherit the parameterized grader model`,
          ).toBeUndefined();
          expectSeparateModels(
            label,
            variant.overrides?.model ?? spec.defaults?.model,
            variant.overrides?.judge_model ?? spec.defaults?.judge_model,
            spec,
          );
        });
      }
    }
  }
});
