# Deploy a Foundry Agent

Provision Azure resources when needed, deploy the agent, and smoke-test it.

For **hosted agents** (custom container or code), use `azd deploy`. Prefer **direct code deployment through azd** (no Docker/ACR required): the agent's `azure.yaml` service block must contain `codeConfiguration:`, so `azd deploy` will use direct code deployment and zip the source and let Foundry build it. Use container/ACR deployment only when the agent truly needs a Dockerfile, custom system packages, or a pre-built image.

For **prompt agents** (LLM + instructions, no custom code), use the Foundry MCP `agent_update` tool.

## Quick Reference

| Property | Value |
|----------|-------|
| Hosted (recommended) | `azd provision` when needed, direct code deployment via `azd deploy` (`codeConfiguration` present), `azd ai agent invoke` |
| Hosted (container) | `azd provision` when needed, container/ACR deployment via `azd deploy` (requires Docker/Podman + ACR, no `codeConfiguration:` in the `azure.yaml` service block) |
| Prompt MCP | `agent_definition_schema_get`, `agent_update`, `agent_get`, `agent_delete` |
| Versioning | Each successful `azd deploy` creates an immutable agent version |
| Endpoint-only patch | `azd ai agent endpoint update` (no new version) |
| Local dev | [create-hosted](../create/create-hosted.md), [local-run](../create/references/local-run.md) |

## Hosted vs Prompt

- Shipping Python / .NET code -> **Hosted** (azd workflow below).
- Updating only model / instructions / tools -> **Prompt** (MCP workflow below).

## Deployment Method Selection -- Hosted agents

Before running `azd deploy`, inspect the agent's service block in `azure.yaml`.

| Service block state | Deployment path |
|------------------|-----------------|
| `codeConfiguration:` present | **Direct code deploy** through `azd deploy`; no Docker/ACR build. |
| No `codeConfiguration:` | **Container/ACR deploy** through `azd deploy`; builds/pushes an image or uses a pre-built `image:`. |

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

Default to direct code for standard hosted-agent code. If `azd deploy` prints `Packaging container` for an agent that does not need container-specific behavior, add or fix `codeConfiguration` and retry. Use the container path when the agent depends on Dockerfile behavior, system packages, or a pre-built image.

## Workflow -- Hosted agent (azd)

> Prerequisite: project scaffolded with `azd ai agent init`. If not, start at [create-hosted](../create/create-hosted.md).

### Step 1 -- Resolve azd environment

If the user provided an existing project endpoint, project ARM ID, or model deployment, set those values before deploy. Then verify the azd environment with `azd env get-values`.

```bash
azd env set AZURE_AI_PROJECT_ENDPOINT "<project-endpoint>"
azd env set AZURE_AI_PROJECT_ID "<project-arm-id>"
azd env set AZURE_AI_MODEL_DEPLOYMENT_NAME "<model-deployment-name>"
azd env get-values
```

Run:

```bash
azd ai project show --output json
azd ai agent show --output json
```

Branch on output: `not_deployed` -> Step 2. `active` / `deployed` -> redeploy (skip Step 2, go to Step 3). If `azd ai project show` fails with `missing_project_endpoint`, do Step 2 first -- `azd provision` will create the project.

> **Important:** Before deploy, also make sure the agent's `azure.yaml` service block and the azd environment are aligned with the user's provided configuration values.

### Step 2 -- Provision Azure resources (one-time per env)

> 🚦 **Project-selection gate.** If no foundry project endpoint is configured (not in the message, `azd env`, or `.env`) and the user hasn't asked to create one, stop and ask them to pick an existing foundry project or confirm creating a new one — don't silently select.

Skip `azd provision` when the user gave you an existing `AZURE_AI_PROJECT_ENDPOINT` or `FOUNDRY_PROJECT_ENDPOINT` and the workflow only needs to deploy the agent into that project.

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

This is a core `azd` command. Skip provision when the user gave you an existing `AZURE_AI_PROJECT_ENDPOINT` via `azd env set` -- the extension uses the existing project as-is.

After provision completes for a new project, run `azd env get-values` and set missing required azd env values, especially `AZURE_AI_PROJECT_ID` and `AZURE_TENANT_ID`, before local run or the first `azd deploy`.

### Step 3 -- Deploy the agent

```bash
azd deploy --no-prompt
# Multi-service:
azd deploy <service-name> --no-prompt
```

What deploy does:

- Reads the agent's `azure.yaml` service block, packages the agent, uploads it, and registers a new immutable version.
- **Direct code deploy** (`codeConfiguration` present): zips source, excludes `.agentignore`, and lets Foundry build the runtime image.
- **Container deploy** (no code configuration): builds the `Dockerfile`, pushes to the project's ACR, registers the version. When the service block has `image:` set, `azd` reuses the pre-built image.

After deploy, azd writes `AGENT_<SVC>_NAME`, `AGENT_<SVC>_VERSION`, and `AGENT_<SVC>_<PROTO>_ENDPOINT` (one per protocol) into the active env.

Re-deploying an identical build still creates a new version; `azd` prints `Agent version <n> is already active.` and skips the poll.

