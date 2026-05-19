# Use Toolbox in a Hosted Agent

Hosted agents access Foundry-managed tools through a **Toolbox MCP endpoint**. Unlike prompt agents that wire tools directly, hosted agents connect to a single MCP-compatible endpoint that exposes all configured tools. The platform handles credential injection, token refresh, and policy enforcement.

> 📘 For endpoint format, MCP protocol details, auth, OAuth consent handling, testing, and troubleshooting, see [toolbox-reference.md](toolbox-reference.md).

## Quick Reference

| Property | Value |
|----------|-------|
| **Toolbox Docs** | https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox |
| **Default Sample (Python)** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/toolbox/maf |
| **Python Hosted Agent — `responses`** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses |
| **Python Hosted Agent — `invocations`** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/invocations |
| **C# (.NET) Samples** | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/toolbox |
| **Supported Tool Types & Auth** | https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/toolbox/SUPPORTED_TOOLBOX_TOOLS.md |

## Resolve Toolbox Endpoint

If the user provides a toolbox name or endpoint URL, or the project already references a toolbox (e.g., in `.env` or `agent.manifest.yaml`) → use it directly.

Otherwise, ask one question:

> _"Would you like to provide your toolbox endpoint? (you can create one with the [Foundry Toolkit in VS Code](https://code.visualstudio.com/docs/intelligentapps/tool-catalog) or the [Foundry Portal](https://ai.azure.com/))"_

Once the user supplies the toolbox name/endpoint — either an existing one or a new one they create via the Foundry Toolkit or Foundry Portal — set it on the agent (e.g., `FOUNDRY_TOOLBOX_ENDPOINT` in `.env`) and continue with verification.

> **When asking the question, always include the doc links inline** for the manual options — the [Foundry Toolkit in VS Code](https://code.visualstudio.com/docs/intelligentapps/tool-catalog) and the [Foundry Portal](https://ai.azure.com/) — so the user knows where to go to create a tool/toolbox themselves. Don't just name the options; render them as clickable links every time.

> **Before printing out any step-by-step guidance** for the Foundry Toolkit (VS Code) path, fetch and read [Use Tool Catalog to connect tools and Toolboxes in Foundry Toolkit](https://code.visualstudio.com/docs/intelligentapps/tool-catalog) first, then summarize the relevant steps for them. Don't paraphrase from memory — the Toolkit UI changes; quote the current doc.

> **Available tool types** (for context when discussing what the toolbox will contain): Web Search, Azure AI Search, Code Interpreter, File Search, MCP Server (third-party MCP servers, e.g. GitHub, and Microsoft first-party MCP servers, e.g. WorkIQ), OpenAPI, Agent-to-Agent (A2A). See [Configure tools](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox#configure-tools).

## Code Integration Patterns

The sample repo provides integration patterns for both Python and C#. Read the sample code and adapt it to the user's project.

**Python samples:**

| Sample | Framework | Protocol | When to use |
|--------|-----------|----------|-------------|
| [`toolbox/maf/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/toolbox/maf) — recommended | Agent Framework (MAF) | Responses | **Default choice** |
| [`bring-your-own/responses/langgraph-toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses/langgraph-toolbox) | LangGraph (BYO) | Responses | LangGraph hosted agent with toolbox |
| [`toolbox/copilot-sdk/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/toolbox/copilot-sdk) | GitHub Copilot SDK | Responses | Copilot SDK with toolbox tools |
| [`bring-your-own/responses/bring-your-own-toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses/bring-your-own-toolbox) | Generic MCP (BYO) | Responses | Raw `httpx` MCP client — works with any framework |
| [`bring-your-own/invocations/toolbox/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/invocations/toolbox) | Generic MCP (BYO) | Invocations | Toolbox via Invocations protocol |

**C# (.NET) samples:**

| Sample | Description |
|--------|-------------|
| [`csharp/toolbox/maf/`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/toolbox/maf) — recommended | Agent Framework agent with toolbox MCP (Responses protocol) |

**Notes:** (apply to all patterns, both Python and C#):
- Auth: Inject a bearer token with scope `https://ai.azure.com/.default` on every request (Python: `httpx.Auth` subclass; C#: `DefaultAzureCredential` + `BearerTokenAuthenticationPolicy`).
- Header: Always include `Foundry-Features: Toolboxes=V1Preview`.
- MCP client: Pass `load_prompts=False` — the toolbox endpoint does not support `prompts/list`.
- Endpoint: Construct from `{project_endpoint}/toolboxes/{toolbox_name}/mcp?api-version=v1`.

> 💡 **Tip:** If MCP tools have `require_approval: "always"` in `_meta.tool_configuration`, the agent runtime must ask the user for confirmation before invoking. The toolbox endpoint does not enforce this — your agent code is responsible.
