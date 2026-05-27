# Evaluation Suite Generation

Use generated suites as the preferred setup path for deployed agents. The suite generation job can create synthetic or trace-derived data plus an adaptive evaluator from agent, dataset, file, prompt, or trace context.

## Step 1: Ask the User Which Source to Use (MANDATORY)

> ⚠️ **Do not call `evaluation_suite_generation_job_create` without asking the user first.** The generation source materially changes the suite's coverage and cost. Use `ask_user` / `askQuestions` with these options:
>
> - **(a) Current agent code/definition** — synthetic Q&A generated from the agent's instructions and tool definitions. Best for brand-new or recently changed agents with no production traffic.
> - **(b) Historical traces** — sampled from real conversations. **Default lookback: last 3 days (`maxTraces` ~50).** Best for deployed agents with traffic, since the suite reflects real user intents and edge cases.
> - **(c) Existing eval.yaml** — local dataset/evaluator intent from the selected agent root. Best when azd AI agent eval configuration already exists.
>
> **Default selection rule:** If `eval.yaml` exists and `agent.name` matches the selected agent, recommend (c). Otherwise, if the agent has traces in the last 3 days (check via `trace` skill or `evaluation_agent_traces_batch_eval_create` lookback probe), recommend (b); otherwise recommend (a). Always let the user override.

If the user picks (b), compute `traceStartTime` and `traceEndTime` as unix seconds for the chosen window (default `now - 3*86400` to `now`).
If the user picks (c), do not assume a Foundry suite exists. Verify or register the local dataset and evaluators first as described below.

## Step 2: Create and Poll

Call `evaluation_suite_generation_job_create` with the selected `projectEndpoint`, `suiteName`, and `generationModelDeploymentName`. Provide the best available source context:

| Source | Parameters |
|--------|------------|
| Deployed agent (code/definition) | `agentName`, **`agentSourceNames: [<agentName>]`** (required for target), `agentSourceDescription` |
| Existing dataset | `datasetName`, `datasetVersion`, `datasetSourceDescription` |
| File | `fileId`, `fileSourceDescription` |
| Prompt | `promptSource`, `promptSourceDescription` |
| Traces | `traceAgentName` or `traceAgentId`, `traceAgentVersion`, `traceStartTime`, `traceEndTime` (unix seconds), `maxTraces`, `tracesSourceDescription` |

