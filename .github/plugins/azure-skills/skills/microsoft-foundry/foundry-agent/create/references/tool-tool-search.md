# Tool — Tool Search (preview)

For toolboxes containing many tools, replace the full tool list passed to the model with two meta-tools — `tool_search` (natural-language discovery, returns matching tools per query) and `call_tool` (invoke any discovered tool by name) — so context cost stays flat regardless of toolbox size.

## Toolbox shape

```json
{ "type": "toolbox_search_preview" }
```

## Behavior

- `toolbox_search_preview` is a **configuration directive** — it doesn't appear in `tools/list` itself and doesn't count toward the unnamed-tool-per-type limit.
- All other toolbox tools are **hidden** from the initial `tools/list` and are returned only by `tool_search` calls (or by per-user auto-pinning of hot tools).
- Pin specific tools or add search-only keywords via `tool_configs.{tool_name}`:

  ```json
  {
    "type": "mcp",
    "server_label": "analytics",
    "server_url": "https://db-mcp.internal/sse",
    "tool_configs": {
      "execute_query": { "pin": true, "additional_search_text": "SQL analytics reporting dashboard" },
      "*":             { "additional_search_text": "data warehouse queries" }
    }
  }
  ```

  Use `"*"` as the key to apply settings to all tools in that entry.
- `additional_search_text` is used only for search ranking — it's never exposed to the model in the tool schema.
- Tool **descriptions drive match quality**: every MCP tool should have a clear `description`, or `tool_search` won't find it.
- Recommendation: add an instruction in the system prompt telling the model to call `tool_search` when a needed capability isn't in its current tool list.

## References

For full fields, pinning recipes, the verify-with-`tool_search` flow, and best practices, see [Tool Search tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/tool-search).

- [agent-tools.md](tools/prompt-agent/agent-tools.md) — tool index
- [use-toolbox-in-hosted-agent.md § Recommendation: enable Tool Search](use-toolbox-in-hosted-agent.md#-recommendation-enable-tool-search)
