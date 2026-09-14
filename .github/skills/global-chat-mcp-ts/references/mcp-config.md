# MCP Server Configuration

## Setup

```json
{
  "mcpServers": {
    "global-chat": {
      "command": "npx",
      "args": ["-y", "@global-chat/mcp-server"]
    }
  }
}
```

No environment variables or API keys required.

## Agent Configurations

### GitHub Copilot (VS Code)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "global-chat": {
      "command": "npx",
      "args": ["-y", "@global-chat/mcp-server"]
    }
  }
}
```

### Claude Code

Add to `.claude/settings.json` or use:

```bash
claude mcp add global-chat -- npx -y @global-chat/mcp-server
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "global-chat": {
      "command": "npx",
      "args": ["-y", "@global-chat/mcp-server"]
    }
  }
}
```

## Tool Details

### search_mcp_servers

Search the aggregated directory of MCP servers.

**Parameters:**
- `query` (string, required) — Search term (e.g., "database", "github", "slack")

**Returns:** Array of matching MCP servers with name, description, install command, and source registry.

### get_mcp_server

Get detailed information about a specific MCP server.

**Parameters:**
- `name` (string, required) — Server name or package name

**Returns:** Full server metadata including tools list, configuration, and setup instructions.

### search_a2a_agents

Search agents using Google's Agent-to-Agent protocol.

**Parameters:**
- `query` (string, required) — Search term for agent capabilities

**Returns:** Array of A2A-compatible agents with endpoints and capability descriptions.

### validate_agents_txt

Validate an agents.txt file against the specification.

**Parameters:**
- `url` (string, required) — URL of the agents.txt file to validate

**Returns:** Validation report with errors, warnings, and parsed agent entries.

### get_agents_txt

Fetch and parse an agents.txt file from a domain.

**Parameters:**
- `domain` (string, required) — Domain to fetch agents.txt from

**Returns:** Parsed agents.txt content with all agent entries and metadata.
