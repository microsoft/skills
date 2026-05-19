# Create Hosted Agent Application

Create new hosted agent applications for Microsoft Foundry, or convert existing agent projects to be Foundry-compatible using the hosting adapter.

## Quick Reference

| Property | Value |
|----------|-------|
| **Samples Repo** | `microsoft-foundry/foundry-samples` |
| **Python Samples** | `samples/python/hosted-agents/` |
| **C# Samples** | `samples/csharp/hosted-agents/` |
| **Hosted Agents Docs** | https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents |
| **Default Selection** | `Python` + `responses` + `Microsoft Agent Framework` |
| **Best For** | Creating new or converting existing agent projects for Foundry |

## When to Use This Skill

- Create a new hosted agent application from scratch (greenfield)
- Start from an official sample and customize it
- Convert an existing agent project to be Foundry-compatible (brownfield)
- Help user choose a language, protocol, framework, or sample for their agent

## Workflow

> Relative reference paths in this file are resolved from the directory containing `create.md`. For example, `./references/agentframework.md` means the file next to this document under `create/references/`, not a path relative to the runtime working directory.

### Step 1: Determine Scenario

Check the user's workspace for existing agent project indicators:

- **No agent-related code found** → **Greenfield**. Proceed to Greenfield Workflow (Step 2).
- **Existing agent code present** → **Brownfield**. Proceed to Brownfield Workflow.

### Step 2: Gather Requirements (Greenfield)

If the user hasn't already specified, use `ask_user` to collect in this order:

**Language:** Python (default) or C#.

**Protocol:**

| Protocol | Best For |
|----------|----------|
| `responses` (default) | Conversational agents using the OpenAI-compatible `/responses` contract |
| `invocations` | Arbitrary payloads, custom SSE behavior, protocol bridges, webhook-style callers, or client-managed sessions |

**Framework:**

The paths below refer to the framework-level directories in the Foundry sample repo. Choose the protocol-specific subpath in Step 3.

| Framework | Python Path | C# Path |
|-----------|-------------|---------|
| Microsoft Agent Framework (default) | `agent-framework` | `agent-framework` |
| LangGraph | `bring-your-own` | ❌ Python only |
| Custom | `bring-your-own` | `bring-your-own` |

> ⚠️ **Warning:** LangGraph is Python-only. For C# + LangGraph, suggest Microsoft Agent Framework or Custom instead.

> 💡 **Tip:** In the sample repo, **Custom** corresponds to the **Bring Your Own** lanes.

> 💡 **Tip:** LangGraph samples are under **Bring Your Own**, not under a separate top-level `langgraph` directory.

If user has no specific preference, suggest Python + `responses` + Microsoft Agent Framework as defaults.

In non-interactive or YOLO mode, default to Python + `responses` + Microsoft Agent Framework unless the user's request clearly requires another supported combination.

### Step 3: Browse and Select Sample

List available samples using the GitHub API. First resolve the `sample_browse_path` (the browse root) from the selected language, protocol, and framework:

| Selection | Sample Browse Path |
|-----------|--------------------|
| Python + Microsoft Agent Framework + `responses` | `samples/python/hosted-agents/agent-framework/responses/` |
| Python + Microsoft Agent Framework + `invocations` | `samples/python/hosted-agents/agent-framework/invocations/` |
| Python + LangGraph | `samples/python/hosted-agents/bring-your-own/{protocol}/langgraph-chat/` |
| Python + Custom | `samples/python/hosted-agents/bring-your-own/{protocol}/` |
| C# + Microsoft Agent Framework + `responses` | `samples/csharp/hosted-agents/agent-framework/` |
| C# + Microsoft Agent Framework + `invocations` | `samples/csharp/hosted-agents/agent-framework/invocations-echo-agent/` |
| C# + Custom | `samples/csharp/hosted-agents/bring-your-own/{protocol}/` |

Use the chosen lane to browse the repo under `sample_browse_path`:

```
GET https://api.github.com/repos/microsoft-foundry/foundry-samples/contents/{sample_browse_path}
```

If the user has specified what they want the agent to do, choose the most relevant or most simple sample under that lane and record its exact `selected_sample_path`. Only if the user has not given any preferences, present the sample directories under `sample_browse_path` to the user and help them choose based on their requirements (e.g., RAG, tools, multi-agent workflows, HITL).

If the requested combination does not have a real sample, say so clearly and suggest the nearest supported lane.

