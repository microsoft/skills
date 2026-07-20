# Agent Tools

This file is the **index** for every tool an agent can use. For each tool, it points to a dedicated reference file, and — where the tool is also available through a [toolbox](../../use-toolbox-in-hosted-agent.md) — lists the toolbox `type` value.

Two delivery paths exist:

- **Prompt agent** — the agent definition declares tool classes directly (`CodeInterpreterTool`, `MCPTool`, …). Use the SDK class column and the per-tool reference.
- **Hosted agent via toolbox** — the agent connects to a single MCP endpoint that exposes all tools declared in a toolbox version. Use the `type` column and see [use-toolbox-in-hosted-agent.md](../../use-toolbox-in-hosted-agent.md). For wiring the underlying project connection (catalog tile or generic remote MCP), see [foundry-tool-catalog.md](../../foundry-tool-catalog.md).

> 💡 **Authoritative tool shapes:** the source-of-truth for every tool's wire shape is the **Foundry Agents typespec** on the `main` branch of [`Azure/azure-rest-api-specs`](https://github.com/Azure/azure-rest-api-specs/tree/main/specification/cognitiveservices). When in doubt about a field name, default, or new tool type that isn't yet documented here, load the typespec directly — it's updated as tools are added/changed.

## Tool Summary

| Tool | Prompt-agent SDK class | Connection? | Reference |
|------|------------------------|-------------|-----------|
| Code Interpreter | `CodeInterpreterTool` | No | [tool-code-interpreter.md](tool-code-interpreter.md) |
| Function calling (client-side) | `FunctionTool` | No | [tool-function-calling.md](tool-function-calling.md) |
| File Search | `FileSearchTool` | No (vector store required) | [tool-file-search.md](tool-file-search.md) |
| Web Search (preview) | `WebSearchPreviewTool` | No (basic Bing); **Yes** for Grounding with Bing Custom Search — the connection scopes grounding to specific domains | [tool-web-search.md](tool-web-search.md) |
| Bing Grounding | `BingGroundingTool` | Yes (Bing) | [tool-bing-grounding.md](tool-bing-grounding.md) |
| Azure AI Search | `AzureAISearchTool` | Yes (Search) | [tool-azure-ai-search.md](tool-azure-ai-search.md) |
| MCP server (remote) | `MCPTool` | Optional (none / static key / project MI / OAuth) | [tool-mcp.md](tool-mcp.md); toolbox attach via [foundry-tool-catalog.md](../../foundry-tool-catalog.md) |
| OpenAPI tool | (n/a as a single class) | Conditional — `connection` auth requires `project_connection_id`; **`managed_identity` auth does NOT** (the project MI is used directly with an `audience`) | [tool-openapi.md](tool-openapi.md) |
| Agent-to-Agent (A2A) | (n/a as a single class) | Optional | [tool-a2a.md](tool-a2a.md) |
| Agent Memory | `MemorySearchPreviewTool` | Yes (project MI + embedding model) | [tool-memory.md](tool-memory.md) |
| **Work IQ (preview)** | `WorkIQPreviewTool` | Yes (Work IQ BYO-Entra-app OAuth connection) | [tool-work-iq.md](tool-work-iq.md) |
| **Fabric IQ (preview)** | `FabricIQPreviewTool` | Yes (Fabric IQ Entra-app OAuth or managed-OAuth connection) | [tool-fabric-iq.md](tool-fabric-iq.md) |

> ⚠️ **Default for web search:** Use `WebSearchPreviewTool` (`type: web_search`) unless the user explicitly requests Bing Grounding or Bing Custom Search.

> Combine multiple tools on one agent or one toolbox version. The model decides which to invoke. For multi-tool toolbox limits (at most one unnamed tool per type, unique `server_label` per MCP tool) see [toolbox-reference.md](../../toolbox-reference.md#multi-tool-toolbox-constraint).

## How to use this index

When you need details for a specific tool, **load that tool's reference file directly** — each one is self-contained (shape, requirements, references). Don't try to keep all tools in context at once.

For the toolbox runtime contract (endpoint, auth, MCP protocol, citation patterns, troubleshooting) see [toolbox-reference.md](../../toolbox-reference.md). For wiring a toolbox into a hosted agent (env vars, samples, tracing) see [use-toolbox-in-hosted-agent.md](../../use-toolbox-in-hosted-agent.md).

## Adjacent (not a `type` in a toolbox version)

- **Agent Memory** — use the `MemorySearchPreviewTool` SDK class on prompt agents; for hosted agents, configure the memory store via the project (separate from the toolbox). See [tool-memory.md](tool-memory.md).
- **Routines (preview)** — not a tool; an agent **trigger** (`schedule` / `timer` / `github_issue` / `custom`) that invokes an existing agent. Event-based routines are powered by the same **Connector Namespace** that backs catalog-MCP / managed-MCP connectors. See the [public Routines docs](https://learn.microsoft.com/azure/foundry/agents/how-to/use-routines).

## References

- **[Foundry Agents typespec (`main`)](https://github.com/Azure/azure-rest-api-specs/tree/main/specification/cognitiveservices)** — authoritative tool shapes
- [Tool Catalog](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog)
- [Toolbox (preview)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox)
- [use-toolbox-in-hosted-agent.md](../../use-toolbox-in-hosted-agent.md) — wiring a toolbox into a hosted agent
- [toolbox-reference.md](../../toolbox-reference.md) — toolbox runtime contract
- [foundry-tool-catalog.md](../../foundry-tool-catalog.md) — project connections for remote tools
