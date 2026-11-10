# Deploy a Foundry Agent

Provision Azure resources when needed, deploy the agent, and smoke-test it.
For **hosted agents** (custom container or code), use `azd deploy`.
For **Voice Agents**, use `azd deploy` and smoke-test over the subtype-specific WebSocket endpoint.
For **Managed Harness Agents** (`kind: prompt` plus the Copilot harness), use `azd deploy`.
For **ordinary prompt agents**, use the Foundry MCP `agent_update` tool.

## Quick Reference

| Property | Value |
|----------|-------|
| Hosted (recommended) | `azd provision` when needed, code deploy via `azd deploy` (`codeConfiguration` present), then verify and invoke |
| Hosted (container) | `azd provision` when needed, container deploy via `azd deploy` (remote builds require a Dockerfile and ACR; local builds also require Docker; no `codeConfiguration:` in the `azure.yaml` service block) |
| Voice (GPT-Live Voice) | `azd provision` when creating a missing model or Responses backend deployment, declarative `azd deploy`, then use the dedicated `voice/live/sessions` session smoke |
| Voice (Prompt Voice) | `azd provision` when needed, declarative `azd deploy`, then verify over the `voice` WebSocket endpoint (`azd ai agent invoke` is not supported) |
| Voice (Hosted Voice) | `azd provision` when needed, `azd deploy` for both the `kind: hosted` target and `kind: voice` wrapper, report both versions separately, and smoke-test the wrapper over the `voice` WebSocket endpoint |
| Managed Harness Agent | `azd provision` when needed, then declarative `azd deploy`; no code/container packaging |
| Prompt MCP | `agent_definition_schema_get`, `agent_update`, `agent_get`, `agent_delete` |
| Versioning | Each successful `azd deploy` creates an immutable agent version |
| Endpoint-only patch | `azd ai agent endpoint update` (no new version) |
| Local dev | [create-hosted](../create/create-hosted.md), [create-voice](../create/create-voice.md), [local-run](../create/references/local-run.md) |

## Route by Agent Type

- `kind: voice` or legacy `kind: prompt-voice` -> **Voice**. Read [Voice Agent subtypes](../create/references/voice-agent/subtypes.md), then use the azd Voice workflow below.
- Shipping Python / .NET code (`kind: hosted`) -> **Hosted** (azd workflow below).
- Explicit `kind: prompt` plus `harness.type: microsoft_copilot_preview` or legacy `github_copilot_preview` -> **Managed Harness Agent** (azd workflow below).
- Ordinary Prompt Agent model / instructions / tools -> **Prompt** (MCP workflow below).

## Deploy Mode Selection -- Hosted agents

Follow the user's explicit deploy mode preference or the existing project configuration. Otherwise, use **code deploy through azd** by default (no Docker/ACR required): the agent's `azure.yaml` service block must contain `codeConfiguration:`, so `azd deploy` will zip the source and let Foundry build it. If `azd deploy` prints `Packaging container` for an agent that does not need container-specific behavior, add or fix `codeConfiguration` and retry.

When the agent depends on Dockerfile behavior, system packages, or a pre-built image, or when the user explicitly asks to build or deploy a container image, mentions Container/Docker Image/Azure Container Registry (ACR), or supplies a pre-built image, use container deploy.

Before running `azd deploy`, inspect the agent's service block in `azure.yaml`.

| Service block state | Deployment path |
|------------------|-----------------|
| `codeConfiguration:` present | **Code deploy** through `azd deploy`; no Docker/ACR build. |
| No `codeConfiguration:` with `language: docker` | **Container deploy** through `azd deploy`. |

`codeConfiguration:` example in the `azure.yaml` service block:

```yaml
services:
  <agent-name>:
    host: azure.ai.agent
    codeConfiguration:
      runtime: python_3_13
      entryPoint: main.py
      dependencyResolution: remote_build
```

Remote ACR build example in the `azure.yaml` service block:

```yaml
services:
  <agent-name>:
    host: azure.ai.agent
    language: docker
    docker:
      remoteBuild: true
```

## Workflow -- Hosted agent (azd)

> Prerequisite: project scaffolded with `azd ai agent init`. If not, start at [create-hosted](../create/create-hosted.md).

### Step 1 -- Resolve azd environment

If the user provided an existing project endpoint, project ARM ID, or model deployment, set those values before deploy:

