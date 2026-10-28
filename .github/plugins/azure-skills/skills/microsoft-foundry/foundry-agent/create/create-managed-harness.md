# Create Managed Harness Agent

Create or continue developing a Microsoft Foundry Managed Harness Agent with azd. A Managed Harness Agent is a Prompt Agent running on the Foundry-managed Copilot harness:

```yaml
kind: prompt
harness:
  type: microsoft_copilot_preview
```

Use this workflow only when the user explicitly says Managed Harness Agent, Copilot harness agent, or Prompt Agent with Copilot harness. Ordinary Prompt Agents use [create-prompt.md](create-prompt.md); Hosted Agents use [create-hosted.md](create-hosted.md).

## Boundaries

- Use azd and `azure.yaml` as the source of truth.
- Do not use Hosted samples, local runtime, sessions, files, or monitor commands.
- Do not convert an existing Prompt, Hosted, or Managed Harness Agent to another type. Create a new Agent instead.
- New authoring uses the Microsoft discriminator family. Existing Microsoft, legacy GitHub, or mixed discriminator families are preserved exactly as authored during ordinary edits and redeploys.
- Prefer direct tools. Use a Toolbox only when the user explicitly requests one.
- Consume a connection, Toolbox, or Skill supplied by the user or already referenced in the project. Create one only when explicitly requested.
- Supported direct tools: Copilot built-ins, Code Interpreter, File Search, Web Search, MCP, Azure AI Search, OpenAPI, Agent-to-Agent, Work IQ, and Fabric IQ.
- Do not generate an evaluation suite in this workflow.

Read [Managed Harness Agent Authoring](references/managed-harness-agent.md) and [Managed Harness Agent Tools](references/tools/managed-harness-agent/agent-tools.md) before editing `azure.yaml`.

## Workflow

### Step 1: Verify the environment

Run the bundled preflight and verification scripts:

```bash
./scripts/check-copilot-app-entry.sh
./scripts/verify-environment.sh
```

```powershell
./scripts/check-copilot-app-entry.ps1
./scripts/verify-environment.ps1
```

Follow their `[ACTION]` output. Never run `az login` or `azd auth login` for the user. Before any azd command, follow [azd guidance](../azd-guidance/azd-guidance.md).

### Step 2: Select new or existing project

Inspect `azure.yaml`:

- One service with `kind: prompt` and `harness.type: microsoft_copilot_preview` or legacy `github_copilot_preview` -> continue development.
- Multiple Managed Harness Agent services -> ask the user to select one.
- Existing non-Managed Harness Agent service -> do not convert it; add a new service only when the user wants a new Managed Harness Agent.
- No azd project -> initialize a new Managed Harness Agent.

Do not fetch a remote Managed Harness Agent and synthesize `azure.yaml`.

### Step 3: Collect unresolved values

Resolve values from the request, `azure.yaml`, and `azd env get-values` before asking:

- Agent and project name.
- New or existing Foundry project.
- Existing project ARM ID when applicable.
- Subscription and region for new infrastructure.
- Model name for a new deployment, or existing model deployment name.
- Instructions and requested tools.

A Managed Harness Agent does not need language, runtime, entry point, deploy mode, Docker, or ACR.

### Step 4: Initialize or update

For a new Managed Harness Agent, run non-interactively:

```bash
azd ai agent init --no-prompt \
  --kind prompt \
  --harness microsoft_copilot_preview \
  --agent-name "<agent-name>" \
  --model "<model-name>"
```

For an existing project/model deployment, use:

```bash
azd ai agent init --no-prompt \
  --kind prompt \
  --harness microsoft_copilot_preview \
  --agent-name "<agent-name>" \
  --project-id "<project-arm-id>" \
  --model-deployment "<deployment-name>"
```

The preview `--harness` flag may be hidden from help. If rejected, verify the installed `azure.ai.agents` extension version; do not replace it with a Hosted manifest.

After init completes, enter the generated project directory before running `azd env set`. For a new project set subscription, location, and project name. Do not chain these commands to init.

For an existing Managed Harness Agent, edit `azure.yaml` in place. Rerunning init can create a suffixed duplicate service.

### Step 5: Validate the definition

Confirm:

- `host: azure.ai.agent`
- `kind: prompt`
- New definitions use `harness.type: microsoft_copilot_preview`.
- Existing definitions retain their authored `microsoft_copilot_preview` or legacy `github_copilot_preview` value.
- Existing Copilot toolset discriminators are preserved rather than normalized.
- Model and instructions match the request.
- No Hosted-only `codeConfiguration`, Docker, container, runtime, or protocol fields.

Preserve unrelated services and unknown user-authored fields.

### Step 6: Add capabilities

Read the matching Managed Harness Agent reference before editing:

| Capability | Reference |
|---|---|
| Copilot built-ins | [Copilot Toolset](references/tools/managed-harness-agent/tool-github-copilot-toolset.md) |
| Web Search | [Web Search](references/tools/managed-harness-agent/tool-web-search.md) |
| Code Interpreter | [Code Interpreter](references/tools/managed-harness-agent/tool-code-interpreter.md) |
| File Search | [File Search](references/tools/managed-harness-agent/tool-file-search.md) |
| MCP server | [MCP](references/tools/managed-harness-agent/tool-mcp.md) |
| Azure AI Search | [Azure AI Search](references/tools/managed-harness-agent/tool-azure-ai-search.md) |
| OpenAPI | [OpenAPI](references/tools/managed-harness-agent/tool-openapi.md) |
| Agent-to-Agent | [Agent-to-Agent](references/tools/managed-harness-agent/tool-a2a.md) |
| Work IQ | [Work IQ](references/tools/managed-harness-agent/tool-work-iq.md) |
| Fabric IQ | [Fabric IQ](references/tools/managed-harness-agent/tool-fabric-iq.md) |
| Toolbox | [Toolbox](references/tools/managed-harness-agent/tool-toolbox.md) |

For connection-backed tools, use only a connection supplied by the user or already present in the Managed Harness Agent configuration. If missing, leave a clear placeholder or stop and request the value. Create it only when explicitly requested.

If the user explicitly requests a Toolbox, follow the [Managed Harness Agent Toolbox](references/tools/managed-harness-agent/tool-toolbox.md) workflow. Create or reuse the Toolbox and its matching authenticated project connection separately, then attach the exact versioned endpoint as a direct MCP tool.

For Foundry Skills, follow [Managed Harness Agent Skills](references/skills/managed-harness-agent-skill-attach.md). Manage the Skill separately with `azd ai skill`, then pin its existing version in the Agent's top-level `skills` list.

### Step 7: Deploy and invoke

Continue with the independent Managed Harness Agent branches in [deploy](../deploy/deploy.md) and [invoke](../invoke/invoke.md). There is no local harness runtime gate.

## Error Handling

| Error | Resolution |
|---|---|
| `--harness` rejected | Update/verify `azure.ai.agents`; the flag is preview and hidden |
| Prompt init requires a model | Supply `--model`, or `--project-id` plus `--model-deployment` |
| Duplicate `<agent>-2` service | Remove the unintended duplicate and edit the original Managed Harness Agent in place |
| Deploy succeeds without harness | Treat as failure; verify `kind` and `harness` in the published definition |
| Tool rejected by Foundry | Compare the REST-shaped fields with the Managed Harness Agent tool reference |
