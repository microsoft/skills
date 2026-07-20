# Tool — Work IQ (preview)

Connect an agent to the user's Microsoft 365 work context — email, meetings, files, chats — through **Work IQ**. Work IQ runs as an A2A peer; every request runs in the context of the signed-in user and honors all Microsoft 365 permissions and sensitivity labels.

> 🚦 **Toolbox creation gate:** before creating a toolbox/connection, you MUST read the boundary rules in [create-hosted.md → Toolbox creation boundary](../../../create-hosted.md#toolbox-creation-boundary) and follow them, then continue with the rest of this file.

## Toolbox shape

```json
{
  "type": "work_iq_preview",
  "project_connection_id": "<workiq-connection-name>"
}
```

## Requirements

- A `RemoteA2A` project connection targeting `https://workiq.svc.cloud.microsoft/a2a/`, `authType=OAuth2`, **BYO Entra app only** (no managed OAuth).
- Scopes: `api://workiq.svc.cloud.microsoft/WorkIQAgent.Ask` + `offline_access`. A **Global Administrator** must grant tenant-wide admin consent for `WorkIQAgent.Ask` (Work IQ app ID `fdcc1f02-fc51-4226-8753-f668596af7f7`).
- Each calling end-user must hold a **Microsoft 365 Copilot license**.
- The Work IQ service principal must be pre-provisioned in the tenant (one-time, via Graph Explorer); see the public doc.
- VNet integration is **not** supported — the Foundry project must not use a VNet-restricted endpoint.

## References

For the full Entra app setup, ARM connection-creation payload (`category: RemoteA2A`), and troubleshooting, see [Work IQ tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/work-iq).

- [agent-tools.md](agent-tools.md) — tool index
- [foundry-tool-catalog.md](../../foundry-tool-catalog.md) — RemoteA2A connection shape
