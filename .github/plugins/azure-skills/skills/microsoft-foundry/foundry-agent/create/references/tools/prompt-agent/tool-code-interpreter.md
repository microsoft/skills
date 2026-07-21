# Tool — Code Interpreter

Enables agents to write and run Python in a sandboxed environment. Supports data analysis, chart generation, and file processing. Has [additional charges](https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/) beyond token-based fees.

> Sessions: 1-hour active / 30-min idle timeout. Each conversation = separate billable session.

> ⚠️ When Code Interpreter is used through a toolbox in a **hosted agent**, user isolation isn't supported — all users in the same project share one container context.

## Prompt-agent SDK class

`CodeInterpreterTool` — see [tool-mcp.md](tool-mcp.md) for the general prompt-agent tool-wiring pattern; Code Interpreter takes no constructor arguments.

## Toolbox shape

```json
{ "type": "code_interpreter" }
```

No other fields. Only one `code_interpreter` per toolbox version (unnamed tool).

## References

- [Code Interpreter tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/code-interpreter)
- [agent-tools.md](agent-tools.md) — tool index
- [toolbox-reference.md](../../toolbox-reference.md) — endpoint, auth, and MCP protocol details
