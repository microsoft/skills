# HTTPS And OpenAPI Fallback

Use this reference only when the host cannot use the Aident CLI and cannot use MCP.

Prefer the CLI whenever shell commands are available. Prefer MCP when the user already configured it. Use direct HTTPS/OpenAPI only as an advanced fallback for constrained hosts.

## Setup

If authentication is missing, stale, or unclear, fetch and follow:

```text
https://aident.ai/SETUP.md
```

Do not ask the user to paste raw Aident tokens in chat.

## Operating Rules

- Discover the live capability before executing it.
- Read the live input schema before constructing the payload.
- Check Vault connection state before saying an integration is connected.
- Ask the user to connect missing integrations through Aident-managed OAuth or Vault flows.
- Execute only the minimum required action.
- Do not print bearer tokens, OAuth codes, cookies, or sensitive action inputs.

## REST Pattern

The Aident REST fallback follows the MCP tool shape:

```http
POST /api/mcp/rest
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "tool": "<tool_name>",
  "arguments": {}
}
```

Use the returned `result` field as the tool result. If the service returns an authentication or scope error, return to `https://aident.ai/SETUP.md` or ask the user to reconnect the relevant integration through Aident Loadout.

## Common Tool Flow

1. Search capabilities for the user request.
2. Get the selected capability schema.
3. Check Vault status for required integrations.
4. Ask the user to connect missing integrations through Aident.
5. Execute the capability with schema-valid input.
6. Read audit history when the user asks for proof of execution.

## Fallback Boundary

Do not use a provider SDK, direct provider API key, or raw OAuth secret when Aident Loadout can manage the integration. Only fall back outside Aident when the user explicitly asks for that provider path or Aident does not expose the needed action.