Set `dataGenerationType` (default `simple_qna`), `category` (default `quality`), `deploymentName` (target model for the evaluator's judge — required for LLM-judge evaluators), and `maxSamples` for generated examples.

### Parameter Requirements (Learned Constraints)

> ⚠️ The service rejects requests that miss these:
> - **`maxSamples` must be between 15 and 1000.** Smaller values (e.g., 10) fail with `Max samples must be between 15 and 1000`. Default to `15` for quick smoke suites, `50–100` for richer baselines.
> - **A `target` is required.** When generating from a deployed agent, pass **`agentSourceNames: [<agentName>]`** (not just `agentName`) so the service can construct the `azure_ai_agent` target. Without it, the request fails with `Target is required for evaluation suite generation`.
> - **`deploymentName`** (in `initialization_parameters`) is required when the generated evaluator uses an LLM judge — pass the same or a comparable deployment as `generationModelDeploymentName`.

Poll with `evaluation_suite_generation_job_get(projectEndpoint, jobId)` until the job reaches a terminal state (`succeeded`, `failed`, `canceled`). Generation typically takes **5-15 minutes** for synthetic Q&A and longer for trace-derived suites, so do not block the main response with repeated foreground polling.

> ⚠️ **Mandatory: poll in the background.** Once `evaluation_suite_generation_job_create` returns a `jobId`, persist the in-flight `generationJobId` in the selected `.foundry/agent-metadata*.yaml` file, start a background polling task or background terminal loop, and keep normal chat output clean. The foreground response should say that generation started and that final status will be surfaced when the background poll reaches a terminal state.
>
> **How to poll:** In the background worker, call `evaluation_suite_generation_job_get` every 60-120 seconds until `status` is `succeeded`, `failed`, or `canceled`. Suppress intermediate `in_progress` output unless the status changes or the job is stuck. Do not print every poll result to the user.
>
> The background poll may stop before terminal state only when: (a) the user explicitly tells you to stop polling, (b) the job has been `in_progress` for >30 minutes (treat as stuck and surface the job ID), or (c) polling errors repeatedly (surface the error). Leave the in-flight `generationJobId` recorded in metadata so a later turn can resume polling.
>
> When the background poll reaches `succeeded`, continue by calling `evaluation_suite_get` and then cache/update metadata before producing the completion summary. When it reaches `failed` or `canceled`, surface the terminal status and route to fallback.

## Existing eval.yaml Source

Use this path when the selected agent root has `eval.yaml` and the user chooses it:

1. Parse `agent.name`, `dataset_file`, `evaluators[]`, `name`, `options.eval_model`, `options.pass_threshold`, `max_samples`, `trace_days`, and `generation_instruction`.
2. Verify `agent.name` matches the effective selected agent from azd/metadata. If it differs, stop and ask which target is authoritative.
3. Confirm the `dataset_file` exists under the selected agent root. Treat it as a local seed dataset until `evaluation_dataset_create` or a remote lookup succeeds.
4. For each evaluator name, call `evaluator_catalog_get` before treating it as remote. If missing, ask whether to create/register it or generate a new adaptive evaluator.
5. If `name` is populated, call `evaluation_suite_get` before storing it as `suiteName`. If no suite exists, either create/register a reviewed suite or persist a local-draft entry without `suiteName`.
6. Persist only synced remote refs and local cache paths to `.foundry/agent-metadata*.yaml` with `generationSource: eval-yaml`; do not copy azd-owned deployment context into metadata.

## Cache Artifacts Locally

> ⚠️ **Mandatory after `succeeded`.** As soon as the background poll reaches `succeeded`, perform **all three** of the following calls and write **all three** files. This is not optional — partial caching (e.g., metadata stub instead of full evaluator definition) is the most common skill bug. Do not write the deployment/eval-setup summary until the three files exist.

Save artifacts under the selected agent root only, using these exact paths and contents:

| Call | Local file | Contents |
|------|------------|----------|
| `evaluation_suite_get(projectEndpoint, suiteName, version)` | `.foundry/suites/<suite-name>-v<version>.json` | The **full** returned suite object (target, testing_criteria, dataset ref, input_messages). |
| `evaluator_catalog_get(name, version)` | `.foundry/evaluators/<evaluator-name>-v<version>.json` | The **full** returned evaluator object including `definition.dimensions`, `definition.metrics`, `definition.data_schema`, and `generation_artifacts`. Do NOT save a YAML stub — persist the complete JSON so HITL rubric edits + `evaluator_catalog_update(createNewVersion: true)` can round-trip. |
| `evaluation_dataset_get(name, version)` + `evaluation_dataset_sas_url_get(datasetName, datasetVersion)` | `.foundry/datasets/<agent-name>-<dataset-name>-v<version>.ref.json` AND `.foundry/datasets/<dataset-name>-v<version>/<blob-name>` | Metadata stub PLUS the actual dataset blob(s). The SAS-url tool returns a container-scope SAS (`sr=c, sp=rl`); list the container then download every blob (see "Dataset Content Download" below). Set `contentDownloaded: true` + `contentFiles: [...]` in the stub. |

For the first two, do not skip fields and do not transform — write the JSON returned by the MCP tool. Do not overwrite user-edited cache files without confirmation. Exception: deterministic re-fetch of the same immutable remote `<name>-v<version>` may replace the generated cache artifact for that exact version when rehydrating a missing, stale, or corrupt local cache.

### Dataset Content Download (USE THIS — DO NOT SKIP)

The dataset rows live in a Foundry-managed Azure Storage container (host pattern `sa*.blob.core.windows.net`). User Entra credentials against the container fail (`InvalidAuthenticationInfo: Issuer validation failed`) and the storage account is not exposed as a project connection, BUT a working download path exists:

1. Call `evaluation_dataset_sas_url_get(projectEndpoint, datasetName, datasetVersion)`. It returns a container-scope SAS URL with `sr=c&sp=rl` (read + list).
2. **List blobs** via REST: `GET <containerUrlWithoutSas>?restype=container&comp=list&<sasQueryWithoutLeadingQuestionMark>`. Response is XML; blob names are at `EnumerationResults.Blobs.Blob.Name`.
3. **Download each blob** to `.foundry/datasets/<dataset-name>-v<version>/<blob-name>` using the same SAS query appended: `<containerUrl>/<blobName>?<sasQuery>`.
4. Use `curl.exe` (not PowerShell `Invoke-RestMethod` / `Invoke-WebRequest`) on Windows — PowerShell's URI parser chokes on Azure Storage SAS query strings and throws "Invalid URI: The hostname could not be parsed". `curl.exe` ships with Windows 10/11.
5. Update the `.ref.json` stub with `contentDownloaded: true`, `contentPath`, and `contentFiles: [...]`.

Only fall back to the portal-export workaround (Foundry portal → suite → Dataset → Download as JSONL) when `evaluation_dataset_sas_url_get` itself is unavailable or returns an error. Do NOT attempt `az storage blob`, `az storage account list`, or Resource Graph scans for the storage account — they will fail and waste tool calls.

If the dataUri host does NOT match the Foundry-managed `sa*.blob.core.windows.net` pattern (e.g., a customer-owned storage account registered as a project connection), use the connection-resolved credential rather than the SAS flow.

### Job-Returned Direct Artifacts

If the generation job output includes direct file/session references (rare — most jobs only return remote names/versions), download those artifacts and place them in the same `.foundry/` folders alongside the reference files above.

## Regenerate One Artifact

Use `data_generation_job_create` when the user wants fresh data without replacing the whole suite. It accepts `jobName`, `projectEndpoint`, optional `agentName`/`agentVersion`, `datasetName`/`datasetVersion`, `fileId`, `promptSource`, trace parameters, `generationType`, `questionTypes`, `scenario`, `maxSamples`, and `trainSplit`. Poll with `data_generation_job_get` in the background using the same clean-output rules.

Use `evaluator_generation_job_create` to create or regenerate one adaptive evaluator. To regenerate, pass the existing `evaluatorName` plus updated source inputs and `modelDeploymentName`; poll with `evaluator_generation_job_get` in the background using the same clean-output rules.

## Review and Sync Back

After users edit generated dataset rows or evaluator rubrics locally:

1. Save a new local dataset/evaluator version instead of overwriting the old one.
2. Register approved dataset data with `evaluation_dataset_create`.
3. For evaluator rubric changes, use `evaluator_catalog_update(createNewVersion: true)` when metadata/dimension edits are sufficient; otherwise regenerate with `evaluator_generation_job_create(evaluatorName, ...)`.
4. Create an immutable suite version with `evaluation_suite_create` so future agent-target batch evals can resolve the reviewed artifacts with `evaluation_suite_get`.

## Fallback

If suite, data, or evaluator generation fails or returns incomplete artifacts, explain the failure and use the manual fallback: `evaluator_catalog_get`, local seed JSONL generation, `evaluation_dataset_create`, and `evaluationSuites[]` metadata with `generationSource: manual-fallback`.

Do not use `evaluation_suite_run` for batch eval. Use `evaluation_agent_batch_eval_create` after reviewing the generated suite artifacts.
