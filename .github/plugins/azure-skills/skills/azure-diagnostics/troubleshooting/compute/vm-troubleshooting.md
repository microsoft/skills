# Azure VM Connectivity Troubleshooting

Primary compute troubleshooting guide for incidents routed from [../../SKILL.md](../../SKILL.md). Use for Azure VM RDP/SSH failures, NSG/firewall blocks, credential resets, and VM agent/tooling issues.

## Quick Reference

| Property | Details |
| --- | --- |
| Best for | RDP/SSH failures, port 3389/22 timeouts, black screen, credential reset, VM agent issues |
| Primary tools | `mcp_azure_mcp_compute`, `mcp_azure_mcp_resourcehealth`, `mcp_azure_mcp_monitor`, CLI fallback |
| Router | [references/cannot-connect-to-vm.md](references/cannot-connect-to-vm.md) |

## MCP Tools

| Tool | Purpose |
| --- | --- |
| `mcp_azure_mcp_compute` | VM state, instance view, VM agent, extension, NIC evidence |
| `mcp_azure_mcp_resourcehealth` | Platform health before deeper diagnosis |
| `mcp_azure_mcp_monitor` | Logs/metrics when workspace or resource scope is known |
| `mcp_azure_mcp_documentation` | Current Microsoft Learn guidance for the matched symptom |

## When to Use

- "can't connect to my VM", "can't RDP", "can't SSH"
- RDP/SSH timeout, refused, black screen, internal error, session drop
- reset VM password, wrong credentials, access denied
- NSG, guest firewall, port 3389/22, public IP, NIC, Serial Console, Run Command, VM agent

## Guardrails

- Default to read-only diagnostics; quote evidence before concluding root cause.
- Do not run extension-backed commands (`az vm user update`, `az vm user reset-ssh`, `az vm user reset-remote-desktop`, `az vm run-command invoke`) until [Pre-Flight Safety Checks](references/cannot-connect-to-vm.md#pre-flight-safety-checks) pass.
- Do not restart, redeploy, deallocate, or delete unless the user explicitly approves remediation.
- If multiple issues appear, fix network-layer blockers before agent-dependent fixes.

## Evidence Order

1. VM state: power, provisioning, VM agent, extension states.
2. Network layer: public IP, NIC/subnet NSGs, effective routes, IP flow.
3. Guest OS: services and firewall via Run Command only when agent checks are safe.

## Workflow

1. Classify intent. If unclear, ask whether the user uses RDP or SSH and what error appears.
2. Open [references/cannot-connect-to-vm.md](references/cannot-connect-to-vm.md), choose the matching symptom category, then open that reference.
3. If a command uses the VM agent/extensions, run pre-flight checks first and stop on any unsafe result.
4. Use `mcp_azure_mcp_documentation` to fetch current docs for the selected URL or symptom.
5. Respond with evidence, likely cause, safe diagnostic/fix commands, and escalation path.

```yaml
mcp_azure_mcp_documentation
  intent: "find current Azure VM RDP SSH troubleshooting docs for <symptom>"
  parameters:
    query: "<documentation URL or user's symptom>"
```

## Error Handling

| Error | Action |
| --- | --- |
| Docs lookup empty | Use the reference quick commands and tell user the doc URL may have changed |
| VM name/resource group wrong | Ask user to verify resource identity |
| Run Command timeout or `VMAgentStatusCommunicationError` | Do not run extension commands; use Serial Console/offline repair |
| Serial Console unavailable | Enable Boot Diagnostics first |
| Password reset fails | Check VMAccess alternatives in the credential and VM agent references |
| Extension stuck updating | Do not add extensions; use Portal/Serial Console/offline repair |