```bash
azd env set AZURE_AI_PROJECT_ENDPOINT "<project-endpoint>"
azd env set AZURE_AI_PROJECT_ID "<project-arm-id>"
azd env set AZURE_AI_MODEL_DEPLOYMENT_NAME "<model-deployment-name>"
```

If using container deploy and the user provided an existing ACR, set:

```bash
azd env set AZURE_CONTAINER_REGISTRY_NAME "<acr-name>"
azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT "<acr-login-server>"
azd env set AZURE_CONTAINER_REGISTRY_RESOURCE_ID "<acr-resource-id>"
```

Verify the azd environment with `azd env get-values`.

Run:

```bash
azd ai project show --output json
azd ai agent show --output json
```

Branch on output: `not_deployed` -> Step 2. `active` / `deployed` -> redeploy (skip Step 2, go to Step 3). If `azd ai project show` fails with `missing_project_endpoint`, do Step 2 first -- `azd provision` will create the project.

> **Important:** Before deploy, also make sure the agent's `azure.yaml` service block and the azd environment are aligned with the user's provided configuration values.

### Step 2 -- Provision Azure resources (one-time per env)

> 🚦 **Project-selection gate.** If no foundry project endpoint is configured (not in the message, `azd env`, or `.env`) and the user hasn't asked to create one, stop and ask them to pick an existing foundry project or confirm creating a new one — don't silently select.

Skip `azd provision` when the user gave you an existing `AZURE_AI_PROJECT_ENDPOINT` or `FOUNDRY_PROJECT_ENDPOINT` and no infrastructure changes are needed. If container deploy needs a new ACR, run `azd provision` even when using an existing Foundry project.

Run provision only for new projects or real infrastructure changes:

```bash
azd provision --no-prompt
```

> Optional: run `azd provision --preview --no-prompt` first to preview the resource changes (a what-if) before applying them.
>
> Optional: add `--no-state` on a fresh azd environment to skip the existing-deployment check and provision faster; omit it when re-provisioning an existing one.

What this does:

- Creates the Foundry project (if not present) and supporting resources under `infra/`.
- Creates connections declared as top-level `azure.ai.connection` services. `${PARAM_*}` placeholders resolve from the active azd env.
- Wires model deployments, AI Search, ACR, etc. `infra/layers/` provision in parallel when present.

After provision completes for a new project, run `azd env get-values` and set missing required azd env values, especially `AZURE_AI_PROJECT_ID` and `AZURE_TENANT_ID`, before local run or the first `azd deploy`.

### Step 3 -- Pre-deployment check

Branch by deploy mode.

#### Code deploy

Run `azd env get-values` and verify that these values are set for the intended
environment:

- `AZURE_AI_PROJECT_ENDPOINT`
- `AZURE_AI_PROJECT_ID`
- `AZURE_AI_MODEL_DEPLOYMENT_NAME`
- `AZURE_TENANT_ID`

For Python, verify that `<service-dir>/.agentignore` excludes `.venv/`, adding the rule if missing.

#### Container deploy

Complete the [Container Deploy Precheck](references/container-deploy.md)
before continuing.

### Step 4 -- Deploy the agent

> **Private package index:** If `azd deploy` fails and the user's `uv.lock` points to a private Python package index, the Foundry service might be unable to access the index when installing dependencies. Guide the user to regenerate `uv.lock` using the public PyPI index, or export the locked dependencies to a `requirements.txt` file with pinned versions, and then retry the deployment.

```bash
azd deploy --no-prompt
# Multi-service:
azd deploy <service-name> --no-prompt
```

What deploy does:

- Reads the agent's `azure.yaml` service block, packages the agent, uploads it, and registers a new immutable version.
- **Code deploy** (`codeConfiguration` present): zips source, excludes `.agentignore`, and lets Foundry build the runtime image.
- **Container deploy** (no code configuration): builds the `Dockerfile`, pushes to the project's ACR, registers the version. When the service block has `image:` set, `azd` reuses the pre-built image.

After deploy, azd writes `AGENT_<SVC>_NAME`, `AGENT_<SVC>_VERSION`, and `AGENT_<SVC>_<PROTO>_ENDPOINT` (one per protocol) into the active env.

For agents with Activity protocol, `azd deploy` also generates `<service-dir>/TEAMS_APP_SETUP.md`; read it and explain the remaining post-deployment steps to the user.

