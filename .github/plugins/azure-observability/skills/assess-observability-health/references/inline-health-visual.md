# Inline health visual

Use the inline visual only when the bounded health pass already returned a
decision-relevant trend or comparison. The visual must not trigger another
Azure, Foundry, Monitor, Prometheus, or other remote query.

The renderer is resource-agnostic. It knows only titles, KPI cards, and numeric
series; it does not inspect ARM resource types or apply Foundry-specific logic.
Use the same visual contract for an agent, application, AKS cluster, VM,
Function, cache, database, or another monitored resource.

Map each health lens to the evidence it already collected:

| Health lens | Typical KPI cards | Typical charts |
| --- | --- | --- |
| Foundry agent | runs, failures, latency, evaluations, tool outcomes | run outcomes, latency percentiles |
| AKS | replicas, ingress outcome, CPU, memory, restarts/throttling | resource pressure, availability |
| VM | availability, CPU, memory, disk, network | utilization, heartbeat or failures |
| Function | requests, failures, latency, executions, dependencies | request outcomes, latency |
| Cache or database | availability, latency, errors, saturation, capacity | operations, resource pressure |
| Application | customer outcome, requests, failures, latency, dependencies | end-to-end outcomes, bottleneck signal |

These are mappings, not mandatory panels. Never query a missing signal solely
to complete the visual.

## Visual contract

- One 1600 x 900 SVG.
- Three to five KPI cards.
- At most two compact line or bar charts.
- State-aware color for healthy, degraded, warning, and neutral signals.
- Direct baseline and current/candidate labels when a comparison exists.
- Decision-relevant threshold annotations such as SLOs, timeouts, release
  gates, or rollback boundaries when those values already exist in evidence.
- An optional row of up to five infrastructure/downstream metrics beneath the
  charts when already-collected evidence broadens full-stack coverage.
- Exact UTC interval and concise source/filter context.
- Missing expected signals labeled `Unavailable`, never converted to zero.
- No causal diagnosis in the visual.
- Keep the prose verdict, ranked findings, and affected-path topology complete
  without the image.

All inline health visuals are dark-only. The renderer must emit a fixed dark
palette with a lighter visual hierarchy across the canvas, panels, cards, grid,
and labels; it must not collapse the entire visual into near-black surfaces.
Use distinct but accessible healthy/degraded/warning colors for cards, bars,
annotations, and metric strips. Do not add adaptive color-scheme behavior or
`prefers-color-scheme` media queries. The deprecated `auto` and `light` CLI
values remain accepted only for compatibility and still produce dark output.

## Render

Only after explicit consent for sanitized input/output writes at agreed paths
and execution with an already approved Python 3.9+ interpreter, run:

```text
<approved-python> scripts/render_inline_health_visual.py --input <input.json> --output <output.svg> --theme dark
```

The input uses the inline health evidence shape:

```json
{
  "title": "Resource health",
  "window": {"start": "ISO-8601", "end": "ISO-8601"},
  "source_summary": "Verified monitoring source and filters",
  "kpis": [{
    "label": "Requests",
    "value": "120",
    "context": "24-hour window",
    "state": "healthy"
  }],
  "charts": [{
    "title": "Request latency",
    "caption": "Baseline vs current",
    "maximum": 20,
    "series": [{
      "name": "p95 seconds",
      "points": [
        {"x": "Baseline", "y": 12, "display": "12 s", "state": "degraded"},
        {"x": "Current", "y": 2, "display": "2 s", "state": "healthy"}
      ]
    }],
    "annotations": [{
      "label": "SLO: p95 < 5 s",
      "y": 5,
      "state": "healthy"
    }]
  }],
  "infrastructure_metrics": [{
    "label": "Cache memory",
    "value": "42%",
    "context": "No eviction signal",
    "state": "healthy"
  }]
}
```

`state` accepts `healthy`, `degraded`, `warning`, or `neutral`. Point
`display` is optional and preserves exact units while `y` remains numeric.
`maximum` and `annotations` are optional. Infrastructure metrics use the same
label/value/context/state shape as KPI cards.

Keep the JSON and SVG only at the approved local destination. Embed the SVG once in the
response. Do not add either the inline SVG or its local JSON to the normal
Resources list.

## When to skip

Skip the visual when:

- consent or an approved interpreter/destination is absent (no install/setup);
- the evidence is categorical rather than time-series or comparative;
- an exact-value Markdown table communicates the result more clearly;
- producing the input would require manually reconstructing a long raw series;
- the chart would repeat the same information as the topology and ranked table;
  or
- the chat client cannot display or link the generated SVG.

Do not omit a useful infrastructure row merely because the main health lens is
Foundry-first. Include downstream metrics already gathered during the bounded
pass or selected-path enrichment, but never run new queries solely to populate
the row.

Do not generate a secondary HTML or Grafana artifact. The inline SVG is the
only generated visual.
