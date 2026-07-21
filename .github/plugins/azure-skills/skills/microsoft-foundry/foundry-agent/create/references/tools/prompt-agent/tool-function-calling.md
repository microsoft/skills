# Tool — Function Calling (client-side)

Define custom functions the agent can invoke. Your app executes the function and returns results. Runs expire 10 minutes after creation — return tool outputs promptly.

> **Security:** Treat tool arguments as untrusted input. Don't pass secrets in tool output. Use `strict=True` for schema validation.

> **Not available via toolbox** — function calling executes in the client process, so it's declared on the prompt agent, not in a toolbox version.

## Prompt-agent SDK class

`FunctionTool` — wraps a Python callable; the SDK introspects its signature and docstring to build the schema sent to the model.

## References

- [Function Calling tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/function-calling)
- [agent-tools.md](agent-tools.md) — tool index
