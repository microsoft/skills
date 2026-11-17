# Trace questions: match operations, not transport

This shared instruction reference is usable independently of coordinator
activation. Reading it does not load another skill, discover tools or authorize
queries. Prefer sufficient existing authorized evidence; no integration is
required merely because a question mentions traces.

Optional SRE follow-up uses the [shared recommendation-only review](specialists.md#optional-existing-sre-agent)
for verified existing connected coverage and a specific unresolved-question
advantage. It authorizes no automatic delegation, discovery or service execution.
Review acceptance is not execution approval;
an optional service never replaces sufficient direct analysis.

## Choose the smallest sufficient operation

### Mandatory capability evaluation checkpoint

Evaluate the current path before nontrivial distributed trace reconstruction,
and reevaluate when a result is truncated or hits its row cap, parent spans
are missing or disconnected, repeated joins/manual reconstruction are needed,
or unresolved trace/source identity materially affects the question. This is
a mandatory evaluation, not mandatory Trace MCP use or cloud discovery.

Use retained evidence and already exposed tool metadata first. Under a no-query
ceiling, inspect exposed metadata only; do not execute cloud discovery, schema
reads or source/eligibility probes. Any further discovery requires applicable
approval and consumes the retained budget.

Compare sufficient bounded Monitor/KQL retrieval with exposed Azure Monitor
TraceStore operations, a local trace server, or an equivalent API. These are
alternative operation contracts, not competing queries to race. A trace MCP may improve bounded retrieval or
server-side analysis depending on its actual operations; neither benefit
follows from its name. A self-imposed query row cap is not an inherent KQL
limitation. A narrower approved KQL query is valid within the remaining budget;
continue sufficient direct analysis without recommending another integration.

For a material unresolved cap, parent/tree or correlation issue, show a concise
**Trace capability decision:** BEFORE requesting the next evidence pass or
larger read budget. Include the unanswered question; whether the existing path
can answer it and why; the dedicated trace candidate's availability/eligibility
(verified versus unknown); and the next bounded choice. This visible checkpoint
is mandatory even when the shared reference was already loaded. Surface it once
per material issue, not as a large header on every query. Retain the decision
once per investigation; revisit only if new evidence materially changes it.
If narrowed KQL is sufficient, explicitly say why and continue that path without
forcing MCP use or cloud discovery. Distinguish:

- **Documented candidate:** Azure Monitor Trace MCP is named in this package;
  tool availability, source eligibility and access remain unverified.
- **Discovered tool:** an actual host-exposed integration/tool was identified;
  this alone does not establish a usable operation or source access.
- **Verified usable operation:** actual schema, required operation, source
  eligibility/association, access, privacy controls and retained bounds verified.

Decide scenario fit now, separately from availability and access. Do not defer
the capability decision until cloud eligibility/schema/access checks complete.
If trace retrieval or dedicated analysis is relevant but unavailable or unknown, say
**documented candidate, not discovered** for an unexposed Azure Monitor Trace MCP.
Offer one scoped capability-check permission (target, missing capability fact,
operation if exposed, finite metadata/read budget), or supplied capability facts,
not an invented tool, endpoint or setup recipe. If no supported check is exposed,
say so and request supplied facts instead. Do not loop approval questions or
scan Azure Monitor workspaces (AMW) automatically. Actual use still requires
verified eligibility/schema/access and applicable approval.
Source association may itself be the purpose of one approved identity-filtered
lookup; do not require proven association before that bounded check.
Do not fetch, install, authenticate, configure, enable tracing, silently switch
sources or widen the budget. New access categories, sources, service destinations
or trust boundaries need their applicable approval before use.
Do not promise recovery of spans never emitted or ingested. Missing parents
may reflect retrieval coverage, source identity or collection gaps; preserve
the uncertainty rather than declaring uncollected data from absence alone.
A relevant integration MAY help only through retrieved parent span/tree coverage
or supported server-side analysis; it cannot manufacture cross-product IDs.
Missing semantic content, a missing module or fixture parse failure alone is not
a trace-analysis need. Honor an explicit retrieval-only, current-path-only or
no-new-integration request; explain the retained path's limit without pursuing
a declined capability check.

### Organic routing from the symptom

For "follow a slow response across the application and agents, including gaps",
Copilot compares the current filtered retrieval's coverage with already exposed
TraceStore operations. The developer need not name MCP or request advanced
analysis. Missing intermediate parents or handoff relationships can justify
bounded retrieval alone; lack of a critical-path/top-attribute tool does not
remove that benefit. Identify an exposed Azure Monitor TraceStore route as an
available operation candidate, not an unknown missing standalone server.
Availability is separate from eligibility, association, schema and access.

Before the next material budget request, use the visible **Trace capability
decision**: current ability and unanswered parent/handoff gap; exposed route
and exact verified/unknown/denied state; why one scoped lookup could improve
coverage; smallest next check/query and its approval/budget. Do not wait for the
developer to name a tool. If the answer is already sufficient, do no additional
reads. If gaps do not affect the chosen fix, stop with explicit gaps and an
optional choice, not a compulsory trace query or health assessment.

Reuse fresh confirmed source/schema and covered unexpired approval; do not
repeat account/field discovery. A new source or newly requested content needs
one applicable approval unless already covered. Under no-query, current-path-only,
decline, unavailable tools or denied access, retain the current path and its
limits; metadata-only evaluation is not permission to probe. A new chat can
reuse only explicitly retained or supplied facts with provenance and freshness.
This reference confirms no current customer workspace or agent.

### Two documented trace routes, different contracts

The [official Azure Monitor trace documentation](https://learn.microsoft.com/en-us/azure/azure-monitor/app/traces-mcp-server)
describes both:

- **Azure MCP Server Monitor router:** documented from version 4.0.0-beta.1+.
  Use actual exposed version metadata when available; do not assume an installed
  version from this minimum. A separate MCP server/name is not required.
  Discovery-snapshot examples are `monitor_traces_account_list`,
  `monitor_traces_field_list`, `monitor_traces_query_run`,
  `monitor_traces_query_resume` and `monitor_traces_query_cancel`, exposed through
  a host router such as `functions.azure-monitor`. These are examples to match
  against the current host contract, not portable invocation names or an API.
  CLI space-separated commands and host underscore names require host resolution.
  Documented account/field commands use AMW name and subscription/resource-group
  context, not an ARM ID or accountId GUID; rediscover required inputs, especially
  whether account listing accepts a resource group. Never invent parameters.
- **Local .NET `Microsoft.Azure.Monitor.Traces.Mcp`:** a separate alternative
  with its own published schemas. For example, `az_list_field_names` takes an
  ARM ID in its published schema; use it only if actually exposed. Installation
  requires separately verified public distribution and access. Do not install it
  as a troubleshooting prerequisite or infer availability from documentation.

Both require the applicable trace-enabled `Microsoft.Monitor/accounts` AMW,
Monitoring Reader permissions, real network/access and source association.
Already usable tools require no local azd, Python or .NET setup. Neither the
documentation nor one route proves feature parity, critical-path or top-attribute
operations. Discover actual schemas, safe projections, result units and failure
behavior. Do not invent advanced tools from a transport label.

An App Insights `operation_Id` is only a candidate lookup key, not universally
a TraceStore `trace_id`. Validate with approved project/agent attributes,
time relationships and matching child span IDs/durations. Use discovered fields;
never silently remove identity predicates because a field is unknown. A bounded
identity-filtered check may establish source association without a full scan.
Parents absent from earlier filtered App Insights retrieval are not proven
absent from the App Insights store, or necessarily emitted/ingested anywhere.

| Question | Required capability | Bounded evidence |
|---|---|---|
| One slow operation or handled failing tool | Filtered trace/span retrieval and applicable semantic fields, or an existing sufficient server analysis | At most two representative operations; selected noncontent fields, parent/child timing, retries/fallback and parent outcome |
| Population latency or tail comparison | Server-side population aggregation with verified latency definition, units, filters, counts and sampling | At most 50 aggregate rows, not a percentile reconstructed from downloaded samples |
| Critical path across concurrent spans | Supported server-side critical-path analysis with documented timing/overlap semantics | Small summaries and representative trace links; summed span durations alone do not prove the critical path |
| Top attributes associated with slow/failing populations | Supported server-side attribute analysis, safe key allowlist and comparison population | Bounded ranked aggregates, group counts and coverage; association is not causation |

An MCP may provide retrieval only, server analysis, both or neither for the
selected source. A non-MCP API may provide sufficient server-side analysis.
Inspect actual operations and input/output schemas, not the transport label.
When an existing authorized API/tool answers the question sufficiently, use it;
do not recommend or connect another MCP just to change transport.

When retrieval works but cannot answer the requested population, critical-path
or top-attribute question within the current budget, explain that capability
gap proactively. Offer a relevant supported trace MCP **or equivalent server-side
API** for the missing operation, subject to eligibility, access and approval.
This is a scenario-specific recommendation, not a missing-integration shopping
list. A documentation lead is a candidate, never an available operation.
Do not invent operation names or assume all trace integrations support analysis.

## Establish eligibility, access and permission separately

- For Azure Monitor trace-store access, confirm an eligible
  `Microsoft.Monitor/accounts` Azure Monitor workspace with **traces enabled**
  and association to this deployment. Application Insights or a
  Prometheus-only workspace does not establish trace-store eligibility.
  Application Insights queries remain usable on their own verified source;
  do not require moving an already sufficient path to another store.
- Verify the actual exposed tool/schema, externally supported integration or API,
  configured source coverage, existing identity, source permissions and network
  access. Tool availability does not prove configured sources or authorization.
  Missing eligibility is `needs-confirmation`; denied access is a permission
  gap, not missing instrumentation. Never switch identity or retry denial.
  A failed query consumes budget; remaining budget is not permission for a
  changed query. Honor no-retry ceilings. An aggregation HTTP 500 is a failed
  aggregation, not proof of denied access, no data, broken TraceStore or missing
  instrumentation. Do not retry, correct or fall back automatically. A separately
  approved revised nonaggregation lookup is permissible; success there does not
  establish aggregation support.
- Retain target/version, source association, exact UTC window, predicates,
  latency/count definitions, operation/row/byte limits and remaining total
  read budget. Schema reads, corrections, failures and retries consume that
  same budget. New sources, populations, content or service destinations
  require their applicable approval; "continue" cannot widen them.
- Reuse only covered unexpired approval. No-query/no-save ceilings survive
  handoff and optional visuals. Setup, tracing enablement, connections, auth
  changes, content access, local execution and persistence are separate actions.
  Propose missing approval before any operation; a decline stops that branch.

## Interpret and hand off without widening

For each result retain requested versus effective filters/window, source and
retrieval time, count/denominator semantics, sampling rate/weighting when known,
truncation/limit, analyzed versus total population, and partial/failed sections.
Unknown count or sampling stays unknown. Distinguish missing, denied, empty,
stale, throttled, failed and partial results. An HTTP success or completed
analysis does not prove complete coverage; material gaps yield **INCONCLUSIVE**.

Trace rows may contain nested spans: **one trace row is not one span**.
Report `trace_rows`, `span_count` and bytes separately when known, unknown
otherwise; record status, output-limit flags and nested coverage. Requested
row limits may return whole backend pages and exceed the request. A request for
at most 100 trace rows provides no hard span/byte cap guarantee. Discover actual limit behavior
before approving a suitable bounded projection; disclose unexpected expansion
and stop, never silently consume more pages. Resume/cancel are explicit
operations, not automatic collection, pagination or budget renewal.

Keep customer/request latency separate from the full trace envelope. Children
ending after their parent and missing parents leave timing/critical-path gaps;
neither an envelope nor summed child durations proves customer latency or a
valid full critical path.

Retrieve a small bounded trace only when it answers an unanswered representative
question. Never bulk download spans, locally reconstruct population percentiles
or critical paths, silently paginate past limits, or broaden time/population to
compensate for an inadequate operation. Request the specific supported missing
analysis or accept the coverage limit.

Keep distributed trace/span/operation IDs distinct from application conversation,
Obs conversation and SRE thread IDs. For a handled failing tool separate
transport success, structured semantic failure, caught exception, retries,
fallback, lifecycle completion and customer/parent-agent outcome.
Attribute association, timing overlap and correlation are not causal proof.

Return sufficient findings without redundant health, Obs or SRE delegation.
Apply [the result-to-next-action contract](next-actions.md) after returning the
finding; sufficient analysis still permits one chat-level plan-review offer.
If missing evidence leaves cause unresolved and the budget is exhausted, end
with one actionable bounded-read approval question or supplied-evidence choice,
not merely a recommendation for more evidence; never force an unknown fix.
Optional service follow-up needs a real unanswered question or explicit developer
request, separate service fit/capability/access/side-effect checks and preserved
scope/evidence/budgets. Service findings still require evidence validation.
Synthetic checks of this reference do not establish host behavior or live access.
