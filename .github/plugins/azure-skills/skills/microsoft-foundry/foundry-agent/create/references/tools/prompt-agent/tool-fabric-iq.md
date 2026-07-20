# Tool — Fabric IQ (preview)

Connect an agent to Microsoft Fabric data — Ontology, Fabric data agents, and Power BI semantic models — through **Fabric IQ**. The agent delegates natural-language questions; Fabric IQ runs them against the enterprise ontology (NL2Ontology) and returns synthesized answers under the signed-in user's Fabric permissions.

## Toolbox shape

```json
{
  "type": "fabric_iq_preview",
  "project_connection_id": "<fabriciq-connection-name>",
  "server_label": "<short-lowercase-label>",
  "server_url": "https://<host>/v1/mcp/..."
}
```

## `server_url` by Fabric item type

| Fabric item | `server_url` pattern | Supported auth |
|---|---|---|
| Ontology | `https://{host}/v1/mcp/dataPlane/workspaces/{workspaceId}/items/{itemId}/ontologyEndpoint` | BYO Entra app only |
| Fabric data agent | `https://{host}/v1/mcp/workspaces/{workspaceId}/dataagents/{dataAgentId}/agent` | BYO Entra app *or* managed OAuth |
| Power BI semantic model | `https://{host}/v1/mcp/fabricaihub/integrations/m365` | BYO Entra app *or* managed OAuth |

## Requirements

- Microsoft Fabric license for both the developer and every calling end-user.
- For Ontology / Power BI: Entra app with delegated Power BI permissions `Item.Execute.All` + `Item.Read.All`; tenant admin consent required. For Data Agent: `DataAgent.Execute.All`.
- Each Fabric item must be **published** before it can be consumed through Fabric IQ.
- VNet integration is **not** supported.
- Tip: for Power BI semantic models, use latest models — measure/hierarchy reasoning benefits significantly.

## References

For the full Entra app setup, connection-creation walkthrough, and troubleshooting, see [Fabric IQ tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/fabric-iq).

- [agent-tools.md](agent-tools.md) — tool index
- [foundry-tool-catalog.md](../../foundry-tool-catalog.md) — connection shape for Fabric IQ
