# Tool — Agent-to-Agent (A2A) connection

Create the `remote-a2a` connection that lets your agent call another A2A-compatible agent as a tool. The peer can be another Foundry agent or any external service that implements the A2A protocol.

## Create the connection

```bash
azd ai connection create <conn-name> \
  --kind remote-a2a \
  --target <A2A_BASE_URL> \
  --auth-type <auth-type> \
  [--audience <token-audience>] \
  [--key <api-key>] \
  [--metadata KEY=VALUE ...]
```

### Foundry peer

`$TARGET_AGENT_A2A_ENDPOINT` is `https://<account>.services.ai.azure.com/api/projects/<project>/agents/<peer>/endpoint/protocols/a2a`.

#### Pick an auth type

| `--auth-type` | Identity passed to the peer | RBAC |
|---|---|---|
| `user-entra-token` | End user's Entra token, passed through | Grant the **end user's** identity the **Foundry Agent Consumer** role (least privilege) on the peer project |
| `agentic-identity` | Calling agent's own identity | Grant the **calling agent's** identity the **Foundry Agent Consumer** role on the peer project |

#### Create the connection

```bash
azd ai connection create $CONNECTION_NAME \
  --project-endpoint $PROJECT_ENDPOINT \
  --kind remote-a2a \
  --target $TARGET_AGENT_A2A_ENDPOINT \
  --auth-type <user-entra-token | agentic-identity> \
  --audience "https://ai.azure.com" \
  --metadata "ApiType=Azure" \
  --metadata "type=custom_A2A" \
  --metadata "AgentCardPath=/agentCard/v1.0"
```

## References

- [A2A tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/agent-to-agent)
