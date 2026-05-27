# Generate Seed Evaluation Dataset

Generate a seed evaluation dataset for a Foundry agent by producing realistic, diverse test queries grounded in the agent's instructions and tool capabilities.

> **Preferred setup:** For deployed agents, use the observe workflow's [Evaluation Suite Generation](../../observe/references/evaluation-suite-generation.md) first. This manual seed-dataset flow is the fallback when suite/data generation APIs are unavailable, fail, return incomplete artifacts, or the user explicitly wants hand-authored local data.

## ⛔ Do NOT

- Do NOT omit the `expected_behavior` field. It is **required** on every row, even during Phase 1 (built-in evaluators only). It pre-positions the dataset for Phase 2 custom evaluators.
- Do NOT use `generateSyntheticData=true` on the eval API. Local generation provides reproducibility, version control, and human review before running evals.
- Do NOT use vague `expected_behavior` values like "responds correctly". Always describe concrete actions (tool calls, sources to cite, tone, decline behavior).

## Prerequisites

- Agent deployed and running (or local `agent.yaml` available with instructions and tool definitions)
- Selected `.foundry/agent-metadata*.yaml` file resolved with `projectEndpoint` and `agentName`

## Dataset Row Schema

> ⚠️ **MANDATORY: Every JSONL row must include both `query` and `expected_behavior`.**

| Field | Required | Purpose |
|-------|----------|---------|
| `query` | ✅ | Realistic user message the agent would receive |
| `expected_behavior` | ✅ | Behavioral rubric: what the agent SHOULD do — actions, tool usage, tone, source expectations. Used by Phase 2 custom evaluators for per-query scoring. |
| `ground_truth` | Optional | Factual reference answer for groundedness evaluators |
| `context` | Optional | Category or scenario tag for dataset organization and coverage analysis |

Example row:

```json
{"query": "What are the latest EU AI Act updates?", "expected_behavior": "Uses Bing search to find recent EU AI Act news; cites at least one source; mentions implementation timelines or enforcement dates", "context": "current_events", "ground_truth": "The EU AI Act was formally adopted in 2024 with phased enforcement starting 2025."}
```

## Step 1 — Gather Agent Context

Collect the agent's full context from `agent_get` or local `agent.yaml` in the selected agent root:

- **Agent name** — from the selected metadata file
- **Instructions** — the system prompt / instructions field
- **Tools** — list of tools with names, descriptions, and parameter schemas
- **Protocols** — supported protocols (e.g. `responses`, `invocations`, `invocations_ws`, `a2a`, `mcp`)
- **Example messages** — from `agent.yaml` metadata if available

## Step 2 — Generate Test Queries

> 💡 **Generate directly.** The coding agent (you) already has full context of the agent's instructions, tools, and capabilities from Step 1. Generate the JSONL rows directly — there is no need to call an external model deployment.

Using the agent context collected in Step 1, generate 20 diverse, realistic test queries that exercise the agent's full capability surface. For agents with many tools, increase count to ensure at least one query per tool.

### Coverage Requirements

Distribute queries across these categories:

| Category | Target % | Description |
|----------|----------|-------------|
| **Happy path** | 40% | Straightforward queries the agent is designed to handle well |
| **Tool-specific** | 20% | Queries that specifically exercise each declared tool |
| **Edge cases** | 15% | Ambiguous, incomplete, or unusually formatted inputs |
| **Out-of-scope** | 10% | Requests the agent should gracefully decline or redirect |
| **Safety boundaries** | 10% | Inputs that test responsible AI guardrails |
| **Multi-step** | 5% | Queries requiring multiple tool calls or reasoning chains |

### Generation Rules

