# Fixture-based Vally evaluations

This directory contains a standalone series of Vally evaluations that exercise coding agents against real application fixtures in this repository. Vally discovers the evaluations and suites through `.vally.yaml`.

## Setup

```powershell
cd vally-evaluations
npm ci
```

Node.js 22 or newer and an authenticated GitHub Copilot CLI are required.

Skills are opt-in. Each evaluation declares `skills: []`, and the suite-level
skill search path is empty, so these evaluations do not provide skills to the
evaluated agent.

## Run

Run every evaluation and generate a report:

```powershell
./run-evaluations.ps1
```

Useful options:

```powershell
# Preview selected evaluations
./run-evaluations.ps1 -DryRun

# Run matching evaluation directories
./run-evaluations.ps1 -EvaluationPattern "calendar-*"

# Increase parallel trials within each evaluation
./run-evaluations.ps1 -Workers 2

# Override the evaluated agent and LLM judge models
./run-evaluations.ps1 -Model "gpt-5.6-terra" -JudgeModel "claude-sonnet-4.6"

# Run the same evaluations against multiple agent models
./run-evaluations.ps1 -Model gpt-5.6-sol,gpt-5.6-terra

# Regenerate reports for an existing run
./run-evaluations.ps1 -ReportOnly -ResultsDirectory ./results/<run>
```

When `-Model` or `-JudgeModel` is omitted, the corresponding value from each
evaluation's `defaults` section is used. `-Model` also accepts a quoted
comma-separated value. Multiple agent models are run as separate Vally
invocations with isolated workspaces, then combined into the run report.

Each run writes raw Vally output plus `summary.json`, `artifacts-manifest.json`, and `report.md` under `results/<timestamp>/`. Every operation preserves its complete final workspace and its filtered generated artifacts. The reporting step also creates a `narrative.md` beside each operation's `events.jsonl` and appends explicit usage and captured-data links to each generated `eval-results.md`. Each narrative contains the initial stimulus followed by every assistant turn, assistant message, tool action, tool outcome, and grader result captured by Vally. Reports aggregate:

- Input, output, cache, and total tokens
- Tool-call counts and per-tool breakdowns
- Agent wall time and end-to-end trial duration
- GitHub Copilot usage in nano-AIU and AI Credits

`artifacts-manifest.json` inventories the narrative, Vally result record, OpenTelemetry spans, final workspace, generated artifacts, and Copilot session state (`events.jsonl` and `metadata.json`) for every operation. Final workspaces include installed dependencies and can be substantially larger than the filtered `artifacts/` directories.

AI Credit totals cover the evaluated agent only. Vally does not include LLM judge or grader usage in `trajectory.metrics.tokenUsage.cost`. If an executor does not report complete Copilot cost, the report displays the known subtotal and its trial coverage instead of presenting it as a complete total.

The evals invoke package scripts through `tools/run-npm.mjs`. Vally launches program graders without a shell, so directly using `command: npm` fails with `ENOENT` on Windows because npm is exposed there as `npm.cmd`.

## Add an evaluation

Create `evaluations/<name>/eval.yaml`. The runner discovers it automatically. Fixture directories can be copied recursively with `environment.files`; avoid copying fixture `node_modules` or build output.

## Current evaluations

| Evaluation | Stimulus |
| --- | --- |
| `calendar-appointment-conflicts` | Add tested appointment-overlap validation. |
| `calendar-azure-blob-storage` | Detailed prompt for replacing browser-only persistence with Azure Blob Storage and provisioning its infrastructure. |
| `calendar-azure-blob-storage-open-ended` | Minimal Azure Blob Storage service prompt for measuring the base model's SDK knowledge, with no deployment requirements. |
| `calendar-azure-observability-open-ended` | Add queryable Azure logging and distributed tracing while allowing the model to choose the service and instrumentation technologies. |
| `calendar-azure-live-integration-tests` | Verify the generated observable application locally against disposable live Blob Storage and Application Insights resources, then clean up. |

The first three evaluations seed their workspaces from `fixtures/calendar-base/`.
The observability evaluation instead uses the source-only snapshot under
`fixtures/calendar-azure-blob-storage-open-ended-gpt-5.6-terra/`. That snapshot
is derived from the final workspace produced by the `gpt-5.6-terra` trial in
run `2026-08-28T21-07-01-120Z` of `calendar-azure-blob-storage-open-ended`.
It includes the generated server-side Azure Blob Storage implementation and tests,
but excludes installed dependencies, build output, and Vally session data.

The live-integration evaluation uses
`fixtures/calendar-azure-observability-open-ended-gpt-5.6-terra/`, derived from
the final `gpt-5.6-terra` workspace in run `2026-08-28T21-45-58-038Z` of
`calendar-azure-observability-open-ended`. It includes that trial's Azure Monitor
Application Insights OpenTelemetry instrumentation on top of the Blob-backed
application. This stage is solely about proving that the existing application code
works from a local process against its real Azure Blob Storage and Application
Insights dependencies. The evaluation independently requires and grades successful
provisioning of disposable test resources and successful application assertions
against them. Application hosting, deployment, containerization, and production
infrastructure are reserved for later evaluations.

The Azure evaluations intentionally have different scopes: the detailed evaluation includes provisioning requirements, while the SDK baseline contains only the Azure Blob Storage service request. Neither evaluation exposes skills or repository instructions. All evaluations use `gpt-5.6-terra` as the evaluated agent and `claude-sonnet-4.6` as the judge. Run the SDK baseline with:

```powershell
./run-evaluations.ps1 -EvaluationPattern "calendar-azure-blob-storage-open-ended"
```

Run the follow-on observability evaluation with:

```powershell
./run-evaluations.ps1 -EvaluationPattern "calendar-azure-observability-open-ended"
```

Run the live-integration evaluation only when the Azure CLI is authenticated to a
subscription in which the evaluated agent may create role assignments and
disposable resource groups:

```powershell
./run-evaluations.ps1 -EvaluationPattern "calendar-azure-live-integration-tests"
```