If deploy reports `Done` for the service and then fails only in `postdeploy` with `Agent <service-name> with version <n> not found`, the `azure.yaml` service key and the service's `name:` were mismatched. Rename the `azure.yaml services` key to the deployed agent name and rerun `azd deploy --no-prompt`; do not switch deployment method.

### Step 4 -- Verify and invoke

```bash
azd ai agent show --output json
```

Expect `"status": "active"` (or `"deployed"`) and an `agent_endpoints` map. Smoke-test:

```bash
azd ai agent invoke "hello, are you up?"
```

> Remote invocation can incur model usage charges. Run it only as part of the requested deployment or test.

Run one remote invocation only unless the user explicitly asked to test multi-turn/session behavior. A single successful response is enough for the deployment smoke test. Anything other than a completed/successful response -> run `azd ai agent doctor --output json`, then follow [troubleshoot](../troubleshoot/troubleshoot.md).

### Step 5: Auto-Generate Evaluation Suite (MANDATORY — RUNS AUTOMATICALLY)

> ⚠️ **Pre-summary gate.** If you are about to write a deployment summary or Playground link and Step 5 has not run, you are violating this skill. Run Step 5 first.

This step runs automatically after deploy. Ask the user which source to use and start it right after deploy succeeds — with `--no-wait`, `generate` returns in seconds and generation runs server-side, so it overlaps with invoke/test steps and finishes faster overall.

> *"Your agent is deployed. Want me to set up an evaluation suite now? (a) Yes — current agent instructions (synthetic Q&A), (b) Yes — historical traces (last 3 days), (c) Yes — use existing `eval.yaml`, (d) No / later."*