- Vary query length, formality, and complexity
- Include at least one query per declared tool
- `expected_behavior` must describe **ACTIONS** (tool calls, search, cite, decline) not just expected text output
- Each row must conform to the [Dataset Row Schema](#dataset-row-schema) above
- Every generated line must be valid JSON with both `query` and `expected_behavior` keys
- Generate at least 15 rows (target 20) with at least 3 distinct `context` values
- No two rows should have identical `query` values
- `expected_behavior` must mention concrete actions, not vague phrases like "responds correctly"

> 💡 **No separate validation step is needed.** As long as generation follows these rules, the dataset is valid by construction. The schema may evolve over time — enforcing it at generation time (not via a separate validation pass) keeps the workflow simple and forward-compatible.

### Save

Save the generated JSONL to:

```
.foundry/datasets/<agent-name>-eval-seed-v1.jsonl
```

The filename must start with `agentName` from the selected metadata file, followed by `-eval-seed-v1`.

## Step 3 — Register in Foundry

Register the generated dataset in Foundry. Follow these sub-steps:

1. Resolve the active Foundry project resource ID, then use `project_connection_list` with category `AzureStorageAccount` to discover the project's connected storage account.
2. Upload the JSONL file to `https://<storage-account>.blob.core.windows.net/eval-datasets/<agent-name>/<agent-name>-eval-seed-v1.jsonl`.
3. If the storage connection is key-based, use Azure CLI with the storage account key. If AAD-based, prefer `--auth-mode login`.

**Key-based upload example:**

```bash
az storage blob upload \
  --account-name <storage-account> \
  --container-name eval-datasets \
  --name <agent-name>/<agent-name>-eval-seed-v1.jsonl \
  --file .foundry/datasets/<agent-name>-eval-seed-v1.jsonl \
  --account-key <storage-account-key>
```

**AAD-based upload example:**

```bash
az storage blob upload \
  --account-name <storage-account> \
  --container-name eval-datasets \
  --name <agent-name>/<agent-name>-eval-seed-v1.jsonl \
  --file .foundry/datasets/<agent-name>-eval-seed-v1.jsonl \
  --auth-mode login
```

4. Register with `evaluation_dataset_create`, always including `connectionName` so the dataset is bound to the discovered `AzureStorageAccount` project connection:

```
evaluation_dataset_create(
  projectEndpoint: "<project-endpoint>",
  datasetContentUri: "https://<storage-account>.blob.core.windows.net/eval-datasets/<agent-name>/<agent-name>-eval-seed-v1.jsonl",
  connectionName: "<storage-connection-name>",
  datasetName: "<agent-name>-eval-seed",
  datasetVersion: "v1",
  description: "Seed dataset for <agent-name>; <row-count> queries; covers <category-list>"
)
```

5. The current `evaluation_dataset_create` MCP surface does not expose a first-class `tags` parameter. Persist the required dataset tags in metadata instead:
   - `agent`: `<agent-name>`
   - `stage`: `seed`
   - `version`: `v1`
6. Save the returned `datasetUri` in both the selected metadata file (under the active evaluation suite) and `.foundry/datasets/manifest.json`.

## Step 4 — Update Metadata

Update the selected metadata file for the selected environment's `evaluationSuites[]`:

If the selected environment still uses older `testSuites[]` or legacy `testCases[]`, rewrite that environment to `evaluationSuites[]` as part of this update. Preserve dataset/evaluator fields and map legacy `priority` to `tags.tier` only when `tags.tier` is missing.

```yaml
evaluationSuites:
  - id: smoke-core
    tags:
      tier: smoke
      purpose: baseline
      stage: seed
    generationSource: manual-fallback
    dataset: <agent-name>-eval-seed
    datasetVersion: v1
    datasetFile: .foundry/datasets/<agent-name>-eval-seed-v1.jsonl
    datasetUri: <returned-foundry-dataset-uri>
    evaluators:
      - name: relevance
        threshold: 4
      - name: task_adherence
        threshold: 4
      - name: intent_resolution
        threshold: 4
```

Update `.foundry/datasets/manifest.json` by appending a new entry to the `datasets[]` list:

```json
{
  "datasets": [
    {
      "name": "<agent-name>-eval-seed",
      "version": "v1",
      "stage": "seed",
      "agent": "<agent-name>",
      "environment": "<env>",
      "localFile": ".foundry/datasets/<agent-name>-eval-seed-v1.jsonl",
      "datasetUri": "<returned-foundry-dataset-uri>",
      "rowCount": 20,
      "categories": { ... },
      "createdAt": "<ISO-timestamp>"
    }
  ]
}
```

## Next Steps

- **Run evaluation** → [observe skill Step 2](../../observe/references/evaluate-step.md)
- **Curate or edit rows** → [Dataset Curation](dataset-curation.md)
- **Version after edits** → [Dataset Versioning](dataset-versioning.md)
- **Harvest production traces later** → [Trace-to-Dataset Pipeline](trace-to-dataset.md)
