# Re-host an Existing Agent from other platforms

## Step 1: Collect information

Resolve two independent choices before initialization or edits:

1. **Model** -- keep the existing model or use a Foundry model.
2. **Agent framework** -- keep the existing framework or migrate it.

Infer these choices from the user's request and current code. Ask only for information that remains unclear; skip questions when the intent is explicit or evident, such as an existing Foundry model integration. Do not switch or deploy a model, or migrate the framework, without user intent.

Before asking, check the agent source root for `langgraph.json` or a direct `langchain`, `langgraph`, or `langchain-azure-ai` dependency in `pyproject.toml` or `requirements.txt`. If found, follow [LangChain and LangGraph hosting](langchain-langgraph-hosting.md) without re-asking for the framework.

## Step 2: Initialize and adapt

For [configuration-only LangChain / LangGraph hosting](langchain-langgraph-hosting.md#zero-code-migration), use the linked recipe. If only local configuration was requested, stop there; defer unresolved project and model choices until deployment. Otherwise, if the azd project is not initialized for this agent, prepare the launcher and run the init command below with the existing source and `--entry-point foundry_host.py`, then merge the service settings before provisioning or deploying.

To scaffold a Foundry agent project with existing agent codes, run:

```bash
azd ai agent init --no-prompt \
  --src ./src/my-agent \
  --agent-name my-agent \
  --deploy-mode code \
  --runtime python_3_13 \
  --entry-point <entry-point>
```

Use `--deploy-mode code` by default. `--runtime` and `--entry-point` are required with `--deploy-mode code --no-prompt`. Use the existing executable entry point, or a new adapter file only when one is intentionally added. Runtimes: `python_3_13`, `python_3_14`, `dotnet_10`. `--deploy-mode container` builds from `Dockerfile`. For an existing Foundry project, add `--project-id "<resourceId>"`.

For other hosting paths, after scaffolding you must use `azd ai agent sample list --language <language> --output json` and follow the [azd Sample Selection Guidance](../create-hosted.md#azd-sample-selection-guidance) to find the closest relevant samples for adapter, protocol, and deployment guidance. Treat samples as boundary patterns, not replacement applications. Browse the relevant samples as code references.

For reference, here are some awesome samples for re-hosting scenarios:
1. Re-host LangChain / LangGraph agents (zero-code via `langgraph.json` + `langchain-azure-ai`): follow the [hosting guide](langchain-langgraph-hosting.md) and the [`langgraph/responses/10-run` sample](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/langgraph/responses/10-run).
2. Re-host agents built with the OpenAI Agents SDK: https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses/openai-agents-sdk
3. Re-host agents built with the Claude Agent SDK: https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/invocations/claude-agent-sdk

If users use a Foundry model, you must wire the Foundry model to the agent.

Set `startupCommand` in `azure.yaml`.

Once the agent is configured as a Foundry hosted agent, make the requested changes, return to [create-hosted](../create-hosted.md), and continue with Step 5.

## Step 3: Set azd env

```bash
azd env set AZURE_SUBSCRIPTION_ID "<id>"
azd env set AZURE_LOCATION "<region>"
azd env set AZURE_AI_MODEL_DEPLOYMENT_NAME "<model name>"
```

## Foundry Model Reference

Read [Foundry Model Reference](./foundry-model.md) and follow the steps in it when you want to query model related data.
