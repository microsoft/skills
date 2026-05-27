# Agent Metadata Contract

Use this contract for Microsoft Foundry agent folders. In azd projects, `.foundry/agent-metadata*.yaml` is an overlay/cache, not the source of truth for azd-owned deployment context.

## Local Layout

```text
<agent-root>/
  .foundry/
    agent-metadata.yaml
    agent-metadata.<env>.yaml
    suites/
    datasets/
    evaluators/
    results/
```

- `agent-metadata.yaml` is the preferred local/dev overlay.
- Optional `agent-metadata.<env>.yaml` files can hold a single prod or CI-targeted overlay.
- `suites/`, `datasets/`, `evaluators/`, and `results/` are local cache/result folders. Ask before overwriting user-edited files.

## Effective Context Model

Resolve deployment and evaluation context by layering sources in this order:

| Value | Preferred source | Fallbacks | Metadata write behavior |
|-------|------------------|-----------|-------------------------|
| Agent root | `azure.yaml` service `project` for `host: azure.ai.agent` | `.foundry` discovery, user path | Do not write except to initialize cache |
| Environment | user/session, then azd env/default | metadata `defaultEnvironment` | Store azd binding only when useful |
| Project endpoint | `azd env get-values` | metadata, user input | Do not duplicate azd values |
| Agent name/version | azd `AGENT_<SERVICE>_*` vars | `agent.yaml`, metadata, user input | Do not duplicate azd values |
| ACR | azd registry vars | metadata, user input | Do not duplicate azd values |
| Observability | azd App Insights vars | metadata, user input | Do not copy secrets if azd has them |
| Local eval draft | `eval.yaml` | metadata, user input | Sync to `.foundry` only after remote lookup/registration |
| Remote suite/cache refs | metadata | Foundry lookups | Persist in `.foundry` |

If azd and metadata both provide the same value and differ, stop and ask which source is authoritative. If they match, use the azd value and omit the duplicate on future metadata rewrites.

## Environment Overlay Model

| Field | Required when | Purpose |
|-------|---------------|---------|
| `defaultEnvironment` | Any metadata file exists | Default key inside this overlay file |
| `environments.<env>.azd.environmentName` | Optional | Binds overlay to an azd environment |
| `environments.<env>.azd.service` | Optional | Binds overlay to an `azure.yaml` service |
| `environments.<env>.projectEndpoint` | Required for non-azd/manual workflows | Explicit override when azd cannot resolve it |
| `environments.<env>.agentName` / `agentVersion` | `agentName` required for non-azd/manual workflows; `agentVersion` optional | Explicit override when azd cannot resolve it |
| `environments.<env>.azureContainerRegistry` | Required for non-azd/manual hosted-agent Docker/ACR deploy flow | Explicit override when azd cannot resolve it |
| `environments.<env>.observability.*` | Required only for trace workflows when azd cannot resolve observability | Trace lookup config when azd cannot resolve it |
| `environments.<env>.evaluationSuites[]` | Required after evaluation setup/sync | Remote suite/dataset/evaluator refs plus local cache paths |
| `environments.<env>.lastEval` | Optional | Last local result summary and result file path |

## Example azd Overlay

```yaml
defaultEnvironment: dev
environments:
  dev:
    azd:
      environmentName: <azd-env-name>
      service: <azure-yaml-service-name>
    evaluationSuites:
      - id: smoke-core
        suiteName: <foundry-suite-name>
        suiteVersion: "1"
        generationSource: eval-yaml
        tags:
          tier: smoke
          purpose: baseline
        suiteFile: .foundry/suites/<suite>-v1.json
        dataset: <dataset-name>
        datasetVersion: "1"
        datasetFile: .foundry/datasets/<agent>-<dataset>-v1.ref.json
        datasetUri: <foundry-dataset-uri>
        evaluators:
          - name: <evaluator-name>
            version: "1"
            threshold: 4
            definitionFile: .foundry/evaluators/<evaluator>-v1.json
```

## Example Manual Overlay

