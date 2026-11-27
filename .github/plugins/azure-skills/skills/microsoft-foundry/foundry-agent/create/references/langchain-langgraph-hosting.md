# LangChain and LangGraph Hosting

Use this guidance when creating, migrating, or re-hosting a LangChain or LangGraph agent on Foundry.

## Design Intent

Preserve the agent's existing framework behavior and minimize migration-specific code. Choose the least invasive hosting path that satisfies the requested behavior.

Treat migration as additive. Do not delete or replace user-authored code, and do not remove existing dependencies. Add only the hosting configuration, files, and dependencies required to run the existing agent on Foundry.

Do not add, remove, or replace the agent's checkpointer unless the user explicitly requests a checkpointing change. Checkpointing belongs to the agent's application logic, not its hosting configuration.

## Hosting Decision

| Need | Hosting path |
|------|--------------|
| Standard LangChain or LangGraph agent hosting with no custom server behavior | **Configuration-only** |
| Custom request handling, protocol behavior, lifecycle control, or other hosting behavior that configuration cannot express | **Host server integration** |

Prefer configuration-only hosting unless the user explicitly requests custom hosting behavior or the existing agent demonstrably requires it. Do not add host server integration merely because the project already contains agent code.

## Sample Selection

Honor a named sample. For configuration-only migration, name the matching protocol sample below before editing and use the configuration in this guide without looking up the sample again. For scaffolding, use the parent workflow's azd sample selection guidance. Paths are relative to [`samples/python/hosted-agents`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents).

| Protocol or need | Sample |
|----------|--------|
| Responses (configuration-only) | [`langgraph/responses/10-run`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/responses/10-run/azure.yaml) |
| Invocations (configuration-only) | [`langgraph/invocations/03-run`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/invocations/03-run/azure.yaml) |
| ReAct chat with `create_agent` | `langgraph/responses/01-langgraph-chat` |
| Toolbox; Toolbox with user OAuth | `langgraph/responses/02-langgraph-toolbox`; `langgraph/responses/03-langgraph-toolbox-user-identity` |
| Multi-agent, subgraphs, deep agents | `langgraph/responses/05-workflows`, `langgraph/responses/15-branching`, `langgraph/responses/11-deep-agents` |
| Human-in-the-loop | `langgraph/responses/07-human-in-the-loop` |
| Observability | `langgraph/responses/08-observability` |
| Custom Responses server or startup/shutdown lifecycle | `langgraph/responses/12-custom-host` (`ResponsesHostServer`), only when `langgraph.json` cannot express it |

Use a host server integration sample only when the hosting decision above requires that path.

Samples provide hosting patterns only. Use their manifests, adapters, protocol wiring, and deployment configuration as references; do not treat sample application structure or conventions as the desired final application.

## Zero-code migration

In the service's `project` directory, add or reuse `langgraph.json` and bind the existing graph or factory:

```json
{"dependencies": ["."], "graphs": {"agent": "./main.py:graph"}}
```

Add `langchain-azure-ai[hosting,opentelemetry]>=1.2.9` to the existing `pyproject.toml` or `requirements.txt`. Add a small deployment launcher, `foundry_host.py`, next to `langgraph.json` without changing the graph code:

```python
from langchain_azure_ai.agents.hosting.run import main

if __name__ == "__main__":
    main(["--protocol", "responses"])
```

Add or merge this service in `azure.yaml` (`project: .` for root-level code):

```yaml
name: my-agent
services:
  my-agent:
    name: my-agent
    project: .
    host: azure.ai.agent
    kind: hosted
    language: python
    protocols:
      - protocol: responses
        version: 2.0.0
    startupCommand: python -m langchain_azure_ai.agents.hosting.run --protocol responses
    codeConfiguration:
      runtime: python_3_13
      entryPoint: foundry_host.py
    env:
      OTEL_AUTO_CONFIGURE_AZURE_MONITOR: "true"
```

Keep the module command in `startupCommand` for local runs. `azd` passes `codeConfiguration.entryPoint` as one argument to Python, so use the launcher path relative to the service's `project`, not module arguments. When scaffolding, pass `--entry-point foundry_host.py` even if the sample shows inline module arguments. Before running or deploying, verify the launcher exists and the graph binding resolves to the existing code.

For Invocations, use `invocations` in `protocols`, `startupCommand`, and the launcher's argument list. The entry-point filename stays the same.

## Model wiring and tracing

For a Foundry model, use the project's OpenAI-compatible base URL and a refreshable Entra token provider:

```python
import os
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from langchain_openai import ChatOpenAI

credential = DefaultAzureCredential()
endpoint = os.environ["FOUNDRY_PROJECT_ENDPOINT"]
with AIProjectClient(endpoint=endpoint, credential=credential) as project, project.get_openai_client() as client:
    base_url = str(client.base_url)

model = ChatOpenAI(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    base_url=base_url,
    api_key=get_bearer_token_provider(credential, "https://ai.azure.com/.default"),
    use_responses_api=True,
    output_version="responses/v1",
)
```

`use_responses_api=True` is mandatory: otherwise model spans lack `gen_ai.response.id` and Foundry Portal Traces renders empty. When monitoring is enabled, call `enable_auto_tracing()` from `langchain_azure_ai.callbacks.tracers` inside the graph factory and set `OTEL_AUTO_CONFIGURE_AZURE_MONITOR: "true"` in the service `env` as above. Verify correlated spans in the portal after a smoke invocation.

## Toolbox

Use `langchain_azure_ai.tools.AzureAIProjectToolbox` and follow the [LangChain / LangGraph Toolbox integration](use-toolbox-in-hosted-agent.md#langchain--langgraph-sdk) for schema adaptation and user OAuth consent.

## Pre-smoke-test RBAC

`ChatOpenAI` calls the project's OpenAI endpoint from inside the hosted container. Before remote smoke testing, check `Foundry User` for the **agent's managed identity**, not the deploy/invoke caller, at the project ARM scope ending in `Microsoft.CognitiveServices/accounts/<account>/projects/<project>`:

```bash
az role assignment list --assignee "<agent-principal-id>" --scope "<project-arm-id>" --role "Foundry User" --include-inherited --output table
```

If no `Foundry User` assignment is found, check whether another role grants the agent's managed identity model inference access. Only if that access is missing, have an authorized operator grant `Foundry User` at the project scope:

```bash
az role assignment create --assignee-object-id "<agent-principal-id>" --assignee-principal-type ServicePrincipal --scope "<project-arm-id>" --role "Foundry User"
```

Do not invoke until effective access is confirmed. For `401 PermissionDenied` from the model call, recheck the same identity and scope before retrying.