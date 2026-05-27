# Foundry Agent Trace Analysis

Analyze production traces for Foundry agents using Application Insights and GenAI OpenTelemetry semantic conventions. This skill provides structured KQL-powered workflows for a selected agent root and environment: searching conversations, diagnosing failures, and identifying latency bottlenecks.

## When to Use This Skill

USE FOR: analyze agent traces, search agent conversations, find failing traces, slow traces, latency analysis, trace search, conversation history, agent errors in production, debug agent responses, App Insights traces, GenAI telemetry, trace correlation, span tree, production trace analysis, evaluation results, evaluation scores, eval run results, find by response ID, get agent trace by conversation ID, agent evaluation scores from App Insights.

> **USE THIS SKILL INSTEAD OF** `azure-monitor` or `azure-applicationinsights` when querying Foundry agent traces, evaluations, or GenAI telemetry. This skill has correct GenAI OTel attribute mappings and tested KQL templates that those general tools lack.

> ⚠️ **DO NOT manually write KQL queries** for GenAI trace analysis **without reading this skill first.** This skill provides tested query templates with correct GenAI OTel attribute mappings, proper span correlation logic, environment-aware scoping, and conversation-level aggregation patterns.

## Quick Reference

| Property | Value |
|----------|-------|
| Data source | Application Insights (App Insights) |
| Query language | KQL (Kusto Query Language) |
| Related skills | `troubleshoot` (hosted-agent logs), `eval-datasets` (trace harvesting) |
| Preferred query tool | `monitor_resource_log_query` (Azure MCP) - use for App Insights KQL queries |
| OTel conventions | [GenAI Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/), [Agent Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) |
| Local metadata | selected `.foundry/agent-metadata*.yaml` overlay/cache file |

## Entry Points

| User Intent | Start At |
|-------------|----------|
| "Search agent conversations" / "Find traces" | [Search Traces](references/search-traces.md) |
| "Tell me about response ID X" / "Look up response ID" | [Search Traces - Search by Response ID](references/search-traces.md#search-by-response-id) |
| "Why is my agent failing?" / "Find errors" | [Analyze Failures](references/analyze-failures.md) |
| "My agent is slow" / "Latency analysis" | [Analyze Latency](references/analyze-latency.md) |
| "Show me this conversation" / "Trace detail" | [Conversation Detail](references/conversation-detail.md) |
| "Find eval results for response ID" / "eval scores from traces" | [Eval Correlation](references/eval-correlation.md) |
| "What KQL do I need?" | [KQL Templates](references/kql-templates.md) |
| "Auto-detect agent issues" / "Get automated insights" / "What's wrong with my agent?" | [Tracing Insights API](references/tracing-insights-api.md) |

## Before Starting — Resolve App Insights Connection

1. Resolve the target agent root, environment, effective deployment context, and selected metadata overlay using [Common Project Context Resolution](../../SKILL.md#agent-common-project-context-resolution).
2. In azd projects, prefer App Insights values from `azd env get-values`; otherwise check `environments.<env>.observability.applicationInsightsConnectionString` or `environments.<env>.observability.applicationInsightsResourceId` in the selected metadata file.
3. If observability settings are missing, use `project_connection_list` to discover App Insights linked to the Foundry project, then persist the chosen resource back to `environments.<env>.observability` only when azd cannot provide it.
4. Confirm the selected App Insights resource and environment with the user before querying.
5. Use **`monitor_resource_log_query`** (Azure MCP tool) to execute KQL queries against the App Insights resource. This is preferred over delegating to the `azure-kusto` skill. Pass the App Insights resource ID and the KQL query directly.

| Metadata field | Purpose | Example |
|----------------|---------|---------|
| `environments.<env>.observability.applicationInsightsConnectionString` | App Insights connection string | `InstrumentationKey=...;IngestionEndpoint=...` |
| `environments.<env>.observability.applicationInsightsResourceId` | ARM resource ID | `/subscriptions/.../Microsoft.Insights/components/...` |

> ⚠️ **Always pass `subscription` explicitly** to Azure MCP tools like `monitor_resource_log_query` - they do not extract it from resource IDs.

## Behavioral Rules

1. **Always display the KQL query.** Before executing any KQL query, display it in a code block. Never run a query silently.
2. **Keep environment visible.** Include the selected environment and agent name in each search summary, and include the derived agent version when the query can recover it from telemetry.
3. **Start broad, then narrow.** Begin with conversation-level summaries, then drill into specific conversations or spans on user request.
4. **Use time ranges.** Always scope queries with a time range (default: last 24 hours). Ask the user for the range if not specified.
5. **Explain GenAI attributes.** When displaying results, translate OTel attribute names to human-readable labels (for example, `gen_ai.operation.name` -> "Operation").
6. **Link to conversation detail.** When showing search or failure results, offer to drill into any specific conversation.
7. **Scope to the selected environment.** App Insights may contain traces from multiple agents or environments. Filter with the selected environment's agent name first, then add an environment tag filter if the telemetry emits one.
8. **Resolve hosted-agent identity from `requests` first.** For hosted agents, prefer `requests`-scoped `gen_ai.agent.name` or `azure.ai.agentserver.agent_name` as the Foundry-facing filter. When `gen_ai.agent.id` is emitted in `<agent-name>:<version>` format, parse it to surface `agentVersion`, but do not treat `dependencies.gen_ai.agent.name` as the top-level hosted-agent name.
9. **Use `operation_Id` to fan out hosted-agent traces.** After isolating the hosted-agent `requests` rows, materialize their `operation_Id` values and join other telemetry tables on `operation_Id`. When conversation IDs are sparse, use `coalesce(gen_ai.conversation.id, azure.ai.agentserver.conversation_id, operation_Id)` so every row still rolls up to a stable conversation key.