| Choice | Command | What's next |
|---|---|---|
| (a) Agent instructions | `azd ai agent eval generate --gen-instruction "<agent purpose>" --no-wait --no-prompt` — `--gen-instruction` is required (hosted agents don't auto-derive it); use the service's `description:` in `azure.yaml`. | Generation runs server-side. Tell the user: *"Suite submitted. Run `azd ai agent eval run` whenever you're ready — it'll finalize `eval.yaml` and execute the eval in one step."* |
| (b) Historical traces | `azd ai agent eval generate --trace-days 3 --max-samples 50 --no-wait --no-prompt` | Same as (a). |
| (c) Existing `eval.yaml` | Skip `generate`. | Tell the user: *"Using existing `eval.yaml`. Run `azd ai agent eval run` when ready."* |
| (d) No / later | Skip. | Tell the user: *"You can run `azd ai agent eval generate` (and then `eval run`) anytime."* |

Other useful flags on `generate`: `--dataset <path-or-name>` to reuse an existing dataset instead of generating one, `--evaluator <name>` (repeatable) to pin built-in or custom evaluators, `--eval-model <name>` to choose the model used for generation and evaluation, `--reset-defaults` to overwrite an existing eval config, `--name <suite-name>` and `--out-file <path>` (default `eval.yaml`).

Then proceed to Step 6. See [After Deployment — Auto-Generate Evaluation Suite](#after-deployment--auto-generate-evaluation-suite) for run/refresh details.

### Step 6 -- Hand off

- Send more messages -> [invoke](../invoke/invoke.md)
- Evaluate / optimize -> [observe](../observe/observe.md)
- Diagnose failures -> [troubleshoot](../troubleshoot/troubleshoot.md)
- Search traces / latency -> [trace](../trace/trace.md)

## `.agentignore`

`azd ai agent init` writes a default `<service-dir>/.agentignore` for code-deploy projects (gitignore syntax) that excludes tooling files, secrets, language artifacts, and Docker files from the deploy ZIP. Only the root file is read; use `!path` to force-include.

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
| Docker daemon not running | You are on the container path. Add/fix `codeConfiguration` and retry direct code deploy. Only install Docker or try remote image build if you specifically need container deploy. |
| ACR push 403 | Foundry project RBAC is missing `AcrPush` for your identity. Consider switching to direct code deployment to avoid ACR entirely. |
| `container registry endpoint not found` | ACR is not configured. Use `azd env set AZURE_CONTAINER_REGISTRY_ENDPOINT <url>`, or switch to direct code deployment. |
| Agent version poll times out | Build still running; retry `azd ai agent show` after a minute. |
| `session_not_ready` (424) | Cold start or readiness delay. Wait 15-30 seconds and retry. If persistent, use `1` CPU / `2Gi` memory minimum, verify the model deployment name, capability host, and agent identity role. |
| `invalid value "json" for --output` from `azd ai agent invoke` | Invoke supports only `default` and `raw` currently. Retry without `--output json`. |
| `could not resolve agent service in azd project: no azure.ai.agent service named '<agentName>' found in azure.yaml` from `azd ai agent invoke` | Name mismatch. Use the service name, update the `azure.yaml` service block, or use `--agent-endpoint` when invoking outside the project. |
| `subscription quota exceeded` | Ask user to request quota; do not auto-retry. |
| Bicep deploy errors | Forward `error.details[]` verbatim to the user. |
| `RoleAssignmentUpdateNotPermitted` during provision | A role assignment already exists but conflicts. Check for existing role assignments with `az role assignment list --scope <resource-scope>`. The provision may have succeeded for all resources except RBAC — verify with `azd ai project show` and manually assign the `Cognitive Services User` role to the agent identity if needed. |
| `eval generate`: `one of --gen-instruction ... is required` | Retry with `--gen-instruction "<agent purpose>"` (Step 5 option (a)). |
| `unknown command "init" for "azd ai agent eval"` | Command was renamed: use `azd ai agent eval generate` (requires azd CLI with `azure.ai.agents` extension up to date). |

For deeper logs, see [troubleshoot](../troubleshoot/troubleshoot.md).

## Workflow -- Prompt agent (MCP)

Prompt agents are not containerized -- they are a model + instructions + optional tools, created through the Foundry MCP server. Use when the user explicitly wants a prompt agent.

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

> *"Your agent is deployed. Want me to set up an evaluation suite now? (a) Yes — current agent instructions (synthetic Q&A), (b) Yes — historical traces (last 3 days), (c) Yes — use existing `eval.yaml`, (d) No / later."*

| Choice | Command | What's next |
|---|---|---|
| (a) Agent instructions | `azd ai agent eval generate --gen-instruction "<agent purpose>" --no-wait --no-prompt` | Generation runs server-side. Tell the user: *"Suite submitted. Run `azd ai agent eval run` whenever you're ready — it'll finalize `eval.yaml` and execute the eval in one step."* |
| (b) Historical traces | `azd ai agent eval generate --trace-days 3 --max-samples 50 --no-wait --no-prompt` | Same as (a). |
| (c) Existing `eval.yaml` | Skip `generate`. | Tell the user: *"Using existing `eval.yaml`. Run `azd ai agent eval run` when ready."* |
| (d) No / later | Skip. | Tell the user: *"You can run `azd ai agent eval generate` (and then `eval run`) anytime."* |

## Common failure modes -- Prompt

| Error | Fix |
|-------|-----|
| Schema fetch failed | Verify endpoint format: `https://<resource>.services.ai.azure.com/api/projects/<project>`. |
| Agent creation failed | Use `agent_definition_schema_get` to verify the definition. |
| Permission denied | User needs `Foundry User` role on the project. |
| Model not found | Deploy the model first via [models/deploy-model](../../models/deploy-model/SKILL.md). |

## Display agent details (both flows)

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

> Reference for Step 5 options (a) and (b) — start `generate` right after deploy so its server-side generation overlaps with invoke/test steps and finishes faster. Options (c) and (d) skip `generate` and go straight to section 3 (run) or stop.

### 1. Inspect existing eval.yaml

Check the selected agent root for `eval.yaml`:

- **Exists and matches the selected agent** → skip `generate`; go to step 3 (run).
- **Missing or stale** → continue to step 2.

### 2. Submit generation (asynchronous, server-side)

Run `azd ai agent eval generate --no-wait` with the user's chosen flags (see the Step 5 table). The command:

- Submits dataset + evaluator generation jobs server-side.
- Returns in seconds.
- Writes pending operation IDs to local azd state.
- Writes a placeholder `eval.yaml` at the agent root (override with `--out-file <path>`).

No skill-side polling, terminal handle, or later-turn re-check is needed. `azd ai agent eval run` (section 3) automatically resumes a pending generation, downloads artifacts, finalizes `eval.yaml`, then runs the eval.

If the user wants to wait synchronously instead (e.g., to inspect `eval.yaml` before running), drop `--no-wait` — `generate` will then submit the jobs, wait for completion, download review artifacts, and write the finalized `eval.yaml` before returning (typically several minutes).

### 3. Run the suite

```bash
azd ai agent eval run
```

Use `azd ai agent eval show -O results.json` to inspect run details, or `azd ai agent eval list` to see history.

### 4. Refresh datasets/evaluators (later)

When local files under `datasets/<suite>/` or `evaluators/<suite>/` change, run `azd ai agent eval update --dataset-only` or `--evaluator-only` to upload new versions. azd bumps the `version` fields in `eval.yaml`.

### 5. Prompt User

*"Your agent is deployed and evaluation suite generation is **submitted server-side** (still running, takes several minutes). Would you like to run an evaluation now? `azd ai agent eval run` will wait for generation to finish, then execute the eval."*

- **Yes** → run `azd ai agent eval run` (this resumes the pending generation, then runs the eval — may take several minutes the first time), then follow the [observe skill](../observe/observe.md) to interpret results.
- **No** → stop. The user can return later via `azd ai agent eval run` — it will pick up wherever the pending generation is.
- **Production trace analysis** → follow the [trace skill](../trace/trace.md).

## Non-Interactive / YOLO Mode

> Even in `--no-prompt` / `--yolo` mode: if the user named a foundry project or asked to create one, go ahead; otherwise stop and ask before provisioning.

- Hosted: always pass `--no-prompt`.
- Prompt: all required values (project endpoint, agent name, model deployment) must come from the user message or `azd env get-values`; missing values should fail loudly rather than prompt.
