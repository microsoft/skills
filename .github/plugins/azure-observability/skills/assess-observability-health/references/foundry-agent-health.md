# Foundry-first agent health

Use this flow when a Microsoft Foundry agent, its runs, evaluations, models, or
tools are the subject of the health question.

Apply [public source/schema guidance](query-guidance.md) before queries and
[agent attribution and correlation](foundry-agent.md) when selecting child
spans. These specialize the single entry-point pass, not another assessment.

## Query order

Supplied-evidence analysis uses these procedures without resource discovery or
scripts. Live reads require discovered tool schemas/access and the existing
approved UTC window and total call/row budget, including metadata, schema probes,
failed reads and a permitted single correction. No new evaluation is required.
Treat names and fields below as schema-dependent examples; reuse established
scope/evidence and do not widen approval to complete every surface.

1. Resolve the project endpoint and exact agent/version with Foundry tools.
2. List project connections and resolve the linked Application Insights ARM ID.
3. In one parallel round, query compact approved-window summaries for agent invocations,
   `gen_ai.evaluation.result`, model calls, and tool/dependency spans.
4. If a material degradation appears, use one second parallel round to retrieve
   one representative trace plus directly correlated exceptions or evaluation
   explanation.
5. Build the focused agent-to-tool path, classify, rank, and respond.

## Fast-path command and topology rules

Resolve locators in this order and stop at the first authoritative source:

1. exact endpoint or ARM ID already in conversation state;
2. approved nonsecret deployment manifests/outputs (never environment dumps);
3. discovered agent and project-connection read equivalents with verified inputs;
4. one scoped Azure discovery call only when the endpoint or ARM ID remains
   unknown.

Use the applicable agent management surface rather than an unrelated inference
surface. Do not call the Application Insights management command surface
when the App Insights connection target and linked workspace are already
returned by project connections or an exact resource read. Inspect actual
available operation descriptions and input/output schemas once; reuse that
confirmed contract. `agent_get`, `project_connection_list` and
`monitor_workspace_log_query` were contributed examples, not fixed universal
names or tested shapes for this host. Missing/denied access is a distinct gap,
not permission to install tools, sign in, switch identity or request secrets.

When a repository manifest supplies a project endpoint and expected agent
names, use authorized discovered equivalents in the same topology
round. Treat the returned connection target as authoritative for the linked
Application Insights component.

Foundry agent definitions and project connections can return environment
variables or connection metadata containing instrumentation keys and connection
strings. Request only minimal nonsecret projections where supported; never
dump environment/configuration values. Do not request or reuse secrets to resolve
topology. Never quote, persist, or render them in chat, logs, or skill artifacts;
retain only the
verified resource ID, endpoint, agent/version, and non-secret configuration
needed for the assessment.

## Bounded query design

Cover the four surfaces in one parallel summary round within the remaining
approval budget; reuse sufficient supplied observations. Each query must
aggregate in KQL and return no more than 50 rows or the smaller approved limit.
Confirm component versus workspace query surface and actual columns before
using these workspace examples:

- `AppRequests`: group by agent and operation; count failures and summarize
  p50/p95/max latency and freshness.
- `AppEvents`: filter `Name == "gen_ai.evaluation.result"`; group by agent,
  evaluator, and label, and include result freshness.
- `AppDependencies`: filter model operations or model dimensions; summarize
  failures, 429s, content filtering, tokens, and latency.
- `AppDependencies`: filter tool operations and downstream HTTP dependencies;
  summarize transport failures, structured error codes, latency, freshness,
  and one representative operation/span.

Use `take_anyif(...)`, not `take_any_if(...)`. Across heterogeneous tables,
project span and parent identifiers with `column_ifexists()` rather than
assuming every table has `Id` and `ParentId`. Prefer one trace query using a
known `OperationId`; do not retrieve a broad raw result and parse it locally.

Model telemetry can contain multiple layers for one logical invocation, such as
`chat`, `invoke_agent`, gateway, and runtime spans. Do not sum those rows into a
logical call count or token total unless a stable span identity proves they are
distinct calls. Report per-layer health and latency, or select one canonical
model span type. Detect content filtering from an actual finish reason, status,
or error value; never search the serialized property bag for the
`content_filter` key because an empty or schema-default field creates false
positives.

If a result is too large, fix the server-side aggregation or projection once
only when correction is approved and budget remains.
Do not download the oversized result and run multiple local extraction scripts.
If a schema correction is permitted and budget remains, correct it once in the second telemetry
round and retain the remaining gap rather than adding another round.

Stop there. Schedule inventories, multiple trace samples, downstream
infrastructure diagnosis, deployment correlation, and causal reconstruction are
RCA work after the developer selects a finding.

Use `agent_insights_get` only when an Agent Insights monitor is already known to
exist. Insights are supplemental recurring-behavior analysis, not a prerequisite
for agent health. Do not probe every agent to discover monitor existence.

Do not use Azure Resource Graph when the Foundry project and linked Application
Insights resource are already resolved. Project connections plus trace-scoped
telemetry are sufficient for this health lens. Use ARG only for unresolved
material topology or an application-wide assessment, and do not retry it after
an access denial when known resource IDs suffice.

## Evaluation semantics

Extract these `AppEvents.Properties` fields:

- `gen_ai.agent.id` and `gen_ai.agent.name`;
- `gen_ai.conversation.id` when present;
- `gen_ai.evaluation.name`;
- `gen_ai.evaluation.score.label`;
- `gen_ai.evaluation.score.value`;
- `gen_ai.evaluation.explanation`.

