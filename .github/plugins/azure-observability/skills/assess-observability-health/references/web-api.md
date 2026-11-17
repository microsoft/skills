# Web/API lens

Start from the confirmed application telemetry source, not a particular SDK or
language. Already-instrumented applications may be assessable even when a setup
contribution does not support their implementation language.

Within the entry point's single bounded pass, use these source-specific signals:

1. **Requests:** event count/freshness, observed failures, result-code failures,
   latency with units and sampling qualifications. Distinguish application
   requests from health probes when the schema identifies them.
2. **Dependencies:** observed downstream failures/latency and freshness, using
   safe operation categories rather than raw endpoint URLs.
3. **Exceptions:** bounded aggregate counts and correlation coverage. Do not
   output raw messages/stacks or assume every exception failed a customer request.
4. **Relevant runtime pressure or availability:** only when part of the task and
   a verified source exists. Resolve actual metric names, units, aggregation,
   resource scope and limits; do not guess CPU/memory percentage thresholds.

Request/dependency success fields are evidence, not the sole outcome definition.
HTTP error result codes and correlated child failures may contradict parent
success. Do not deduplicate logical requests by arbitrary span IDs.

Pressure telemetry absent from the source is a gap if pressure is core to the
task. A running resource does not establish adequate capacity. For AKS or
exporter-backed workloads, use an actually associated supported metrics source;
do not present generic performance logs as equivalent to missing exporter
series.

A compact known failure category may support an observed degradation without a
predefined error-rate SLO. For acceptable latency, availability, error budgets,
or recovery claims, state the applicable policy/baseline and its provenance.
