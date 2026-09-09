# Troubleshooting

Use this reference for authentication, missing integrations, unavailable tools, connection timeouts, or credential-file problems.

## First Checks

1. Confirm whether the host can run shell commands.
2. If yes, prefer CLI checks:

   ```bash
   aident --help
   aident doctor
   aident whoami
   ```

3. If the user is configuring MCP, confirm the server URL is exactly:

   ```text
   https://loadout.aident.ai/mcp
   ```

4. If setup is incomplete, fetch and follow:

   ```text
   https://aident.ai/SETUP.md
   ```

## Missing Or Disconnected Integrations

Do not infer connection state from catalog availability. Use Vault status:

```bash
aident vault status --integrationIds <integration-id> --json
```

If the integration is available but disconnected, ask the user to connect it through Aident:

```bash
aident vault connect --integrationId <integration-id> --json
```

Send the returned connect URL when the CLI provides one. Do not ask for raw provider secrets in chat when Vault can manage the connection.

## Capability Schema Errors

When execution fails because the payload shape is wrong:

```bash
aident capabilities get --name <capability-name> --json
```

Revise the input to match the live schema and retry once. Prefer the fetched schema over examples in static docs.

## Auth Errors

If the CLI reports that the user is not authenticated, run:

```bash
aident login
aident whoami
```

If MCP auth fails, ask the user to reconnect the Aident MCP server in their MCP client. OAuth should happen in the browser; do not ask the user to paste tokens into chat.

## CLI Unavailable

If the `aident` command is missing or broken, fetch and follow `https://aident.ai/SETUP.md`. The setup guide installs or repairs the Aident CLI and verifies access.

## Reporting A Blocker

When still blocked after one recovery pass, report:

- The exact command or MCP operation attempted.
- The summarized error message.
- Whether setup, auth, Vault connection, capability schema, or execution failed.
- The next user action needed, such as completing browser login or connecting an integration in Aident Loadout.
