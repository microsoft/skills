# Azure application and resource health

Use this reference for application-wide health or a named AKS, VM, Function,
cache, database, or other Azure resource.

## Resource-specific application of the shared health pass

1. Resolve the exact requested scope once.
2. Run one parallel summary round for current state, customer outcome, golden
   signals, alerts/Resource Health, and minimum pressure signals.
3. When degraded, run one second round for one representative failure,
   exception, event, or dependency path.
4. Classify, rank, and stop. Use the entry point's developer-selected
   investigation handoff, never a mandatory external-service action.

Aim to return a named-resource assessment in about two minutes when Azure
services respond normally.

For supplied evidence, apply these procedures without new reads. For live work,
all metadata, schema corrections and both rounds share the existing approval
budget and exact UTC window; smaller limits and no-retry instructions win.
Discover actual tools/schemas/access rather than assuming any named operation.
Unavailable tools or pressure metrics limit conclusions, not authorization.

## Application-wide health

Inspect only relevant surfaces:

- end-to-end availability and customer-visible outcomes;
- Foundry agents, models, tools, and evaluations;
- Functions, AKS workloads, caches, databases, and network dependencies;
- CPU/memory usage versus requests and limits, throttling, working set,
  OOM/eviction, node pressure, cache evictions, and dependency latency;
- active alerts, Resource Health, Service Health, and recent deployment state
  when needed to classify the current issue.

Do not expand every Foundry tool path into every infrastructure resource during
the health pass. Preserve exact downstream identities for selected RCA.

## Named AKS

In one parallel round inspect:

- current controller and replica state;
- ingress/customer-visible outcome;
- CPU and memory versus requests/limits;
- CPU throttling, OOM/eviction, and node pressure;
- material warning events;
- active alerts and Resource Health.

Reconcile current replicas; do not count retained terminated pods as active.
Never sum restart counts across sidecars or cumulative `KubeEvents.Count`
snapshots.

Use managed Prometheus for scrape health, exporter metrics, throttling, working
set, OOM, and node pressure. Resolve the Azure Monitor workspace from the
cluster metrics DCR. An exporter pod without returned series is a coverage gap.
Do not use regex matchers on PromQL `__name__`.

Kubernetes API access is optional when Container Insights and Prometheus answer
the health question. Do not acquire kubeconfig merely to duplicate telemetry.

## Named VM

Inspect power/provisioning state, Resource Health, heartbeat/availability,
CPU, memory, disk, network saturation, active alerts, and one representative
guest/application failure when degraded. Do not query change history or broad
guest logs unless the developer selects RCA.

## Functions and HTTP dependencies

Treat HTTP `>=400` and structured error payloads as failure even when request
telemetry says `Success=true`. A handled exception or error payload can hide
degraded success. Correlate only the representative operation needed to
classify impact.

## Query discipline

- Use schema-first bounded KQL for uncertain tables.
- Query heterogeneous tables separately or use `column_ifexists()`.
- Cast dynamic grouping keys with `tostring()`.
- Use `CounterValue` for `Perf`.
- Resolve exact operation/span IDs before querying traces or exceptions.
- Correct one failed schema probe once only if permitted within remaining
  budget, then preserve the gap.

Run Resource Health per resource when permissions differ. `Unknown` is a
coverage gap; `UnsupportedResourceType` is not applicable. On `403`, report the
missing read permission and continue with service-specific telemetry.
