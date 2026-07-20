# Tool — Agent-to-Agent (A2A, preview)

Call another Foundry agent as if it were a tool. Useful for composing specialist agents into an orchestrator.

## Toolbox shape

```json
{
  "type": "a2a_preview",
  "name": "<AGENT_NAME>",
  "description": "<what this agent does>",
  "base_url": "<AGENT_BASE_URL>",
  "project_connection_id": "<connection_to_target_project>"
}
```

Auth is either anonymous (for the same project) or via a project connection that holds credentials for the remote agent's host.

## References

- [A2A tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/agent-to-agent)
- [agent-tools.md](agent-tools.md) — tool index
