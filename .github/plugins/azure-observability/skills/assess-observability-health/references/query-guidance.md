# Public query operations and examples

Use the host's actual Azure Monitor log/metric tool schemas. Public Azure query
operations are the execution path; no external-service conversation is
created. Availability and authentication still need validation in each client.

## Component-scoped Application Insights

Select the surface from the confirmed resource ID and actual query operation
before the first probe. `Microsoft.Insights/components` through a component
resource-log query starts with component-native table candidates below, even
when that component stores data in a Log Analytics workspace. `AppRequests`
belongs to the workspace query surface, not automatically to every
workspace-based component. Reuse observed schema or verify a minimal schema
under the agreed budget; candidates are not a guarantee of table availability.
Count failed/schema/key-discovery queries inside the total approved call limit.
Only perform a single correction when allowed by that approval, never after an
explicit no-retry instruction without new consent.

The following is a template for an already-confirmed component and role.
Replace the synthetic window/role with the agreed scope. It is not a universal
query for every Azure Monitor source.

```kusto
union
(
    requests
    | where timestamp >= datetime(2026-10-29T00:00:00Z)
        and timestamp < datetime(2026-10-30T00:00:00Z)
    | where cloud_RoleName == "example-role"
    | summarize StoredRecords=count(),
        RepresentedEvents=sum(itemCount),
        MissingWeights=countif(isnull(itemCount)),
        FailedStoredRecords=countif(success == false or toint(resultCode) >= 400),
        P95StoredDurationMs=percentile(duration, 95),
        LatestEventAt=max(timestamp)
    | extend Signal="requests"
),
(
    dependencies
    | where timestamp >= datetime(2026-10-29T00:00:00Z)
        and timestamp < datetime(2026-10-30T00:00:00Z)
    | where cloud_RoleName == "example-role"
    | summarize StoredRecords=count(),
        RepresentedEvents=sum(itemCount),
        MissingWeights=countif(isnull(itemCount)),
        FailedStoredRecords=countif(success == false or toint(resultCode) >= 400),
        P95StoredDurationMs=percentile(duration, 95),
        LatestEventAt=max(timestamp)
    | extend Signal="dependencies"
)
| project Signal, StoredRecords, RepresentedEvents, MissingWeights,
    FailedStoredRecords, P95StoredDurationMs, LatestEventAt
```

Each row labels its actual source table. No grouping is needed if the selected
task only needs these two summaries. Keep the same label through the report.
Use the tool's resource scope to select the confirmed component; do not put
connection strings or credentials in the query.

`FailedStoredRecords` and the duration percentile describe stored telemetry,
not sampling-corrected logical operations. `itemCount` can represent sampled
events; report unknown weights, and do not silently substitute `1` for missing
weights. An empty aggregate response row does not represent one event. Null
percentiles/timestamps are unavailable, not zero latency or freshness.
Component-native `duration` in this query surface is numeric milliseconds, not a
timespan. Verify units/types for another surface rather than divide numeric
values by a timespan literal. A low percentile or large record count may be
dominated by health probes; it does not prove representative customer activity.

For non-HTTP dependencies, result-code interpretation can differ; retain success
flags and use documented type-specific status semantics for deeper analysis.
The query does not inspect structured semantic errors or establish agent quality.

## Other sources

Workspace-scoped Application Insights commonly uses `AppRequests`,
`AppDependencies`, `TimeGenerated`, and `DurationMs`, rather than the
component-native names above. Validate the selected schema; correct a concrete
mismatch once. Do not run component templates against every workspace.

Metrics require verified resource IDs, metric definitions, units and time
aggregation. Prometheus needs the actual associated workspace/endpoint and
available series. Foundry evaluation/run operations may use a separate source.
Trace-store support requires eligible enabled storage and a usable public
distribution/authentication path, not just an existing Monitor workspace.

No table/series returned, unsupported schema, denied access, timeouts, throttling,
or partial results remain explicit gaps. Do not install extensions, acquire
kubeconfig, change identity, or grant access to make this assessment succeed.

## Documentation basis and execution evidence

- [Application Insights metrics](https://learn.microsoft.com/azure/azure-monitor/app/metrics-overview)
  documents duration units and `sum(itemCount)` for represented event counts.
- [OpenTelemetry sampling](https://learn.microsoft.com/azure/azure-monitor/app/opentelemetry-sampling)
  describes sampling and completeness limitations.

A source-labeled request/dependency aggregate using numeric duration was
successfully executed against one user-approved staging component. Its data was
stale, so it did not establish current health. This is query-shape evidence,
not universal schema compatibility, full-workload assessment, or host activation
certification.
