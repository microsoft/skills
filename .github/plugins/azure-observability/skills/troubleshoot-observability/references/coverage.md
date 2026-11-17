# Useful evidence along the journey

Select only the customer path and hypotheses relevant to the question.
This guide is coverage awareness, not a promise that every source/tool is
available or that all resource types are supported.

| Layer | Useful evidence | Avoid |
|---|---|---|
| Customer outcome | Availability, latency distribution, failures, task success; browser or synthetic evidence when relevant | HTTP 200 as proof of successful agent behavior; generating traffic without approval |
| Agent and model | Run/version identity, model spans, latency/TTFT where emitted, retries, 429s, token use and quality/safety evaluation results | Treating sampled request count as model call count; changing a model based only on benchmark rankings |
| Tools and APIs | Correlated child spans, semantic and transport failures, retries/fallback, per-hop latency | Successful parent spans erasing child failure; retrieving raw prompts or secret configuration |
| Retrieval and data | Search/database/cache/queue latency, throttling, saturation, index/data freshness and task-specific correctness | Assuming a deployed data resource is used by the request; treating synthetic retrieval as live integration |
| Hosting and capacity | Container/node/guest pressure versus limits, restarts/OOMs, scheduling, scaling and relevant quota | Running/Ready as proof of health; high CPU as proven cause |
| Network and edge | Relevant API gateway, connectivity, DNS/TLS and network evidence | Starting connectivity/load tests or changing firewall rules without approval |
| Code | Supported existing profiling, exception/snapshot and Code Optimizations evidence | Assuming portal-only recommendations are queryable via Logs; enabling collectors silently |
| Changes/platform | Deployment/config/model/prompt version, management activity, Resource Health and Service Health | Coincidence as causation; management logs as data-plane request traces |
| Telemetry pipeline | SDK/exporter drops, sampling, ingestion delays/caps, diagnostic settings, AMA/DCR routing and source access | Missing telemetry as healthy or automatically requiring instrumentation |
| Recovery | Comparable baseline/post-change outcome and guardrail evidence, adequate traffic and observation duration | Deployment succeeded, no alert, idle traffic or a single passing evaluation as recovery |

## Source boundaries

- Application Insights component tables and workspace tables can differ in name
  and fields. Inspect the actual schema before KQL.
- Platform Metrics APIs and PromQL-backed Azure Monitor workspace metrics are
  different operations. Preserve metric units, dimensions and aggregation.
- Dedicated trace-store MCP queries use their own supported dialect and eligible
  enabled source. A Prometheus workspace is not proof of trace-store eligibility.
- Table plans, retention, access scope and private-network reachability can
  affect query behavior. Report unsupported/denied/partial distinctly.
- Live Metrics is a live nonretained stream, not historical log-query access.
- Browser telemetry, quality evaluations and custom business signals require
  their own instrumentation/results; server traces do not establish them.
- Enabling a standard availability test, profiling, new collection or continuous
  evaluations changes behavior and can incur cost. Route to an approved setup
  step, not an implicit investigation read.

Preview trace/health-model features, Grafana and deep native diagnostics are
optional enrichment. Their absence must not block a useful narrow investigation,
but missing evidence required for its conclusion must remain visible.
