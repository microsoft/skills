---
name: microsoft-foundry
description: "Deploy, evaluate, fine-tune, and manage Foundry agents end-to-end: Docker build, ACR push, hosted/prompt agent create, container start, batch eval, continuous eval, prompt optimizer, Agent Optimizer scaffold, agent.yaml, dataset curation from traces, model fine-tuning (SFT/DPO/RFT). USE FOR: deploy agent, hosted agent, create agent, add tool to agent, invoke agent, evaluate agent, continuous eval, continuous monitoring, optimize prompt, improve prompt, optimize agent instructions, deploy model, Foundry project, RBAC, role assignment, permissions, quota, capacity, region, troubleshoot agent, deployment failure, AI Services, create Foundry resource, provision, knowledge index, agent monitoring, customize deployment, onboard, availability, fine-tune, SFT, DPO, RFT, training-data, grader, distillation, fine-tuned model, large file upload. DO NOT USE FOR: Azure Functions, App Service, general Azure deploy (use azure-deploy), general Azure prep (use azure-prepare)."
license: MIT
metadata:
  author: Microsoft
  version: "1.1.20"
---

# Microsoft Foundry Skill

This skill helps developers work with Microsoft Foundry resources, covering model discovery and deployment, complete dev lifecycle of AI agent, evaluation workflows, and troubleshooting.

## Pre-Execution Requirements

> **MANDATORY: Before executing ANY workflow, you MUST first call the Azure MCP `foundry` tool and inspect the available Foundry MCP tools and related parameters.** Treat this initial `foundry` call as a discovery/help step. For this skill, Azure MCP `foundry` is the required entry point for Foundry-related MCP operations.

## Sub-Skills

> **MANDATORY: Before executing ANY workflow-specific steps, you MUST read the corresponding sub-skill document.** Do not call workflow-specific MCP tools for a workflow without reading its skill document. This applies even if you already know the MCP tool parameters — the skill document contains required workflow steps, pre-checks, and validation logic that must be followed. This rule applies on every new user message that triggers a different workflow, even if the skill is already loaded.

This skill includes specialized sub-skills for specific workflows. **Use these instead of the main skill when they match your task:**

| Sub-Skill | When to Use | Reference |
|-----------|-------------|-----------|
| **deploy** | Containerize, build, push to ACR, create/update/clone agent deployments | [deploy](foundry-agent/deploy/deploy.md) |
| **invoke** | Send messages to an agent, single or multi-turn conversations | [invoke](foundry-agent/invoke/invoke.md) |
| **invocations-ws** | Build, deploy, and connect to hosted agents that speak the `invocations_ws` duplex WebSocket protocol — voice agents, real-time streams, and signaling for out-of-band media transports. | [invocations-ws](foundry-agent/invocations-ws/invocations-ws.md) |
| **observe** | Evaluate agent quality, run batch evals, analyze failures, optimize prompts, improve agent instructions, compare versions, set up CI/CD monitoring, and enable continuous production evaluation | [observe](foundry-agent/observe/observe.md) |
| **trace** | Query traces, analyze latency/failures, correlate eval results to specific responses via App Insights `customEvents` | [trace](foundry-agent/trace/trace.md) |
| **troubleshoot** | View hosted agent logs, query telemetry, diagnose failures | [troubleshoot](foundry-agent/troubleshoot/troubleshoot.md) |
| **create** | Create new hosted agent applications. Supports Microsoft Agent Framework, LangGraph, or custom frameworks in Python or C#, across `responses`, `invocations`, or `invocations_ws` protocols. | [create](foundry-agent/create/create-hosted.md) |
| **agent-optimizer** | Make existing Python hosted-agent code optimization-ready, configure eval.yaml, run Agent Optimizer jobs, apply candidates locally, and deploy through azd after review. | [agent-optimizer](foundry-agent/agent-optimizer/agent-optimizer.md) |
| **eval-datasets** | Harvest production traces into evaluation datasets, manage dataset versions and splits, track evaluation metrics over time, detect regressions, and maintain full lineage from trace to deployment. Use for: create dataset from traces, dataset versioning, evaluation trending, regression detection, dataset comparison, eval lineage. | [eval-datasets](foundry-agent/eval-datasets/eval-datasets.md) |
| **project/create** | Creating a new Azure AI Foundry project for hosting agents and models. Use when onboarding to Foundry or setting up new infrastructure. | [project/create/create-foundry-project.md](project/create/create-foundry-project.md) |
| **resource/create** | Creating Azure AI Services multi-service resource (Foundry resource) using Azure CLI. Use when manually provisioning AI Services resources with granular control. | [resource/create/create-foundry-resource.md](resource/create/create-foundry-resource.md) |
| **private-network** | Answer questions about Foundry network isolation **and** deploy Foundry with VNet isolation (BYO VNet, Managed VNet, hybrid). Covers architecture concepts, template selection, deployment, and post-deployment validation. | [resource/private-network/private-network.md](resource/private-network/private-network.md) |
| **models/deploy-model** | Unified model deployment with intelligent routing. Handles quick preset deployments, fully customized deployments (version/SKU/capacity/RAI), and capacity discovery across regions. Routes to sub-skills: `preset` (quick deploy), `customize` (full control), `capacity` (find availability). | [models/deploy-model/SKILL.md](models/deploy-model/SKILL.md) |
| **quota** | Managing quotas and capacity for Microsoft Foundry resources. Use when checking quota usage, troubleshooting deployment failures due to insufficient quota, requesting quota increases, or planning capacity. | [quota/quota.md](quota/quota.md) |
| **rbac** | Managing RBAC permissions, role assignments, managed identities, and service principals for Microsoft Foundry resources. Use for access control, auditing permissions, and CI/CD setup. | [rbac/rbac.md](rbac/rbac.md) |
| **finetuning** | Fine-tune models on Azure AI Foundry — SFT distillation, DPO preference optimization, RFT with graders and tool calling. Dataset preparation, grader calibration, training, checkpoint selection, deployment, evaluation. Use for: fine-tune, SFT, DPO, RFT, training data, grader, distillation, fine-tuned model, large file upload. | [finetuning/SKILL.md](finetuning/SKILL.md) |

