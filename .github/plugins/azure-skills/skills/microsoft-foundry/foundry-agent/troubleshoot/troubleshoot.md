# Foundry Agent Troubleshoot

Troubleshoot and debug Foundry agents by collecting Hosted Agent logs with azd, discovering observability connections, and querying Application Insights telemetry.

## Quick Reference

| Property | Value |
|----------|-------|
| MCP servers | `azure` |
| Hosted Agent CLI | `azd ai agent show`, `sessions`, `monitor` |
| Related skills | `trace` (telemetry analysis) |
| Preferred query tool | `monitor_resource_log_query` (Azure MCP) — preferred over `azure-kusto` for App Insights |
| CLI references | `azd ai agent show`, `azd ai agent sessions`, `azd ai agent monitor`, `az cognitiveservices account connection` |

## When to Use This Skill

- Agent is not responding or returning errors
- Hosted agent version is not becoming active
- Need to view hosted-agent session logs
- Diagnose latency or timeout issues
- Query Application Insights for agent traces and exceptions
- Investigate agent runtime failures

## Workflow

### Step 1: Collect Agent Information

Use the project endpoint and agent name from the project context (see [Common Project Context Resolution](../../SKILL.md#agent-common-project-context-resolution)). Ask the user only for values not already resolved:
- **Project endpoint** — AI Foundry project endpoint URL
- **Agent name** — Name of the agent to troubleshoot

### Step 2: Identify a Hosted Agent

Treat an `azure.yaml` service with `host: azure.ai.agent` as Hosted. Run:

```bash
azd ai agent show --output json
```

If azd returns Hosted Agent details, proceed to Step 3. If the command fails for an identified Hosted Agent, diagnose the reported error instead of proceeding to Step 4. Proceed to Step 4 only when `azure.yaml` has no Hosted Agent service.

### Step 3: Retrieve Logs (Hosted Agents Only)

Hosted Agent logs are scoped to sessions. Use azd for session discovery and log retrieval.

> **`invocations_ws` agents:** use the client-supplied `agent_session_id` from the WebSocket upgrade URL. It is not created by `azd ai agent invoke`. Pass it to `azd ai agent monitor --session-id`. See the [invocations-ws skill](../invocations-ws/invocations-ws.md) for the URL contract.

1. **Check agent version status.** Use the result from Step 2 and verify that the deployed version is `active`.

2. **Read logs from the current session.** `monitor` automatically reuses the session saved by the last azd invoke:

   ```bash
   azd ai agent monitor --tail 100
   ```

3. **Select another session when needed.** If no session is saved or the user needs a different one, run:

   ```bash
   azd ai agent sessions list --output table
   azd ai agent monitor --session-id <session-id> --tail 100
   ```

   In multi-agent projects, add `--agent-name <service-name>` to `sessions list` and pass the service name positionally to `monitor`. Pass the same `--user-identity` used for invoke when header-based isolation is enabled.

4. **Choose the log stream.** Use `--follow` for live logs and `--type system` for container events:

   ```bash
   azd ai agent monitor --session-id <session-id> --follow
   azd ai agent monitor --session-id <session-id> --type system
   ```

5. **Interpret the logs.** Review `stdout`, `stderr`, and system events. Highlight errors and warnings.

If no session exists, use `azd ai agent invoke` to trigger the Hosted Agent only when remote invocation is within the user's request.

### Step 4: Discover Observability Connections

List the project connections to find Application Insights or Azure Monitor resources using the Azure CLI command documented at:
[az cognitiveservices account connection](https://learn.microsoft.com/en-us/cli/azure/cognitiveservices/account/connection?view=azure-cli-latest)

Refer to the documentation above for the exact command syntax and parameters. Look for connections of type `ApplicationInsights` or `AzureMonitor` in the output.

If no observability connection is found, inform the user and suggest setting up Application Insights for the project. Ask if they want to proceed without telemetry data.

### Step 5: Query Application Insights Telemetry

Use **`monitor_resource_log_query`** (Azure MCP tool) to run KQL queries against the Application Insights resource discovered in Step 4. This is preferred over delegating to the `azure-kusto` skill. Pass the App Insights resource ID and the KQL query directly.

> ⚠️ **Always pass `subscription` explicitly** to Azure MCP tools like `monitor_resource_log_query` — they don't extract it from resource IDs.

Use `* contains "<response_id>"` or `* contains "<agent_name>"` filters to narrow down results to the specific agent instance.

### Step 6: Summarize Findings

Present a summary to the user including:
- **Agent status** — Hosted Agent version status when available
- **Log errors** — key errors from hosted-agent session logs
- **Telemetry insights** — exceptions, failed requests, latency trends
- **Recommended actions** — specific steps to resolve identified issues

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Agent not found | Invalid agent name or project endpoint | Verify the `azure.yaml` service name and run `azd ai agent show` |
| Hosted Agent not active | Hosted Agent is still provisioning or failed | Check deployment status, identity permissions, and system logs, then recheck status |
| Session logs unavailable | The session does not exist or has not been invoked | Run `azd ai agent sessions list`; invoke with azd when authorized, then retry `monitor` |
| No saved session ID | azd has not persisted an invoke session | Select one from `azd ai agent sessions list` and pass `--session-id` |
| No observability connection | Application Insights not configured for the project | Suggest configuring Application Insights for the Foundry project |
| Kusto query failed | Invalid cluster/database or insufficient permissions | Verify Application Insights resource details and reader permissions |
| No telemetry data | Agent not instrumented or too recent | Check if Application Insights SDK is configured; data may take a few minutes to appear |

## Additional Resources

- [Foundry Hosted Agents](https://learn.microsoft.com/azure/ai-foundry/agents/concepts/hosted-agents?view=foundry)
- [Account Connection CLI Reference](https://learn.microsoft.com/en-us/cli/azure/cognitiveservices/account/connection?view=azure-cli-latest)
- [KQL Quick Reference](https://learn.microsoft.com/azure/data-explorer/kusto/query/kql-quick-reference)
- [Foundry Samples](https://github.com/microsoft-foundry/foundry-samples)