Re-deploying an identical build still creates a new version; `azd` prints `Agent version <n> is already active.` and skips the poll.

If deploy reports `Done` for the service and then fails only in `postdeploy` with `Agent <service-name> with version <n> not found`, the `azure.yaml` service key and the service's `name:` were mismatched. Rename the `azure.yaml services` key to the deployed agent name and rerun `azd deploy --no-prompt`; do not switch deploy mode.

### Step 5 -- Verify and invoke

```bash
azd ai agent show --output json
```

Expect `"status": "active"` (or `"deployed"`) and an `agent_endpoints` map. Inspect the selected service protocols in `azure.yaml`, then smoke-test:

For the Responses or Invocations protocol, smoke-test with azd:

```bash
azd ai agent invoke "hello, are you up?"
```

For a multi-protocol service, pass `--protocol` explicitly.

> Remote invocation can incur model usage charges. Run it only as part of the requested deployment or test.

For the Activity protocol, `azd ai agent invoke` won't work; follow [invoke](../invoke/invoke.md) to invoke the agent.

Run one remote invocation only unless the user explicitly asked to test multi-turn/session behavior. A single successful response is enough for the deployment smoke test. Anything other than a completed/successful response -> run `azd ai agent doctor --output json`, then follow [troubleshoot](../troubleshoot/troubleshoot.md).

### Step 6: Auto-Generate Evaluation Suite (MANDATORY — RUNS AUTOMATICALLY)

> ⚠️ **Pre-summary gate.** If you are about to write a deployment summary or Playground link and Step 6 has not run, you are violating this skill. Run Step 6 first.

This step runs automatically after deploy. Ask the user which source to use and start it right after deploy succeeds — with `--no-wait`, `generate` returns in seconds and generation runs server-side, so it overlaps with invoke/test steps and finishes faster overall.

> *"Your agent is deployed. Want me to set up an evaluation suite now? (a) Yes — current agent instructions (synthetic Q&A), (b) Yes — historical traces (last 3 days), (c) Yes — use existing `azure.eval.yaml`, (d) No / later."*

| Choice | Command | What's next |
|---|---|---|
| (a) Agent instructions | `azd ai eval generate --from agent --agent-instruction "<agent purpose>" --no-wait --no-prompt` — use the service's `description:` in `azure.yaml`. | Generation runs server-side. Tell the user: *"Suite submitted. Collect the artifacts, configure and create the eval, then run `azd ai eval run start` whenever you're ready."* |
| (b) Historical traces | `azd ai eval generate --from traces --trace-days 3 --max-samples 50 --no-wait --no-prompt` | Same as (a). |
| (c) Existing `azure.eval.yaml` | Skip `generate`. | Tell the user: *"Using existing `azure.eval.yaml`. Create the eval with `azd ai eval create` if needed, then run `azd ai eval run start` when ready."* |
| (d) No / later | Skip. | Tell the user: *"You can run `azd ai eval generate` (and then `eval run start` after setup) anytime."* |

Other useful flags on `generate`: `--dataset` or `--evaluator` to generate only that artifact, `--generation-model <name>` to choose the model used for generation, `--dataset-name <name>` and `--evaluator-name <name>` to name the artifacts, and `--output-dir <path>` to choose the download directory.