> 💡 **Tip:** For a complete onboarding flow: `project/create` (public) or `private-network` (VNet isolation) → `models/deploy-model` → agent workflows (`create` → `deploy` → `invoke`).

> 💡 **Fine-Tuning:** Use `finetuning` for all model customization — SFT distillation, DPO preference optimization, and RFT with graders. Includes quickstart, grader calibration, and training curve analysis.

> 💡 **Model Deployment:** Use `models/deploy-model` for all deployment scenarios — it intelligently routes between quick preset deployment, customized deployment with full control, and capacity discovery across regions.

> 💡 **Prompt Optimization:** For requests like "optimize my prompt" or "improve my agent instructions," load [observe](foundry-agent/observe/observe.md) and use the `prompt_optimize` MCP tool through that eval-driven workflow.

## Infrastructure Lifecycle

Match user intent to the correct infrastructure workflow.

| User Intent | Workflow |
|-------------|---------|
| "Create Foundry" / "Set up Foundry" (ambiguous) | Use `AskUserQuestion`: (a) just an AI Services resource, (b) a project with public access, or (c) a project with network isolation? Route: (a) → [resource/create](resource/create/create-foundry-resource.md), (b) → [project/create](project/create/create-foundry-project.md), (c) → [private-network](resource/private-network/private-network.md) |
| Set up Foundry with VNet isolation | [private-network](resource/private-network/private-network.md) |
| Create a Foundry project (public) | [project/create](project/create/create-foundry-project.md) |
| Create a bare Foundry resource | [resource/create](resource/create/create-foundry-resource.md) |

## Agent Development Lifecycle

Match user intent to the correct agent workflow. Read each sub-skill in order before executing.

| User Intent | Workflow (read in order) |
|-------------|------------------------|
| Create a new agent from scratch | [create](foundry-agent/create/create-hosted.md) → [deploy](foundry-agent/deploy/deploy.md) → [invoke](foundry-agent/invoke/invoke.md) |
| Optimize existing Python hosted agent | [agent-optimizer](foundry-agent/agent-optimizer/agent-optimizer.md) → scaffold/review → eval.yaml → optimize → apply candidate → deploy → invoke |
| Deploy an agent (code already exists) | deploy (includes eval-suite setup) → invoke → observe (evaluate/optimize) |
| Update/redeploy an agent after code changes | deploy (includes eval-suite setup) → invoke → observe (evaluate/optimize) |
| Invoke/test/chat with an agent | invoke |
| Optimize / improve agent prompt or instructions | observe (Step 4: Optimize) |
| Evaluate and optimize agent (full loop) | observe |
| Enable continuous evaluation monitoring | observe (Step 6: CI/CD & Monitoring) |
| Troubleshoot an agent issue | invoke → troubleshoot |
| Fix a broken agent (troubleshoot + redeploy) | invoke → troubleshoot → apply fixes → deploy → invoke |

## Agent: .foundry Workspace Standard

Every agent source folder can keep Foundry-specific cache and overlay state under `.foundry/`:

