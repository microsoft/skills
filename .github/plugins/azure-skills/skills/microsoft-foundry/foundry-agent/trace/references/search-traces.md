# Search Traces — Conversation-Level Search

Search agent traces at the conversation level. Returns summaries grouped by conversation or operation, not individual spans.

## Prerequisites

- App Insights resource resolved (see [trace.md](../trace.md) Before Starting)
- Selected agent root, environment, effective context source, and metadata overlay confirmed
- Time range confirmed with user (default: last 24 hours)

## Search by Conversation ID

Keep the selected environment visible in the summary, and add the selected agent name or environment tag filters when the telemetry emits them.

```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.conversation.id"] == "<conversation_id>"
| project timestamp, name, duration, resultCode, success,
    operation = tostring(customDimensions["gen_ai.operation.name"]),
    model = tostring(customDimensions["gen_ai.request.model"]),
    inputTokens = toint(customDimensions["gen_ai.usage.input_tokens"]),
    outputTokens = toint(customDimensions["gen_ai.usage.output_tokens"]),
    operation_Id, id, operation_ParentId
| order by timestamp asc
```

## Search by Response ID

Auto-detect the response ID format to determine agent type:
- `caresp_...` → Hosted agent (AgentServer)
- `resp_...` → Prompt agent (Foundry Responses API)
- `chatcmpl-...` → Azure OpenAI chat completions

```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.response.id"] == "<response_id>"
| project timestamp, name, duration, resultCode, success,
    operation = tostring(customDimensions["gen_ai.operation.name"]),
    model = tostring(customDimensions["gen_ai.request.model"]),
    inputTokens = toint(customDimensions["gen_ai.usage.input_tokens"]),
    outputTokens = toint(customDimensions["gen_ai.usage.output_tokens"]),
    operation_Id, id, operation_ParentId
```

Then drill into the full conversation:

> ⚠️ **STOP — read [Conversation Detail](conversation-detail.md) before writing your own drill-down query.** It contains the correct span tree reconstruction logic, event/exception queries, and eval correlation steps.

Quick drill-down using the `operation_Id` from above:

```kql
dependencies
| where operation_Id == "<operation_id_from_above>"
| project timestamp, name, duration, resultCode, success,
    spanId = id, parentSpanId = operation_ParentId,
    operation = tostring(customDimensions["gen_ai.operation.name"]),
    model = tostring(customDimensions["gen_ai.request.model"]),
    inputTokens = toint(customDimensions["gen_ai.usage.input_tokens"]),
    outputTokens = toint(customDimensions["gen_ai.usage.output_tokens"]),
    responseId = tostring(customDimensions["gen_ai.response.id"]),
    errorType = tostring(customDimensions["error.type"]),
    toolName = tostring(customDimensions["gen_ai.tool.name"])
| order by timestamp asc
```

Also check for eval results: see [Eval Correlation](eval-correlation.md).

## Search by Agent Name

> **Note:** For hosted agents, `gen_ai.agent.name` in `dependencies` refers to *sub-agents* (e.g., `BingSearchAgent`), not the top-level hosted agent. See "Search by Hosted Agent Name" below.

> 💡 **Hosted-agent versioning:** If you need the deployed version, use the hosted-agent pattern below and parse `gen_ai.agent.id` when it is emitted in `<agent-name>:<version>` format.

```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.agent.name"] == "<agent_name>"
| summarize
    startTime = min(timestamp),
    endTime = max(timestamp),
    totalDuration = max(timestamp) - min(timestamp),
    spanCount = count(),
    errorCount = countif(success == false),
    totalInputTokens = sum(toint(customDimensions["gen_ai.usage.input_tokens"])),
    totalOutputTokens = sum(toint(customDimensions["gen_ai.usage.output_tokens"]))
  by conversationId = tostring(customDimensions["gen_ai.conversation.id"]),
     operation_Id
| order by startTime desc
| take 50
```

## Search by Hosted Agent Name

For hosted agents, the Foundry agent name (e.g., `hosted-agent-022-001`) appears on `requests` and `traces` — NOT on `dependencies`. Use `requests` as the preferred entry point, materialize the matching request rows, then join downstream spans on `operation_Id`:

```kql
let agentRequests = materialize(
    requests
| where timestamp > ago(24h)
| extend
    foundryAgentName = coalesce(
        tostring(customDimensions["gen_ai.agent.name"]),
        tostring(customDimensions["azure.ai.agentserver.agent_name"])
    ),
    agentId = tostring(customDimensions["gen_ai.agent.id"]),
    agentNameFromId = tostring(split(agentId, ":")[0]),
    agentVersion = iff(agentId contains ":", tostring(split(agentId, ":")[1]), ""),
    conversationId = coalesce(
        tostring(customDimensions["gen_ai.conversation.id"]),
        tostring(customDimensions["azure.ai.agentserver.conversation_id"]),
        operation_Id
    )
| where foundryAgentName == "<agent_name>"
    or agentNameFromId == "<agent_name>"
| project operation_Id, conversationId, agentVersion
);
dependencies
| where timestamp > ago(24h)
| where isnotempty(customDimensions["gen_ai.operation.name"])
| join kind=inner agentRequests on operation_Id
| summarize
    startTime = min(timestamp),
    endTime = max(timestamp),
    spanCount = count(),
    errorCount = countif(success == false),
    totalInputTokens = sum(toint(customDimensions["gen_ai.usage.input_tokens"])),
    totalOutputTokens = sum(toint(customDimensions["gen_ai.usage.output_tokens"]))
  by conversationId, operation_Id, agentVersion
| order by startTime desc
| take 50
```

If `gen_ai.agent.id` does not contain `:`, continue using the requests-scoped name fields for filtering and treat `agentVersion` as optional enrichment rather than a required key.

## Conversation Summary Table

Present results in this format:

| Conversation ID | Agent Version | Start Time | Duration | Spans | Errors | Input Tokens | Output Tokens |
|----------------|---------------|------------|----------|-------|--------|-------------|---------------|
| conv_abc123 | 3 | 2025-01-15 10:30 | 4.2s | 12 | 0 | 850 | 320 |
| conv_def456 | 4 | 2025-01-15 10:25 | 8.7s | 18 | 2 | 1200 | 450 |

Highlight rows with errors in the summary. Offer to drill into any conversation via [Conversation Detail](conversation-detail.md).

## Free-Text Search

When the user provides a general search term (e.g., agent name, error message):

```kql
union dependencies, requests, exceptions, traces
| where timestamp > ago(24h)
| where * contains "<search_term>"
| summarize count() by operation_Id
| order by count_ desc
| take 20
```

## After Successful Query

> 📝 **Reminder:** If this is the first trace query in this session, ensure App Insights connection info was persisted to the selected metadata file for the selected environment (see [trace.md — Before Starting](../trace.md#before-starting--resolve-app-insights-connection)).