Then proceed to Step 7. See [After Deployment — Auto-Generate Evaluation Suite](#after-deployment--auto-generate-evaluation-suite) for run/refresh details. Run `azd ai eval run start` only after the user explicitly agrees.

### Step 7 -- Hand off

- Send more messages -> [invoke](../invoke/invoke.md)
- Evaluate / optimize -> [observe](../observe/observe.md)
- Diagnose failures -> [troubleshoot](../troubleshoot/troubleshoot.md)
- Search traces / latency -> [trace](../trace/trace.md)

## `.agentignore`

`azd ai agent init` writes a default `<service-dir>/.agentignore` for code deploy projects (gitignore syntax) that excludes tooling files, secrets, language artifacts, and Docker files from the deploy ZIP. Only the root file is read; use `!path` to force-include.

## Endpoint or card edits -- no new version

When only `agentEndpoint:` or `agentCard:` changed in the `azure.yaml` service block:

```bash
azd ai agent endpoint update          # patch in place
azd ai agent endpoint update --force  # skip confirmation for breaking changes
```

Idempotent.

## Multi-environment deploys

```bash
azd env list
azd env select prod
azd deploy --no-prompt
```

Each env has its own `AGENT_<SVC>_*` vars.

## Common failure modes -- Hosted

| Error | Fix |
|-------|-----|
| `missing_project_endpoint` | Run `azd env set AZURE_AI_PROJECT_ENDPOINT <url>`, or run `azd provision` for a new project. |
| `invalid_agent_manifest` | `azd ai agent doctor`; fix the named field. |
| `invalid_connection` | Inspect with `azd ai connection show <name>`. |
| Docker daemon not running | You are on the container path. Add/fix `codeConfiguration` and retry code deploy. Only install Docker or try remote image build if you specifically need container deploy. |
| ACR push 403 | Foundry project RBAC is missing `AcrPush` for your identity. Consider switching to code deploy to avoid ACR entirely. |
| `[ImageError] Container registry authentication failed` | The Foundry project managed identity lacks **AcrPull**, or **Container Registry Repository Reader** on an ABAC registry. Grant it before retrying. |
| `container registry endpoint not found` | ACR is not configured. Use `azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT <url>`, or switch to code deploy. |
| Agent version poll times out | Build still running; retry `azd ai agent show` after a minute. |
| `session_not_ready` (424) | Cold start or readiness delay. Wait 15-30 seconds and retry. If persistent, use `1` CPU / `2Gi` memory minimum, verify the model deployment name, capability host, and agent identity role. |
| `invalid value "json" for --output` from `azd ai agent invoke` | Invoke supports only `default` and `raw` currently. Retry without `--output json`. |
| `could not resolve agent service in azd project: no azure.ai.agent service named '<agentName>' found in azure.yaml` from `azd ai agent invoke` | Name mismatch. Use the service name, update the `azure.yaml` service block, or use `--agent-endpoint` when invoking outside the project. |
| `subscription quota exceeded` | Ask user to request quota; do not auto-retry. |
| Bicep deploy errors | Forward `error.details[]` verbatim to the user. |
| `RoleAssignmentUpdateNotPermitted` during provision | A role assignment already exists but conflicts. Check for existing role assignments with `az role assignment list --scope <resource-scope>`. The provision may have succeeded for all resources except RBAC — verify with `azd ai project show` and manually assign the `Cognitive Services User` role to the agent identity if needed. |
| `eval generate` needs agent instructions | Retry with `--agent-instruction "<agent purpose>"` (Step 6 option (a)). |

For deeper logs, see [troubleshoot](../troubleshoot/troubleshoot.md).

## Workflow -- Managed Harness Agent (azd)

A Microsoft Foundry Managed Harness Agent is a declarative Prompt Agent configuration that this workflow deploys with azd. Read [create-managed-harness](../create/create-managed-harness.md) before creating or editing it.

### Step 1: Resolve and validate

Inside the azd project, select the service and verify that it is a Prompt Agent
using either recognized Copilot harness discriminator. New authoring uses:

```yaml
host: azure.ai.agent
kind: prompt
harness:
  type: microsoft_copilot_preview
```

Existing services may use legacy `github_copilot_preview`; preserve the
authored harness and toolset discriminator family. Reject Hosted-only
code/container fields. Do not convert an ordinary Prompt or Hosted Agent in
place.

Resolve the active environment:

```bash
azd env get-values
azd ai project show --output json
azd ai agent show --output json
```

If the Agent is not deployed, continue to provisioning. If active/deployed, skip provisioning unless infrastructure changed.

### Step 2: Provision when required

Run `azd provision --no-prompt` only for a new Foundry project, a new model deployment, or another real infrastructure change. If no project is configured and the user did not select a new or existing project, stop and ask.

A Managed Harness Agent does not require Hosted Agent source packaging, Docker, ACR, runtime, protocol, or container configuration.

### Step 3: Deploy

```bash
azd deploy <service-name> --no-prompt
```

Deployment reads the Prompt Agent definition from `azure.yaml` and creates a new immutable version. It must not package source or build a container.

### Step 4: Verify and invoke

```bash
azd ai agent show --output json
```

Verify the version is active/deployed and the published definition retains:

- `kind: prompt`
- New definitions use `harness.type: microsoft_copilot_preview`.
- Existing definitions retain their authored Microsoft or legacy GitHub harness/toolset discriminator family.
- Requested direct tools
- Exact versioned Toolbox MCP endpoint and matching short `project_connection_id`, when explicitly configured
- Versioned Skill references, when explicitly configured

A successful deploy that drops the harness is a failure.
A redeploy that silently changes an existing Copilot harness or toolset discriminator family is also a failure.

Run one remote smoke invocation:

```bash
azd ai agent invoke <service-name> "hello, are you up?"
```

Follow the Managed Harness Agent branch in [invoke](../invoke/invoke.md). Do not use Hosted sessions/files/monitor and do not start evaluation generation in Phase 1.

### Step 5: Hand off

Show Agent name, version, project, model, harness, tools, optional Toolbox, deployment status, and smoke-test status.

## Common failure modes -- Managed Harness Agent

| Error | Fix |
|---|---|
| Deploy packages code/container | Remove Hosted-only fields and verify `kind: prompt` |
| Published definition lacks harness | Fix `harness.type`, verify the extension version, and redeploy |
| Tool shape rejected | Read the matching Managed Harness Agent tool reference and preserve REST field names |
| Connection missing | Use a user-supplied/existing configured connection, or create it only on explicit request |
| Toolbox MCP returns `401` | Verify the MCP tool has a matching `UserEntraToken` project connection with audience `https://ai.azure.com` and target equal to the exact versioned Toolbox endpoint |

## Workflow -- Voice Agent (azd)

Follow [Voice Agent deployment](references/voice-deploy.md) for GPT-Live Voice, Prompt Voice, and Hosted Voice prerequisites, deployment order, and two-stage verification.

## Workflow -- Prompt agent (MCP)

Ordinary Prompt Agents are not containerized -- they are a model + instructions + optional tools, created through the Foundry MCP server. Do not use this branch for a Managed Harness Agent.

### MCP tools

| Tool | Purpose |
|------|---------|
| `agent_definition_schema_get` | Get the schema (`schemaType: "prompt"`). |
| `agent_update` | Create or update; supports `isCloneRequest` + `cloneTargetAgentName`. |
| `agent_get` | List or fetch one. |
| `agent_delete` | Delete an agent. |

### Steps

1. **Collect config** -- resolve endpoint from `azd env get-values` or ask. Then ask for **agent name**, **model deployment** (e.g. `gpt-4o`), and optional **instructions**, **temperature**, **tools**.
2. **Get schema** -- `agent_definition_schema_get` with `schemaType: "prompt"`.
3. **Create** -- `agent_update` with `{"kind": "prompt", "model": "<deployment>", "instructions": "...", "temperature": 0.7}`.
4. **Smoke test** -- follow [invoke](../invoke/invoke.md).
5. **Auto-generate evaluation suite** -- see [Step 5: Auto-Generate Evaluation Suite (Prompt)](#step-5-auto-generate-evaluation-suite-prompt-mandatory--runs-automatically) below.
6. **Hand off** -- evaluate via [observe](../observe/observe.md); clone via `agent_update` + `isCloneRequest`; delete via `agent_delete`.

### Step 5: Auto-Generate Evaluation Suite (Prompt) (MANDATORY — RUNS AUTOMATICALLY)

> ⚠️ **Pre-summary gate.** If you are about to write a deployment summary or Playground link and Step 5 has not run, you are violating this skill. Run Step 5 first.

This step runs automatically after deploy. Ask the user which source to use and start it right after deploy succeeds — with `--no-wait`, `generate` returns in seconds and generation runs server-side, so it overlaps with invoke/test steps and finishes faster overall.

> *"Your agent is deployed. Want me to set up an evaluation suite now? (a) Yes — current agent instructions (synthetic Q&A), (b) Yes — historical traces (last 3 days), (c) Yes — use existing `azure.eval.yaml`, (d) No / later."*

| Choice | Command | What's next |
|---|---|---|
| (a) Agent instructions | `azd ai eval generate --from agent --agent-instruction "<agent purpose>" --no-wait --no-prompt` | Generation runs server-side. Tell the user: *"Suite submitted. Collect the artifacts, configure and create the eval, then run `azd ai eval run start` whenever you're ready."* |
| (b) Historical traces | `azd ai eval generate --from traces --trace-days 3 --max-samples 50 --no-wait --no-prompt` | Same as (a). |
| (c) Existing `azure.eval.yaml` | Skip `generate`. | Tell the user: *"Using existing `azure.eval.yaml`. Create the eval with `azd ai eval create` if needed, then run `azd ai eval run start` when ready."* |
| (d) No / later | Skip. | Tell the user: *"You can run `azd ai eval generate` (and then `eval run start` after setup) anytime."* |

## Common failure modes -- Prompt

| Error | Fix |
|-------|-----|
| Schema fetch failed | Verify endpoint format: `https://<resource>.services.ai.azure.com/api/projects/<project>`. |
| Agent creation failed | Use `agent_definition_schema_get` to verify the definition. |
| Permission denied | User needs `Foundry User` role on the project. |
| Model not found | Deploy the model first via [models/deploy-model](../../models/deploy-model/SKILL.md). |

## Display agent details

After a successful deploy, show the agent's name, version, status, and endpoints in a table. Include a Playground link:

```
https://ai.azure.com/nextgen/r/{encodedSubId},{resourceGroup},,{accountName},{projectName}/build/agents/{agentName}/build?version={agentVersion}
```

`encodedSubId` is the subscription GUID as URL-safe base64 (no `=`):

```bash
python -c "import base64,uuid;print(base64.urlsafe_b64encode(uuid.UUID('<SUBSCRIPTION_ID>').bytes).rstrip(b'=').decode())"
```

For hosted agents, `playground_url` is in `azd ai agent show --output json`.

## After Deployment — Auto-Generate Evaluation Suite

> Reference for Step 6 options (a) and (b) — start `generate` right after deploy so its server-side generation overlaps with invoke/test steps and finishes faster. Options (c) and (d) skip `generate` and go straight to section 3 (run) or stop.

### 1. Inspect existing azure.eval.yaml

Check the project's `evals/azure.eval.yaml` (or the selected `--path`):

- **Exists and matches the selected agent** → skip `generate`; go to step 3 (run).
- **Missing or stale** → continue to step 2.

### 2. Submit generation (asynchronous, server-side)

Run `azd ai eval generate --no-wait` with the user's chosen flags (see the Step 6 table). The command:

- Submits dataset + evaluator generation jobs server-side.
- Returns in seconds.
- Returns separate dataset and evaluator generation job IDs.

No skill-side polling or terminal handle is needed. When the jobs finish, collect each artifact with `azd ai eval job show <job-id> --dataset` or `--evaluator`, then configure and run the eval (section 3).

If the user wants to wait synchronously instead (e.g., to inspect the artifacts before running), drop `--no-wait` — `generate` will then submit the jobs, wait for completion, and download review artifacts before returning (typically several minutes).

### 3. Run the suite

For newly generated artifacts, first configure the eval with `azd ai eval init --source dataset --dataset "<generated-dataset-path>" --evaluator "<generated-evaluator-reference>"`.

```bash
azd ai eval create
azd ai eval run start
```

Use `azd ai eval run show --output json > results.json` to inspect run details, or `azd ai eval run list` to see history.

### 4. Refresh datasets/evaluators (later)

When local dataset or evaluator files change, run `azd ai eval dataset update <name> --from-file <dataset.jsonl>` or `azd ai eval evaluator update <name> --from-file <evaluator.json>` to upload new versions. Update the version references in `azure.eval.yaml` and run `azd ai eval create`.

### 5. Prompt User

*"Your agent is deployed and evaluation suite generation is **submitted server-side** (still running, takes several minutes). Would you like to run an evaluation now? First collect the generated artifacts, configure and create the eval, then run `azd ai eval run start`."*

- **Yes** → collect the generation jobs (section 2), then configure, create, and run the eval (section 3), then follow the [observe skill](../observe/observe.md) to interpret results.
- **No** → stop. The user can return later via `azd ai eval job show` to collect the artifacts, then set up and run the eval.
- **Production trace analysis** → follow the [trace skill](../trace/trace.md).

## Non-Interactive / YOLO Mode

> Even in `--no-prompt` / `--yolo` mode: if the user named a foundry project or asked to create one, go ahead; otherwise stop and ask before provisioning.

- Hosted: always pass `--no-prompt`.
- Prompt: all required values (project endpoint, agent name, model deployment) must come from the user message or `azd env get-values`; missing values should fail loudly rather than prompt.