```text
<agent-root>/
  .foundry/
    agent-metadata.yaml
    agent-metadata.prod.yaml
    suites/
    datasets/
    evaluators/
    results/
```

- In azd projects, derive deployment context (project endpoint, agent name/version, ACR, App Insights) from `azure.yaml` plus `azd env get-values`; do not duplicate those values in metadata when azd already provides them.
- `agent-metadata.yaml` is the preferred local/dev overlay for non-azd values, remote Foundry suite references, local cache paths, result summaries, and explicit overrides. Optional sidecar files such as `agent-metadata.prod.yaml` can hold a single prod or CI-targeted overlay without mixing multiple environments in one file.
- `suites/`, `datasets/`, and `evaluators/` are local cache folders. Reuse them when they are current, and ask before refreshing or overwriting them.
- See [Agent Metadata Contract](references/agent-metadata-contract.md) for the canonical schema and workflow rules.

## Agent: Setup References

- [Standard Agent Setup](references/standard-agent-setup.md) - Standard capability-host setup with customer-managed data, search, and AI Services resources.

## Agent: Common Project Context Resolution

Agent skills should run this step **only when they need configuration values they don't already have**. If a value (for example, agent root, environment, project endpoint, or agent name) is already known from the user's message or a previous skill in the same session, skip resolution for that value.

### Step 1: Discover Agent Roots and azd Context

First check whether the workspace has `azure.yaml` with services using `host: azure.ai.agent`.

- **One azd agent service** -> use that service's `project` folder as the agent root.
- **Multiple azd agent services** -> require the user to choose the target service/folder.
- **No azd agent service** -> search the workspace for `.foundry/` folders that contain `agent-metadata.yaml` or `agent-metadata.<env>.yaml`.
  - **One match** -> use that agent root.
  - **Multiple matches** -> require the user to choose the target agent folder.
  - **No matches** -> for create/deploy workflows, seed a new `.foundry/` folder during setup; for all other workflows, stop and ask the user which agent source folder to initialize.

After selecting an agent root, keep all local `.foundry` cache inspection, source inspection, evaluator suggestions, dataset suggestions, and prompt-optimization context inside that folder only. Do **not** scan sibling agent folders unless the user explicitly switches roots.

### Step 2: Resolve Environment and Deployment Context

If `azure.yaml` is present, resolve the azd environment first:

1. Environment explicitly named by the user
2. `AZURE_ENV_NAME` from `azd env get-values`
3. azd default environment from `.azure/config.json`
4. Environment already selected earlier in the session

Run `azd env get-values` for the selected environment when project/deployment values are not already known. Prefer azd values for deployment context:

| azd Variable | Resolves To |
|-------------|-------------|
| `AZURE_AI_PROJECT_ENDPOINT` or `AZURE_AIPROJECT_ENDPOINT` | Project endpoint |
| `AGENT_<SERVICE>_NAME` | Agent name for the selected azd service |
| `AGENT_<SERVICE>_VERSION` | Agent version for the selected azd service |
| `AZURE_CONTAINER_REGISTRY_NAME` or `AZURE_CONTAINER_REGISTRY_ENDPOINT` | ACR registry name / image URL prefix |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights connection string for trace workflows |
| `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_AI_ACCOUNT_NAME`, `AZURE_AI_PROJECT_NAME` | Azure resource lookup and Playground links |

When azd supplies these values, use them as the source of truth and do not copy them into `.foundry/agent-metadata*.yaml` on metadata writes.

### Step 3: Select Metadata Overlay and Resolve Environment

Inside the selected agent root, choose the metadata file in this order:
1. Metadata filename or path explicitly provided by the user or workflow
2. If an explicit environment is already known and `.foundry/agent-metadata.<env>.yaml` exists, use that file
3. `.foundry/agent-metadata.yaml`
4. If multiple metadata files remain and no rule above selects one, prompt the user to choose

Read the selected metadata file and resolve any remaining environment choice in this order:
1. Environment explicitly named by the user
2. If the selected metadata file defines exactly one environment, use it
3. Environment already selected earlier in the session
4. `defaultEnvironment` from metadata

If the selected metadata file still contains multiple environments and none of the rules above selects one, prompt the user to choose. Keep the selected agent root, metadata file, environment, and whether context came from azd or metadata visible in every workflow summary.

If the selected environment exposes older `testSuites[]` metadata but not `evaluationSuites[]`, treat `testSuites[]` as the source for this session and normalize each entry in memory to the `evaluationSuites[]` shape before continuing. If the metadata is older still and only exposes legacy `testCases[]`, normalize that list the same way. Preserve dataset and evaluator fields, keep any existing `tags`, and map legacy `priority` to `tags.tier` only when `tags.tier` is missing: `P0` -> `smoke`, `P1` -> `regression`, `P2` -> `coverage`.

