# Verify the Requested Invocation's Stored Trace

Use after the requested remote smoke invocation of an ordinary prompt or hosted text agent, when the user asks to verify traces. Setup follows [Agent Tracing Setup](agent-tracing-setup.md); never make deployment success contingent on optional tracing.

## Capture Once

Before invoking, record UTC start time, selected environment/project, agent name/version, and intended component ARM ID. Afterwards record UTC end time and returned request, response, and conversation IDs when available. Reuse this invocation: do not make a second billed call just to generate tracing evidence.

Use the installed tool's supported output, not debug logging. Hosted azd raw output can expose identifiers; prompt invocation may stream text without headers/IDs even when `--output raw` is accepted. Do not fabricate identifiers or treat a locally chosen call ID as a remote trace ID.

## Query the Effective Destination

Read [Trace Analysis](../trace.md) and [Search Traces](search-traces.md) before constructing KQL. Prefer `monitor_resource_log_query` with explicit subscription and the resolved component resource ID. Display the query; select metadata only, not prompt/response content.

Scope to the captured UTC window with a small clock allowance, then match the returned response/conversation ID and selected agent. For hosted agents, resolve the Foundry-facing identity from `requests` using `gen_ai.agent.name`, `azure.ai.agentserver.agent_name`, or the name portion of `gen_ai.agent.id`. Carry matching `operation_Id` values into `dependencies`/other tables; dependency agent names can describe sub-agents instead.

Require fresh stored telemetry attributable to this specific invocation. If IDs are unavailable, require another unambiguous attribution, such as a sole invocation of the selected agent/version in the narrow window; otherwise report not verified. Old traces, aggregate counts, connection existence, a successful response, and local Agent Inspector output are insufficient.

Retry the same query for a bounded ingestion window (for example, up to five minutes at 20-30 second intervals). Do not invoke again. Distinguish:

| Observation | Report / next action |
|---|---|
| No effective connection or failed setup | Tracing not configured; show setup warning |
| Query denied | Human read access not confirmed; scoped approval/admin handoff |
| Wrong component/project binding | Configuration conflict; do not silently switch destinations |
| No fresh matching telemetry by deadline | Tracing not verified; investigate export/instrumentation or ingestion delay |
| Fresh matching operation | Tracing verified for this invocation; record operation ID and attribution |

Do not change authentication, network access, sampling, retention, or content capture to make the check pass.

## Report Separately

Keep deployment, invocation, human access, and tracing outcomes distinct. Include environment, agent/version, destination ARM ID, UTC window, and operation ID when verified. Report only nonsecret identifiers; do not copy credentials into metadata.

```text
Agent deployment: succeeded
Agent invocation: succeeded
Human trace access: confirmed
Tracing: verified for this invocation
Trace operation ID: <operation-id>
```

On optional failure, retain successful core results and print a warning with the actual cause and `Tracing: not configured` or `Tracing: not verified`. Resource/connection readiness never certifies ingestion.
