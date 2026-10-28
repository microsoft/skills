# Managed Harness Agent Tools

A Managed Harness Agent prefers tools declared directly in the Agent service's `tools[]`. Use a Toolbox only when explicitly requested.

| Capability | Authoring | Connection |
|---|---|---|
| Copilot built-ins | `microsoft_copilot_toolset_preview` for new authoring | No |
| Web Search | `web_search` | No |
| Code Interpreter | `code_interpreter` | No |
| File Search | `file_search` | Existing vector store |
| MCP server | `mcp` | Optional, depends on authentication |
| Azure AI Search | `azure_ai_search` | Existing Cognitive Search connection |
| OpenAPI | `openapi` | Conditional, depends on authentication |
| Agent-to-Agent | `a2a_preview` | Optional |
| Work IQ | Connection-authenticated `mcp` | Existing Work IQ connection |
| Fabric IQ | `fabric_iq_preview` | Existing Fabric IQ connection |
| Toolbox | Authenticated `mcp` to an exact version endpoint | Matching Toolbox connection |

Read the specific reference before editing:

- [Copilot Toolset](tool-github-copilot-toolset.md)
- [Web Search](tool-web-search.md)
- [Code Interpreter](tool-code-interpreter.md)
- [File Search](tool-file-search.md)
- [MCP](tool-mcp.md)
- [Azure AI Search](tool-azure-ai-search.md)
- [OpenAPI](tool-openapi.md)
- [Agent-to-Agent](tool-a2a.md)
- [Work IQ](tool-work-iq.md)
- [Fabric IQ](tool-fabric-iq.md)
- [Toolbox](tool-toolbox.md)

Standard tool entries use Foundry REST field names, normally `snake_case`. Except for the Copilot toolset, azd validates little beyond a non-empty `type`; Foundry validates nested fields.

Legacy `github_copilot_toolset_preview` entries remain supported and must be preserved when editing an existing definition.

Do not add unsupported tools by guessing their schema. Do not create a connection or Toolbox unless the user explicitly requests creation.