### Step 4: Resolve eval.yaml Local Evaluation Intent

If `eval.yaml` exists in the selected agent root, parse it before generating new suites:

- `agent.name` -> target agent candidate; verify it matches the selected azd/metadata agent before using it.
- `dataset_file` -> local seed dataset candidate.
- `evaluators[]` -> candidate Foundry evaluator names; verify with `evaluator_catalog_get` before treating them as remote evaluators.
- `name` -> local eval/suite candidate; verify remotely before persisting as `suiteName`.
- `options.eval_model`, `options.pass_threshold`, `max_samples`, `trace_days`, and `generation_instruction` -> setup defaults.

Treat `eval.yaml` as local evaluation intent, not proof that a Foundry suite exists. Persist synced suite/dataset/evaluator references to `.foundry` only after remote lookup or registration succeeds.

### Step 5: Resolve Common Configuration

Layer sources in this order:

1. Explicit user input and values already selected in the session
2. azd environment values for deployment context
3. `.foundry/agent-metadata*.yaml` overlay values and remote suite/cache references
4. `agent.yaml` and `eval.yaml` local source configuration
5. User prompts for anything still missing

If azd and metadata both provide the same value and they differ, stop and ask which source is authoritative. If they match, use the azd value and avoid rewriting the duplicate on future metadata writes.

| Effective Value | Preferred Source | Used By |
|-----------------|------------------|---------|
| Project endpoint | azd env | deploy, invoke, observe, trace, troubleshoot |
| Agent name/version | azd agent variables, then `agent.yaml` | invoke, observe, trace, troubleshoot |
| ACR | azd env | deploy |
| Evaluation suites and cache paths | `.foundry/agent-metadata*.yaml` | observe, eval-datasets |
| Local seed dataset/evaluator intent | `eval.yaml` | observe, eval-datasets |

### Step 6: Write Metadata Overlay (Create/Deploy/Observe Only)

On any metadata write (deploy, auto-setup, dataset refresh, or trace-to-dataset update), persist only non-derivable overlay/cache state in the selected metadata file:

- azd binding (`azd.environmentName`, `azd.service`) when useful for future resolution
- `evaluationSuites[]` with remote suite/dataset/evaluator references and local cache paths
- `lastEval`, result files, comparison summaries, or explicit non-azd overrides

Do not copy azd-owned deployment values into metadata when azd already provides them. If the selected file is a preferred single-environment file, rewrite only that one environment block. If the selected file is a legacy multi-environment file, rewrite only the selected environment block. Never copy or merge environments across sibling metadata files automatically. If the selected environment still uses older `testSuites[]` or legacy `testCases[]`, rewrite it to `evaluationSuites[]` and remove migrated `priority` fields from the rewritten entries.

### Step 7: Collect Missing Values

Use the `ask_user` or `askQuestions` tool **only for values not resolved** from the user's message, session context, metadata, or azd bootstrap. Common values skills may need:
- **Agent root** — Target azd service project folder or folder containing `.foundry/agent-metadata*.yaml`
- **Metadata file** — `agent-metadata.yaml` for local/dev, or an explicit sidecar such as `agent-metadata.prod.yaml`
- **Environment** — azd environment, `dev`, `prod`, or another environment key from metadata
- **Project endpoint** — AI Foundry project endpoint URL
- **Agent name** — Name of the target agent

> 💡 **Tip:** If the user already provides the agent path, environment, project endpoint, or agent name, extract it directly — do not ask again.

## Agent: Agent Types

All agent skills support two agent types:

| Type | Kind | Description |
|------|------|-------------|
| **Prompt** | `"prompt"` | LLM-based agents backed by a model deployment |
| **Hosted** | `"hosted"` | Container-based agents running custom code |

Use `agent_get` MCP tool to determine an agent's type when needed.

## Tool Usage Conventions

- Use the `ask_user` or `askQuestions` tool whenever collecting information from the user
- Use the `task` or `runSubagent` tool to delegate long-running or independent sub-tasks (e.g., env var scanning, status polling, Dockerfile generation)
- Prefer Azure MCP tools over direct CLI commands when available
- Reference official Microsoft documentation URLs instead of embedding CLI command syntax

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Foundry Agent Runtime Components](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/runtime-components?view=foundry)

## SDK Quick Reference

- [Python](references/sdk/foundry-sdk-py.md)
