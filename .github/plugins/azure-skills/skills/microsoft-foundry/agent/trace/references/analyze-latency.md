# Analyze Latency — Find and Diagnose Slow Traces

Identify slow agent traces, find bottleneck spans, and correlate with token usage.

## Step 1 — Find Slow Conversations

> ⚠️ **Hosted agents:** `gen_ai.agent.name` on `dependencies` holds the **code-level class name** (e.g., `BingSearchAgent`), NOT the Foundry agent name. To scope by Foundry name, use the [Hosted Agent Variant](#hosted-agent-variant--latency) below.

```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.operation.name"] == "invoke_agent"
| project timestamp, duration, success,
    agentName = tostring(customDimensions["gen_ai.agent.name"]),
    conversationId = tostring(customDimensions["gen_ai.conversation.id"]),
    operation_Id
| summarize
    totalDuration = sum(duration),
    spanCount = count(),
    hasErrors = countif(success == false) > 0
  by conversationId, operation_Id
| where totalDuration > 5000
| order by totalDuration desc
| take 50
```

> **Default threshold:** 5 seconds. Ask the user for their latency threshold if not specified.

## Step 2 — Latency Distribution (P50/P95/P99)

```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.operation.name"] in ("chat", "invoke_agent")
| summarize
    p50 = percentile(duration, 50),
    p95 = percentile(duration, 95),
    p99 = percentile(duration, 99),
    avg = avg(duration),
    count = count()
  by operation = tostring(customDimensions["gen_ai.operation.name"]),
     model = tostring(customDimensions["gen_ai.request.model"])
| order by p95 desc
```

Present as:

| Operation | Model | P50 (ms) | P95 (ms) | P99 (ms) | Avg (ms) | Count |
|-----------|-------|---------|---------|---------|---------|-------|

## Step 3 — Bottleneck Breakdown

For a specific slow conversation, break down time spent per span type:

```kql
dependencies
| where operation_Id == "<operation_id>"
| extend operation = tostring(customDimensions["gen_ai.operation.name"])
| summarize
    totalDuration = sum(duration),
    spanCount = count(),
    avgDuration = avg(duration)
  by operation, name
| order by totalDuration desc
```

Common bottleneck patterns:
- **`chat` spans dominate** → LLM inference is slow (consider smaller model or caching)
- **`execute_tool` spans dominate** → Tool execution is slow (optimize tool implementation)
- **`invoke_agent` has long gaps** → Orchestration overhead (check agent framework)

## Step 4 — Token Usage vs Latency Correlation

```kql
dependencies
| where timestamp > ago(24h)
| where customDimensions["gen_ai.operation.name"] == "chat"
| extend
    inputTokens = toint(customDimensions["gen_ai.usage.input_tokens"]),
    outputTokens = toint(customDimensions["gen_ai.usage.output_tokens"])
| where isnotempty(inputTokens)
| project duration, inputTokens, outputTokens,
    model = tostring(customDimensions["gen_ai.request.model"]),
    operation_Id
| order by duration desc
| take 100
```

High token counts often correlate with high latency. If confirmed, suggest:
- Reduce system prompt length
- Limit conversation history window
- Use a faster model for simpler queries

## Hosted Agent Variant — Latency

For hosted agents, scope by Foundry agent name via `requests` then join to `dependencies`:

```kql
let reqIds = requests
| where timestamp > ago(24h)
| where customDimensions["gen_ai.agent.name"] == "<foundry-agent-name>"
| distinct id;
dependencies
| where timestamp > ago(24h)
| where operation_ParentId in (reqIds)
| where customDimensions["gen_ai.operation.name"] in ("chat", "invoke_agent")
| summarize
    p50 = percentile(duration, 50),
    p95 = percentile(duration, 95),
    p99 = percentile(duration, 99),
    avg = avg(duration),
    count = count()
  by operation = tostring(customDimensions["gen_ai.operation.name"]),
     model = tostring(customDimensions["gen_ai.request.model"])
| order by p95 desc
```
