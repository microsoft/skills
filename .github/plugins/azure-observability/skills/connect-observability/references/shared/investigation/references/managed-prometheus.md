# Managed Prometheus evidence for AKS RCA

Use this reference when the selected path includes AKS, Redis, or another
exporter-backed dependency.

## Source distinction

- Azure Monitor workspace (AMW) Prometheus data is queried with PromQL through
  `properties.metrics.prometheusQueryEndpoint`.
- Log Analytics `InsightsMetrics` may contain a limited
  `container.azm.ms/prometheus` namespace. It is not a substitute for the AMW
  store and commonly contains kubelet metrics rather than application exporter
  series.
- Container Insights `Perf` counters are useful corroboration, but do not
  establish CPU throttling, exporter scrape health, Redis evictions, or command
  latency.

## Query path

Use the [optional local helper](../scripts/query_prometheus.py) with either the AMW ARM ID or its Prometheus
query endpoint. The script uses the existing Azure CLI identity and the
`https://prometheus.monitor.azure.com` audience; it never prints the token.
Resolve that path from the investigation directory. Prefer an existing
authorized PromQL tool or supplied evidence; the helper requires separate
local-execution, token-acquisition and network-read approval. Never auto-run
it, install Azure CLI/extensions or change identity. Its read cap is 8 MiB,
50 series, and 3,600 points per series; exceeding a cap is incomplete evidence,
not absence. Keep any range within one hour and scope labels to the affected path.

For a range query, provide `--start`, `--end`, and `--step`. Use the exact
incident window plus a short baseline on both sides. If AMW discovery or query
returns `403`, record the missing AMW/DCR read or Monitoring Data Reader access
as an evidence gap. Do not replace missing Prometheus evidence with a healthy
conclusion from `Perf`.

## Required AKS/cache checks

Discover available series and labels before assuming exporter-specific names.
Then evaluate:

- scrape health (`up`) for the Redis exporter and kubelet/cAdvisor jobs;
- Redis memory use versus configured maximum, evictions, blocked clients,
  connections, command throughput, and command latency;
- container CPU throttled periods versus total periods;
- container working set/RSS versus Kubernetes requests and limits;
- OOM counters and last-terminated reason;
- node CPU/memory pressure and pod scheduling/eviction signals.

Typical series include `redis_up`, `redis_memory_used_bytes`,
`redis_memory_max_bytes`, `redis_evicted_keys_total`,
`redis_blocked_clients`, `container_cpu_cfs_throttled_periods_total`,
`container_cpu_cfs_periods_total`, `container_memory_working_set_bytes`,
`container_oom_events_total`, and kube-state resource request/limit metrics.
Exporter and platform versions can rename or omit series, so treat these as
discovery candidates rather than guaranteed names.

Report four states separately:

1. series present and healthy;
2. series present and degraded;
3. exporter target present but expected series absent;
4. endpoint or RBAC unavailable.

Only the first two support a resource-pressure conclusion. The latter two are
coverage gaps.
