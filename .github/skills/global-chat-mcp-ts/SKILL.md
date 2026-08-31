---
name: global-chat-mcp-ts
description: Discover and search AI agents across MCP, A2A, and agents.txt protocols. Use when finding MCP servers, searching agent registries, validating agents.txt files, looking up agent capabilities across protocols, or building multi-agent systems that need discovery. TypeScript MCP server.
---

# Global Chat — Cross-Protocol Agent Discovery

Search and discover AI agents across MCP, A2A, agents.txt, and other protocols from a single MCP server. Aggregates 18K+ MCP servers across 6+ registries with cross-search.

## When to Use

- Finding MCP servers for a specific capability or domain
- Searching agent registries across multiple protocols
- Validating an agents.txt file against the specification
- Looking up agent metadata, endpoints, or capabilities
- Building multi-agent systems that need runtime discovery

## Quick Start

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

No API key required. Works with Copilot, VS Code, Claude Code, Cursor, and any MCP client.

## Available Tools

| Tool | Purpose |
|------|---------|
| `search_mcp_servers` | Search across 18K+ MCP servers by keyword, category, or capability |
| `get_mcp_server` | Get detailed info for a specific MCP server (config, tools, setup) |
| `search_a2a_agents` | Search agents using Google's Agent-to-Agent protocol |
| `validate_agents_txt` | Validate an agents.txt file against the specification |
| `get_agents_txt` | Fetch and parse an agents.txt file from any domain |

## Example Workflows

### Find MCP servers for a task

```
Agent: "I need to interact with GitHub repositories"
→ search_mcp_servers({ query: "github" })
→ Returns matching servers with install configs
```

### Validate agents.txt before deploying

```
Agent: "Check if our agents.txt is valid"
→ validate_agents_txt({ url: "https://example.com/agents.txt" })
→ Returns validation results with errors and warnings
```

### Discover A2A agents

```
Agent: "Find agents that can process invoices"
→ search_a2a_agents({ query: "invoice processing" })
→ Returns A2A-compatible agents with endpoints
```

## Supported Protocols

| Protocol | Description |
|----------|-------------|
| MCP | Model Context Protocol — tool integration for LLMs |
| A2A | Google Agent-to-Agent — inter-agent communication |
| agents.txt | Web standard for publishing agent capabilities |

## Resources

- Website: https://global-chat.io
- npm: https://www.npmjs.com/package/@global-chat/mcp-server
- GitHub: https://github.com/pumanitro/global-chat
- agents.txt validator: https://global-chat.io/agents-txt
