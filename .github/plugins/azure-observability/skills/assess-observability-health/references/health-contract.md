# Production health classification contract

This is the canonical verdict, finding-state and ranking procedure for the
integrated assessment. Use [evidence and handoff](evidence.md) for source labels
and minimized retained context, not a second classification algorithm.

## Finding states

Overall verdict: `HEALTHY` requires fresh representative evidence across all
agreed core surfaces; `DEGRADED` needs supported current material degradation;
`INCONCLUSIVE` means core evidence is insufficient. Report supported findings
even when the overall verdict is INCONCLUSIVE. Distinguish missing, denied,
empty, stale, unsupported, failed, throttled and partial/truncated results.
None proves a collection gap or a healthy zero. Report sample/population and
source completeness limits. Do not invent confidence percentages or causation.
HEALTHY also requires applicable acceptance criteria and no unresolved material
contradiction. Idle traffic, provisioning success or parent transport success
alone cannot establish acceptable customer outcomes. Unknown thresholds permit
measurements, not invented regression/normal labels. Partial observations support
only their stated subset; preserve unknown completeness.

| State | Meaning |
| --- | --- |
| `active` | The signal occurs in the current/fresh portion of the window. |
| `recovered` | The signal occurred earlier and later representative checks pass. |
| `historical` | The signal is outside the primary window or no longer representative. |
| `degraded_success` | The parent operation completed by catching an error, retrying, or using fallback while a dependency failed. |
| `coverage_gap` | Monitoring cannot establish health for a material surface. |
| `healthy` | Fresh telemetry demonstrates normal operation. |

`recovered` is a within-window health finding, not verified change recovery or
causation. Only the separate `verify-observability-fix` comparison after an actual
approved change can establish `VERIFIED_RECOVERED` against agreed criteria.

Repository fixtures, demo scripts, and intentionally retained fault injection
may explain why a failure exists. They do not automatically change an
operational failure into healthy or remove it from the ranking.

## Ranking order

Rank with this evidence-based order:

1. active customer-visible failure or data/safety risk;
2. active recurring dependency or tool degradation, including degraded success;
3. active latency, throttling, quality, evaluation, or cost regression;
4. recovered incident that may recur;
5. historical issue;
6. coverage gap.

Within a tier, prefer broader scope, higher frequency, greater customer impact,
clearer correlation, and a more actionable affected path. Do not rank by a
single parent `Success` field.

## Ranked finding handoff

Every actionable finding must retain this information in conversation context:

- title and concise problem statement;
- rank, state, and ranking rationale;
- whether investigation is recommended and why;
- affected topology path and resolved ARM IDs;
- incident window and freshness;
- quantified evidence;
- representative operation, trace, and conversation IDs;
- known gaps.

The health workflow never chooses on the developer's behalf. Carry the chosen
rank or named finding to existing coordinator investigation selection, or directly
to applicable diagnostics/Foundry instructions. Do not route a completed finding
back into health selection or start another assessment. External-service
conversation creation is not required or authorized. The user-facing
follow-up should remain short and natural.

## Resource-pressure rule

For AKS, containers, caches, and databases, compare actual CPU and memory with
requests and limits and inspect throttling, working set, OOM/eviction, node
pressure, cache evictions, and latency. Running/Ready state and zero restarts are
insufficient to rule out resource pressure. If resource metrics are unavailable,
classify that branch as a coverage gap rather than healthy.

## Request-success rule

Treat HTTP result codes `>= 400`, structured error payloads, and failed caller
dependencies as failures even when server-side request telemetry records
`Success=true`. A handled Function response can otherwise hide an intentional
503 from request-success aggregations.

For exporter-backed workloads, Prometheus series from the Azure Monitor
workspace are the authoritative source for scrape health and exporter metrics.
Do not treat the limited `container.azm.ms/prometheus` data in Log Analytics or
`Perf` counters as equivalent. Distinguish absent exporter series from an
inaccessible AMW endpoint, and classify either state as a coverage gap.