> ⚠️ **Tools:** Hosted agents access tools through a **Foundry Toolbox MCP endpoint** — they do NOT wire tools directly. If the user wants an agent with tools (web search, AI search, code interpreter, MCP servers, etc.), select the `toolbox` samples (see [references/use-toolbox-in-hosted-agent.md#code-integration-patterns](references/use-toolbox-in-hosted-agent.md#code-integration-patterns)). These samples include Foundry Toolbox integration in the sample code out of the box, but the user still needs an actual toolbox resource — you'll resolve its endpoint in Step 6 (Verify Startup).

### Step 4: Download Sample Files

Download only the selected sample directory — do NOT clone the entire repo. Preserve the directory structure by creating subdirectories as needed.

Use the exact `selected_sample_path` selected in Step 3.

**Using `gh` CLI (preferred if available):**
```bash
gh api repos/microsoft-foundry/foundry-samples/contents/{selected_sample_path} \
  --jq '.[] | select(.type=="file") | .download_url' | while read url; do
  filepath="${url##*/{selected_sample_path}/}"
  mkdir -p "$(dirname "$filepath")"
  curl -sL "$url" -o "$filepath"
done
```

**Using curl (fallback):**
```bash
curl -s "https://api.github.com/repos/microsoft-foundry/foundry-samples/contents/{selected_sample_path}" | \
  jq -r '.[] | select(.type=="file") | .path + "\t" + .download_url' | while IFS=$'\t' read path url; do
    relpath="${path#{selected_sample_path}/}"
    mkdir -p "$(dirname "$relpath")"
    curl -sL "$url" -o "$relpath"
  done
```

For nested directories, recursively fetch the GitHub contents API for entries where `type == "dir"` and repeat the download for each.

### Step 5: Customize and Implement

1. Read the sample's `README.md` and `agent.yaml` or `agent.manifest.yaml` to understand its structure
2. Read the sample code to understand patterns, protocol handling, and dependencies used
3. If using Agent Framework, follow the best practices in [references/agentframework.md](references/agentframework.md)
4. Implement the user's specific requirements on top of the sample
5. Update configuration (`.env`, dependency files, `agent.yaml`, `agent.manifest.yaml`) as needed, and keep the selected protocol consistent across code and config
6. Ensure the project is in a runnable state

### Step 6: Verify Startup

1. Install dependencies (use virtual environment for Python)
2. Ask user to provide values for `.env` variables if placeholders were used using `ask_user` tool.
   - **If the agent uses tools / toolboxes**: resolve the toolbox endpoint per [references/use-toolbox-in-hosted-agent.md#resolve-toolbox-endpoint](references/use-toolbox-in-hosted-agent.md#resolve-toolbox-endpoint).
3. Run the main entrypoint
4. Fix startup errors and retry if needed
5. Send a protocol-appropriate test request to the correct endpoint:
   - `responses` → `POST http://localhost:8088/responses`
   - `invocations` → `POST http://localhost:8088/invocations`
6. Fix any errors from the test request and retry until it succeeds
7. Once startup and test request succeed, stop the server to prevent resource usage

**Guardrails:**
- ✅ Perform real run to catch startup errors
- ✅ Cleanup after verification (stop server)
- ✅ Ignore auth/connection/timeout errors (expected without Azure config)
- ❌ Don't wait for user input or create test scripts

## Brownfield Workflow: Convert Existing Agent to Hosted Agent

Use this workflow when the user has an existing agent project that needs to be made compatible with Foundry hosted agent deployment. The key requirement is wrapping the existing agent with the appropriate hosting adapter.

### Step B1: Analyze Existing Project

Scan the project to determine:

1. **Language** — Python (look for `requirements.txt`, `pyproject.toml`, `*.py`) or C# (look for `*.csproj`, `*.cs`)
2. **Framework** — Identify which agent framework is in use:

| Indicator | Framework |
|-----------|-----------|
| Imports from `agent_framework` or `Microsoft.Agents.AI` | Microsoft Agent Framework |
| Imports from `langgraph`, `langchain` | LangGraph |
| No recognized framework imports, or other frameworks (e.g., Semantic Kernel, AutoGen, custom code) | Custom |

3. **Target protocol** — If the user has not specified one, infer whether the project should target `responses` or `invocations` based on the existing caller contract
4. **Entry point** — Identify the main script/entrypoint that creates and runs the agent
5. **Agent object** — Identify the agent instance that needs to be wrapped (e.g., a `BaseAgent` subclass, a compiled `StateGraph`, or an existing server/app)

### Step B2: Add Hosting Adapter Dependency

Add the correct adapter package based on framework, language, and protocol. Get the latest version from the package registry — do not hardcode versions.

**Python adapter packages:**

| Framework | Package(s) |
|-----------|------------|
| Microsoft Agent Framework | `responses`: `agent-framework-foundry-hosting`; `invocations`: `agent-framework-foundry-hosting` |
| LangGraph | `responses`: `azure-ai-agentserver-responses` + `azure-ai-agentserver-core`; `invocations`: `azure-ai-agentserver-invocations` + `azure-ai-agentserver-core` |
| Custom | `responses`: `azure-ai-agentserver-responses`; `invocations`: `azure-ai-agentserver-invocations` |

**.NET adapter packages:**

| Framework | Package(s) |
|-----------|------------|
| Microsoft Agent Framework | `responses`: `Microsoft.Agents.AI.Foundry.Hosting`; `invocations`: `Microsoft.Agents.AI.Foundry.Hosting` + `Azure.AI.AgentServer.Invocations` |
| Custom | `responses`: `Azure.AI.AgentServer.Responses`; `invocations`: `Azure.AI.AgentServer.Invocations` |

Add the package to the project's dependency file (`requirements.txt`, `pyproject.toml`, or `.csproj`). For Python, also add `python-dotenv` if not present.

### Step B3: Wrap Agent with Hosting Adapter

Modify the project's main entrypoint to wrap the existing agent with the adapter. The approach differs by framework and protocol:

**Microsoft Agent Framework + `responses` (Python):**
- Import `ResponsesHostServer` from the adapter package
- Pass the agent instance (from `agent_framework` package) to the adapter
- Call `.run()` on the adapter as the default entrypoint

**Microsoft Agent Framework + `invocations` (Python):**
- Use `InvocationAgentServerHost()`
- Implement an `@app.invoke_handler`
- Manage session state if the agent needs multi-turn memory

**Microsoft Agent Framework + `responses` (C#):**
- Register Foundry responses hosting and map the `responses` protocol

**Microsoft Agent Framework + `invocations` (C#):**
- Register invocations services and an invocation handler
- Map the `invocations` protocol

**LangGraph:**
- Python only
- Follow the `bring-your-own/{protocol}/langgraph-chat` sample for the selected protocol lane

**Custom:**
- Follow the corresponding `bring-your-own/{protocol}` sample for the selected language
- Prefer the protocol SDK sample for the selected lane instead of inventing a custom contract when a sample already exists

> ⚠️ **Warning:** The adapter MUST be the default entrypoint (no flags required to start). This is required for both local debugging and containerized deployment.

### Step B4: Configure Environment

1. Create or update a `.env` file with required environment variables (project endpoint, model deployment name, etc.)
   - **If the agent uses tools / toolboxes**: resolve the toolbox endpoint per [references/use-toolbox-in-hosted-agent.md#resolve-toolbox-endpoint](references/use-toolbox-in-hosted-agent.md#resolve-toolbox-endpoint).
2. For Python: ensure the code uses `load_dotenv(override=False)` so Foundry-injected environment variables are available at runtime.
3. If the project uses Azure credentials: ensure Python uses `azure.identity.DefaultAzureCredential` for **local development**. In production, use `ManagedIdentityCredential`. See [auth-best-practices.md](../../references/auth-best-practices.md)

### Step B5: Create agent.yaml

Create an `agent.yaml` file in the project root. This file defines the agent's metadata and deployment configuration for Foundry. Required fields:

- `name` — Unique identifier (alphanumeric + hyphens, max 63 chars)
- `description` — What the agent does
- `template.kind` — Must be `hosted`
- `template.protocols` — Must include the selected protocol and matching version from the chosen sample
- `template.environment_variables` — List all environment variables the agent needs at runtime

Refer to the chosen sample's `agent.yaml` or `agent.manifest.yaml` in the [foundry-samples repo](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents) for the exact schema.

### Step B6: Create Dockerfile

Create a `Dockerfile` if one doesn't exist. Requirements:

- Base image appropriate for the language (e.g., `python:3.12-slim` for Python, `mcr.microsoft.com/dotnet/sdk` for C#)
- Copy source code into the container
- Install dependencies
- Expose port **8088** (the adapter's default port)
- Set the main entrypoint as the CMD

> ⚠️ **Warning:** When building, MUST use `--platform linux/amd64`. Hosted agents run on Linux AMD64 infrastructure. Images built for other architectures (e.g., ARM64 on Apple Silicon) will fail.

Refer to the chosen sample's `Dockerfile` in the [foundry-samples repo](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents) for the exact pattern.

### Step B7: Test Locally

1. Install dependencies (use virtual environment for Python)
2. Run the main entrypoint — the adapter should start an HTTP server on `localhost:8088`
3. Send a protocol-appropriate test request to either `/responses` or `/invocations`
4. Verify the response follows the expected protocol shape for the selected lane
5. Fix any errors and retry until the test request succeeds
6. Stop the server

> 💡 **Tip:** If auth/connection errors occur for Azure services, that's expected without real Azure credentials configured. The key validation is that the HTTP server starts and accepts requests.

## Common Guidelines

IMPORTANT: YOU MUST FOLLOW THESE.

Apply these to both greenfield and brownfield projects:

1. **Sample-first** — Start from a real sample in the current `foundry-samples` repo. Do not invent unsupported combinations, paths, or protocol behavior.

2. **Protocol consistency** — Keep the selected protocol consistent across sample choice, code, config, and verification steps.

3. **Logging** — Implement proper logging using the language's standard logging framework (Python `logging` module, .NET `ILogger`). Hosted agents stream container stdout/stderr logs to Foundry, so all log output is visible via the troubleshoot workflow. Use structured log levels (INFO, WARNING, ERROR) and include context like request IDs and agent names.

4. **Framework-specific best practices** — When using Microsoft Agent Framework, read the [Agent Framework best practices](references/agentframework.md) for hosting adapter setup, credential patterns, and debugging guidance.

5. **Deploy handoff** — After the agent has been created and local verification succeeds, explicitly tell the user that they can deploy the agent if they want, and ask them to say `deploy agent to foundry` to continue with the deploy sub-skill.

6. **Tool integration** — Hosted agents access tools through [Foundry Toolbox](references/use-toolbox-in-hosted-agent.md), NOT by wiring tools directly. If the user needs tools (web search, AI search, code execution, file search, MCP servers, etc.), follow the toolbox integration guide. The toolbox provides a single MCP-compatible endpoint that handles credential injection and tool discovery.

7. **Reserved environment variables** — The Foundry platform injects environment variables into every hosted agent container at startup. You MUST NOT generate, suggest, or configure any of these in `.env` files, `agent.yaml` `environment_variables`, or application code:

   **Blocked prefixes** (any variable starting with these is reserved):
   - `FOUNDRY_*` — platform-injected identity, session, project, and toolset variables
   - `AGENT_*` — reserved for platform use

   **Exact reserved names** (platform-managed, overwritten at runtime):
   - `PORT` — HTTP listen port (default `8088`)
   - `HOME` — session filesystem path (`/home/session`)
   - `SSE_KEEPALIVE_INTERVAL` — SSE keep-alive config
   - `APPLICATIONINSIGHTS_CONNECTION_STRING` — observability
   - `OTEL_EXPORTER_OTLP_ENDPOINT` — OTLP collector endpoint

   **Key `FOUNDRY_*` variables available at runtime** (read-only, do not set):
   - `FOUNDRY_PROJECT_ENDPOINT` — project endpoint URL for calling Azure services
   - `FOUNDRY_AGENT_NAME` — the deployed agent's name
   - `FOUNDRY_AGENT_VERSION` — the deployed agent's version
   - `FOUNDRY_TOOLBOX_ENDPOINT` — MCP-compatible toolbox endpoint (if toolbox is configured)

   If user code needs to read these values at runtime (e.g., `FOUNDRY_PROJECT_ENDPOINT` to call Azure services), read them from the environment — do not set or override them.

## Coding Tips

Use these when generating or modifying project code:

1. **Create a `.gitignore` file** — After generating code, create a `.gitignore` file if one does not already exist. If one already exists, update it as needed.
   - Choose the ignore entries based on the language, framework, and files generated.
   - Do not leave the project with no ignored files.
   - For Python projects, `.venv/` MUST be ignored at a minimum.

## Non-Interactive / YOLO Mode

When running in non-interactive mode (e.g., YOLO mode), skip selection prompts and use these defaults unless the user has already specified otherwise:

- **Language** — `Python`
- **Protocol** — `responses`
- **Framework** — `Microsoft Agent Framework`

If the user's request clearly requires another supported lane, use that lane instead of forcing the defaults.

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| GitHub API rate limit | Too many requests | Authenticate with `gh auth login` |
| `gh` not available | CLI not installed | Use curl REST API fallback |
| Sample not found | Path changed in repo or selected lane has no matching sample | List the selected parent directory again and choose a current sample |
| Requested combination not supported | Example: C# + LangGraph | Explain the gap and switch to the nearest supported lane |
| Protocol mismatch | Code, `agent.yaml`, and test request are not aligned | Make all three match the selected protocol |
| Dependency install fails | Version conflicts | Use versions from the selected sample's own dependency file |
