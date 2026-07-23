# Vally Scenarios Guide

This directory contains per-skill Vally evaluation scenarios used to validate skill effectiveness and code quality.

## Scope

- Scenario folders live under this directory, for example:
  - azure-ai-projects-py
  - fastapi-router-py
  - azure-storage-blob-ts
- Shared grader tools and plugin code live in:
  - _shared/vally

## Prerequisites

Install and configure the following tools before running evaluations:

1. Node.js 20.17+
2. Corepack enabled
3. pnpm version pinned by tests/package.json
4. Dependencies installed in tests/
5. Build scripts approved for pnpm install policy
6. Python installed and on PATH for Python syntax and idiomatic graders

## One-Time Setup

From repository root:

1. Enable Corepack:
   corepack enable

2. Activate pinned pnpm version (currently 11.10.0):
   corepack prepare pnpm@11.10.0 --activate

3. Install test dependencies:
   pnpm --dir tests install --frozen-lockfile

4. Install Python test dependencies:
   pip install -r tests/requirements.txt

5. Approve required build scripts (if prompted):
   pnpm --dir tests approve-builds

## Running Evaluations

### Run all evals

From repository root:

- All languages:
  ./tests/run-all-evals.ps1

- Python only:
  ./tests/run-all-evals.ps1 -Language py

- TypeScript and Python:
  ./tests/run-all-evals.ps1 -Language ts,py

- Filter by service:
  ./tests/run-all-evals.ps1 -AzureService cosmos

- Single worker for easier debugging:
  ./tests/run-all-evals.ps1 -Language py -Workers 1

- JUnit output:
  ./tests/run-all-evals.ps1 -Language py -JUnit

Results are written to:

- tests/scenario-results/

### Run one eval file directly with Vally

From tests/:

- pnpm exec vally eval --eval-spec scenarios/fastapi-router-py/vally/eval.yaml --output-dir scenario-results/fastapi-router-py --workers 1

From repository root:

- pnpm --dir tests exec vally eval --eval-spec tests/scenarios/fastapi-router-py/vally/eval.yaml --output-dir tests/scenario-results/fastapi-router-py --workers 1

### Run a skill effectiveness experiment

From tests/scenarios/<skill>/vally:

- pnpm --dir ../../.. exec vally experiment run scenarios/<skill>/vally/skill_effectiveness_experiment.yaml --variant sonnet_baseline --output-dir .vally/smoke/<skill> --workers 1

## Scenario Folder Structure

Each skill scenario should follow this layout:

- tests/scenarios/<skill-name>/
  - acceptance-criteria.md
  - scenarios.yaml
  - vally/
    - eval.yaml
    - skill_effectiveness_experiment.yaml
    - syntax-check-config.json (optional for Python)

Notes:

- eval.yaml is the canonical evaluation spec for the skill.
- skill_effectiveness_experiment.yaml compares variants (for example, with skill vs baseline).
- Keep skill-specific inputs and prompts in the skill folder.
- Place reusable grader scripts in _shared/vally/tools and copy them into eval environments via environment.files.

## Writing eval.yaml

A typical eval spec includes:

1. Metadata:
   - name
   - description
   - type
2. defaults:
   - model
   - judge_model
   - runs
   - timeout
3. stimuli:
   - name
   - prompt
   - rubric
   - graders
4. constraints
5. environment:
   - skills
   - files
6. artifacts:
   - include/exclude patterns

Use existing scenarios as references, for example:

- tests/scenarios/fastapi-router-py/vally/eval.yaml

Note that judge_model and model should come from different LLM families - LLMs are rather poor at evaluating their own output.

## Writing skill_effectiveness_experiment.yaml

A typical experiment spec includes:

1. name
2. evals:
   - use eval.yaml
3. vary:
   - commonly /defaults/model and /environment/skills
4. baseline
5. variants:
   - skill-enabled variant
   - baseline variant without skills

Reference:

- tests/scenarios/fastapi-router-py/vally/skill_effectiveness_experiment.yaml

## Shared Tools and Plugins

Shared assets are under:

- tests/scenarios/_shared/vally/tools
- tests/scenarios/_shared/vally/grader-plugins

If you add a custom grader plugin:

1. Place plugin code under _shared/vally/grader-plugins/<plugin-name>
2. Ensure dist output is built
3. Reference grader type in eval.yaml
4. The run-all-evals script auto-detects rust-cargo-build-failure-check and rebuilds plugin if needed

## Common Failures and Fixes

### pnpm version mismatch

Symptom:
- This project is configured to use <version> of pnpm

Fix:
- corepack prepare pnpm@<required-version> --activate

### Ignored build scripts

Symptom:
- ERR_PNPM_IGNORED_BUILDS

Fix:
- pnpm --dir tests approve-builds

### Python syntax grader fails with Python not found

Symptom:
- Python was not found; run without arguments to install from the Microsoft Store

Fix:
- Install Python
- Ensure python or py launcher is available in PATH
- Ensure VS Code terminal session sees the updated environment

### No eval.yaml discovered

Symptom:
- No eval.yaml files found under scenarios root

Fix:
- Confirm file path and folder naming
- Confirm language and service filters passed to run-all-evals.ps1

## Useful Files

- tests/run-all-evals.ps1
- tests/package.json
- tests/scenarios/skill-scenarios.schema.json
- tests/scenarios/_shared/vally/tools/check-python-syntax.mjs
- tests/scenarios/_shared/vally/tools/check-python-idiomatic.mjs

## Contribution Checklist

Before opening a PR for new or updated scenarios:

1. Validate local setup (pnpm version, install, approve-builds)
2. Run targeted evals for modified scenarios
3. Run run-all-evals.ps1 with relevant language filter
4. Verify outputs in tests/scenario-results
5. Ensure scenario prompts and rubrics are concrete and deterministic where possible