Report evaluation coverage and freshness before interpreting scores. Fresh
result events are sufficient for the fast pass; do not also list many schedule
runs unless result freshness is ambiguous. Group results by domain:

- task and response quality;
- safety and security;
- tool-call behavior;
- customer or business outcome.

Aggregate evaluation output to one row per agent and evaluator with separate
`failed`, `passed`, and `other` counts plus one representative failed
explanation. Use `failed + passed` as the denominator for a pass/fail rate and
report `other` separately; do not treat every emitted result as a binary score.
If the explanation says an evaluator is unsupported in the region or otherwise
could not execute, classify those events as an evaluator coverage gap rather
than agent-quality failures.

Do not summarize mixed results as "evaluations are green." Passing response
quality or safety results can coexist with a failed tool-call-success evaluator,
timeout, fallback, or dependency error. The failed operational path controls its
health classification.

Completed evaluation schedules prove that runs executed, not that every
production trace was scored. Use result events and trace correlation to prove
coverage for the representative incident.

## Trace-scoped Azure enrichment

During Foundry-agent health, use linked Application Insights only to establish:

- agent run outcome and latency;
- model and tool spans;
- nested failures, retries, and fallbacks;
- representative trace, operation, span, and conversation IDs;
- resolved downstream Azure resource IDs.

Do not query broad AKS, Prometheus, Redis, Function, database, Resource Health,
or alert inventories until the developer selects a path or asks for
application-wide health. Preserve the resolved path internally so later analysis
can continue without rediscovery; do not add a visible handoff section.

When querying an Application Insights **component** resource, prefer the
component-native table names (`requests`, `dependencies`, `customEvents`,
`exceptions`, `traces`, `availabilityResults`). Use workspace `App*` names only
when querying the linked Log Analytics workspace. Probe one representative table
or inspect the query surface before issuing multiple schema calls. Do not run
`getschema` for every known component table up front; query the documented
columns directly and inspect an additional schema only after a concrete schema
error.

Avoid reserved or ambiguous aggregate aliases such as `latest`. Use explicit
names such as `latest_ts`, `first_ts`, and `last_ts` to prevent avoidable KQL
parse retries.

Representative operations can contain many duplicated gateway, runtime, model,
and request spans. A chronological `limit` can therefore omit the later child
failure that motivated the query. Filter the trace server-side to the agent,
tool, dependency, exception, and correlation fields needed for the affected
path, or summarize each relevant table before the final union. Preserve parent
and child span IDs. A dependency with `Success == false` remains failed even
when its result code is `0`, blank, or non-HTTP.

Resolve one root telemetry event for the representative operation, preferring
an `availabilityResults` item and then a root `requests` item. Capture its item
ID UUID, operation ID, exact timestamp including fractional seconds, and table.
Do not substitute the request/dependency `id` or a trace/span ID for `itemId`.
Optionally run the local `scripts/build_appinsights_trace_link.py` following
[transaction link inputs](transaction-links.md), only with approved interpreter
execution and already collected event inputs. Otherwise use the verified
component link; no new query solely for graphics or links. Use the resulting
end-to-end transaction link in developer-facing trace evidence instead of
printing the raw operation ID. Keep Foundry conversation IDs and raw
correlation IDs internal.

For hosted agents, a `404 NotFound` from container-status lookup does not prove
the container is unavailable. Stop after the first project-level unsupported
response and use enabled definitions plus fresh invocation spans. Report a
runtime coverage gap only when invocation telemetry is also absent.

Identify agent invocations with `gen_ai.agent.name` and
`gen_ai.operation.name` from custom dimensions when available. Do not rely only
on `cloud_RoleName`, because hosted-agent gateway and runtime rows may use
different role names.

## Coverage classification

Classify each surface independently:

- **Tracing coverage unknown:** no verified linkage or representative spans;
  distinguish missing association, denied reads, idle/empty and stale evidence.
- **Evaluation coverage gap:** no applicable existing definitions, recent runs,
  or result events demonstrated for the window. Never start evaluations to fill it.
- **Insights gap:** a discovered authorized read reports no monitor exists.
- **Protected-content gap:** required trace content is protected and the caller
  lacks the data-reader role.

A missing Insights monitor does not imply an evaluation or tracing gap.

## Agent Insights prerequisites

The contributed Agent Insights prerequisite list below is historical guidance;
verify current requirements and actual access only if this optional surface is
needed and the read is approved. It is not a mandatory agent-health dependency:

- a GPT-5 or newer GPT deployment for the judge model;
- connected Application Insights;
- recent representative traces;
- Monitoring Reader for the interactive user and the Foundry project managed
  identity;
- project identity access to the judge deployment; and
- Privileged Monitoring Data Reader when protected content is required.

Retrieving Insights is read-only. Creating the monitor, deploying a judge model,
assigning roles, running a scan, or enabling its schedule is a write operation
and requires explicit user approval.

References:

- [Use Insights in Foundry](https://learn.microsoft.com/azure/foundry/observability/how-to/agent-insights)
- [Monitor agents in Foundry](https://learn.microsoft.com/azure/foundry/observability/how-to/how-to-monitor-agents-dashboard)
- [Monitor AI agents with Application Insights](https://learn.microsoft.com/azure/azure-monitor/app/agents-view)