```yaml
defaultEnvironment: dev
environments:
  dev:
    projectEndpoint: https://<account>.services.ai.azure.com/api/projects/<project>
    agentName: <agent-name>
    azureContainerRegistry: <registry>.azurecr.io
    evaluationSuites:
      - id: smoke-core
        datasetFile: .foundry/datasets/<agent>-smoke-v1.ref.json
        evaluators:
          - name: relevance
            threshold: 4
```

## eval.yaml Mapping

When `eval.yaml` exists in the selected agent root, treat it as local evaluation intent, not proof of a Foundry suite.

| eval.yaml field | Use |
|-----------------|-----|
| `agent.name` | Candidate target agent; verify it matches selected context |
| `dataset_file` | Local seed dataset candidate |
| `evaluators[]` | Candidate evaluator names; verify with `evaluator_catalog_get` |
| `name` | Candidate eval/suite name; verify remotely before storing as `suiteName` |
| `options.eval_model` | Candidate judge/generation deployment |
| `options.pass_threshold` | Candidate evaluator threshold/default pass gate |
| `max_samples`, `trace_days`, `generation_instruction` | Suite setup defaults |

Persist eval.yaml-derived suite metadata only after the relevant dataset/evaluator/suite has been registered or found in Foundry. Use `generationSource: eval-yaml` for synced suite entries created from local eval config.

## Workflow Rules

1. Prefer azd service discovery before `.foundry` discovery when `azure.yaml` has `host: azure.ai.agent`.
2. Once an agent root is selected, use only that root's `.foundry`, source tree, `agent.yaml`, and `eval.yaml` unless the user switches roots.
3. Select metadata files in this order: explicit file/path, environment sidecar, `.foundry/agent-metadata.yaml`, then prompt if ambiguous.
4. Resolve environment from user/session, azd env/default, single-environment metadata, then `defaultEnvironment`.
5. Keep the selected root, environment, metadata overlay file, and primary context source visible in deploy/eval/trace summaries.
6. Treat metadata deployment fields as overrides when azd cannot resolve the value.
7. Treat `evaluationSuites[]` as the canonical synced suite model; normalize legacy fields in memory before use.
8. Writes target only the selected metadata file and selected environment. Never merge sibling metadata files automatically.
9. On metadata rewrites for azd projects, persist non-derivable overlay/cache state and omit azd-owned deployment duplicates.
10. Never silently overwrite cache files or metadata. Show a summary before refreshing, pruning duplicate fields, or replacing suite refs.

## Legacy Compatibility

If the selected environment has `testSuites[]` but no `evaluationSuites[]`, treat `testSuites[]` as the current suite source and migrate it on the next metadata write. If it has only legacy `testCases[]`, normalize that list the same way.

Preserve `id`, `suiteName`, `suiteVersion`, `generationJobId`, `generationSource`, `dataset`, `datasetVersion`, `datasetFile`, `datasetUri`, `evaluators`, and existing `tags`. Map legacy `priority` to `tags.tier` only when `tags.tier` is missing: `P0` -> `smoke`, `P1` -> `regression`, `P2` -> `coverage`.

## Evaluation Suite Guidance

Use `tags` as freeform key/value metadata. Suggested keys: `tier` (`smoke`, `regression`, `coverage`), `purpose` (`baseline`, `safety`, `tools`, `quality`), and `stage` (`local`, `generated`, `traces`, `curated`, `prod`).

Each synced suite should point to one dataset and one or more evaluators with thresholds. Store stable remote names separately from versions, keep local cache filenames versioned, and persist `suiteFile`, `datasetFile`, `datasetContentPath`, `datasetUri`, and evaluator `definitionFile` when available. Local dataset filenames should start with the effective Foundry agent name. Use evaluation-suite IDs in evaluation names, result folders, and regression summaries.

For generated Foundry suites, persist `suiteName`, `suiteVersion`, `generationJobId`, and `generationSource`. A suite with `suiteName` still runs batch eval through `evaluation_agent_batch_eval_create`; use `evaluation_suite_get` only to resolve reviewed dataset/evaluator metadata.
