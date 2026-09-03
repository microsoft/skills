# Acceptance Criteria: aident-skill

## Aident Operating Flow

### Correct

Agents using `aident-skill` should:

1. Use `https://aident.ai/SETUP.md` for first-time setup, install, migration, or update requests.
2. Prefer the Aident CLI when shell commands are available.
3. Discover capabilities before choosing an action.
4. Inspect the live capability schema before constructing action input.
5. Check Aident Vault status before saying an integration is connected.
6. Ask the user to connect missing integrations through Aident-managed OAuth or Vault flows.
7. Execute only after schema and Vault checks pass.
8. Use audit history when the user asks for proof of execution.

Example:

```bash
aident capabilities search --query "post Slack message" --json
aident capabilities get --name slack_tools.slack_post_message --json
aident vault status --integrationIds slack_tools --json
aident capabilities execute --name slack_tools.slack_post_message --input '{"channel":"#team","text":"Deploy is complete"}' --json
aident audit recent --limit 20 --json
```

### Incorrect

Agents using `aident-skill` should not:

- Call a raw provider SDK or ask for a raw provider API key when Aident Vault can manage the connection.
- Claim an integration is connected because it appears in the catalog.
- Skip live schema inspection before executing a new capability.
- Treat `npx skills add aident-ai/aident-skill` as complete Aident Loadout setup.
- Configure MCP on the user's behalf unless the user explicitly requests MCP setup.

## MCP Setup

### Correct

For VS Code and GitHub Copilot MCP setup, use `.vscode/mcp.json` with the Aident Loadout MCP endpoint:

```json
{
  "servers": {
    "aident": {
      "type": "http",
      "url": "https://loadout.aident.ai/mcp"
    }
  }
}
```

### Incorrect

```json
{
  "servers": {
    "aident": {
      "command": "npx",
      "args": ["-y", "aident-loadout"]
    }
  }
}
```

Do not invent an `aident-loadout` skill package or ask the user for provider tokens when OAuth/Vault can be used.
