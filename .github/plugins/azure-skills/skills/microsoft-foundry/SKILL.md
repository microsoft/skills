---
name: microsoft-foundry
description: "Deploy, evaluate, and manage Foundry agents end-to-end: Docker build, ACR push, hosted/prompt agent create, container start, batch eval, prompt optimization, agent.yaml, dataset curation from traces. USE FOR: deploy agent to Foundry, hosted agent, create agent, invoke agent, evaluate agent, run batch eval, optimize prompt, deploy model, Foundry project, RBAC, role assignment, permissions, quota, capacity, region, troubleshoot agent, deployment failure, create dataset from traces, dataset versioning, eval trending, create AI Services, Cognitive Services, create Foundry resource, provision resource, knowledge index, agent monitoring, customize deployment, onboard, availability, standard agent setup, capability host. DO NOT USE FOR: Azure Functions, App Service, general Azure deploy (use azure-deploy), general Azure prep (use azure-prepare)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.3"
---

# Microsoft Foundry Skill

> **MANDATORY:** Read this skill and the relevant sub-skill BEFORE calling any Foundry MCP tool.

## Sub-Skills

| Sub-Skill | When to Use | Reference |
|-----------|-------------|-----------|
| **deploy** | Containerize, build, push to ACR, create/update/start/stop/clone agent deployments | [deploy](agent/deploy/deploy.md) |
| **invoke** | Send messages to an agent, single or multi-turn conversations | [invoke](agent/invoke/invoke.md) |
| **observe** | Eval-driven optimization loop: evaluate → analyze → optimize → compare → iterate | [observe](agent/observe/observe.md) |
| **trace** | Query traces, analyze latency/failures, correlate eval results to specific responses via App Insights `customEvents` | [trace](agent/trace/trace.md) |
| **troubleshoot** | View container logs, query telemetry, diagnose failures | [troubleshoot](agent/troubleshoot/troubleshoot.md) |
| **create** | Create new hosted agent applications. Supports Microsoft Agent Framework, LangGraph, or custom frameworks in Python or C#. Downloads starter samples from foundry-samples repo. | [create](agent/create/create.md) |
| **eval-datasets** | Harvest production traces into evaluation datasets, manage dataset versions and splits, track evaluation metrics over time, detect regressions, and maintain full lineage from trace to deployment. Use for: create dataset from traces, dataset versioning, evaluation trending, regression detection, dataset comparison, eval lineage. | [eval-datasets](agent/eval-datasets/eval-datasets.md) |
| **project/create** | Creating a new Azure AI Foundry project for hosting agents and models. Use when onboarding to Foundry or setting up new infrastructure. | [project/create/create-foundry-project.md](project/create/create-foundry-project.md) |
| **resource/create** | Creating Azure AI Services multi-service resource (Foundry resource) using Azure CLI. Use when manually provisioning AI Services resources with granular control. | [resource/create/create-foundry-resource.md](resource/create/create-foundry-resource.md) |
| **models/deploy-model** | Unified model deployment with intelligent routing. Handles quick preset deployments, fully customized deployments (version/SKU/capacity/RAI), and capacity discovery across regions. Routes to sub-skills: `preset` (quick deploy), `customize` (full control), `capacity` (find availability). | [models/deploy-model/SKILL.md](models/deploy-model/SKILL.md) |
| **quota** | Managing quotas and capacity for Microsoft Foundry resources. Use when checking quota usage, troubleshooting deployment failures due to insufficient quota, requesting quota increases, or planning capacity. | [quota/quota.md](quota/quota.md) |
| **rbac** | Managing RBAC permissions, role assignments, managed identities, and service principals for Microsoft Foundry resources. Use for access control, auditing permissions, and CI/CD setup. | [rbac/rbac.md](rbac/rbac.md) |

Onboarding flow: `project/create` → `deploy` → `invoke`

## Agent Lifecycle

| Intent | Workflow |
|--------|----------|
| New agent from scratch | create → deploy → invoke |
| Deploy existing code | deploy → invoke |
| Test/chat with agent | invoke |
| Troubleshoot | invoke → troubleshoot |
| Fix + redeploy | troubleshoot → fix → deploy → invoke |

## Project Context Resolution

Resolve only missing values. Extract from user message first, then azd, then ask.

1. Check for `azure.yaml`; if found, run `azd env get-values`
2. Map azd variables:

| azd Variable | Resolves To |
|-------------|-------------|
| `AZURE_AI_PROJECT_ENDPOINT` / `AZURE_AIPROJECT_ENDPOINT` | Project endpoint |
| `AZURE_CONTAINER_REGISTRY_NAME` / `AZURE_CONTAINER_REGISTRY_ENDPOINT` | ACR registry |
| `AZURE_SUBSCRIPTION_ID` | Subscription |

3. Ask user only for unresolved values (project endpoint, agent name)

## Validation

After each workflow step, validate before proceeding:
1. Run the operation
2. Check output for errors or unexpected results
3. If failed → diagnose using troubleshoot sub-skill → fix → retry
4. Only proceed to next step when validation passes

## Agent Types

| Type | Kind | Description |
|------|------|-------------|
| **Prompt** | `"prompt"` | LLM-based, backed by model deployment |
| **Hosted** | `"hosted"` | Container-based, running custom code |

## Agent: Setup Types

| Setup | Capability Host | Description |
|-------|----------------|-------------|
| **Basic** | None | Default. All resources Microsoft-managed. |
| **Standard** | Azure AI Services | Bring-your-own storage and search (public network). See [standard-agent-setup](references/standard-agent-setup.md). |
| **Standard + Private Network** | Azure AI Services | Standard setup with VNet isolation and private endpoints. See [private-network-standard-agent-setup](references/private-network-standard-agent-setup.md). |

> **MANDATORY:** For standard setup, read the appropriate reference before proceeding:
> - **Public network:** [references/standard-agent-setup.md](references/standard-agent-setup.md)
> - **Private network (VNet isolation):** [references/private-network-standard-agent-setup.md](references/private-network-standard-agent-setup.md)

## Tool Usage Conventions

- Use the `ask_user` or `askQuestions` tool whenever collecting information from the user
- Use the `task` or `runSubagent` tool to delegate long-running or independent sub-tasks (e.g., env var scanning, status polling, Dockerfile generation)
- Prefer Azure MCP tools over direct CLI commands when available
- Reference official Microsoft documentation URLs instead of embedding CLI command syntax

## References

- [Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Runtime Components](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/runtime-components?view=foundry)
- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples)
- [Python SDK](references/sdk/foundry-sdk-py.md)

## Dependencies

Scripts in sub-skills require: Azure CLI (`az`) ≥2.0, `jq` (for shell scripts). Install via `pip install azure-ai-projects azure-identity` for Python SDK usage.