# Offer an inline view or an AMG dashboard

Load for a selected/explicit visual request, or after a monitoring-follow-up
choice. Apply [the result-to-next-action contract](next-actions.md) first. Do not crowd
its planning/verification/evidence question with a second visual question or
bundle both choices. Defer a new optional visual offer while that decision is
pending; preserve a known choice/decline and honor explicit visual requests.

When no next-action question is pending, optionally offer once:

> Would you like an inline evidence view, or should I help create an Azure
> Managed Grafana dashboard for this investigation?

Honor an explicit dashboard request at any stage. Reuse an existing choice or
decline from the handoff; do not ask after every query. Do not delay the finding
or make Grafana a prerequisite. Under a no-save/no-write ceiling, explain that
AMG creation needs separate permission and continue inline unless the developer
explicitly changes that ceiling. If no chartable evidence exists, explain the
gap rather than proposing empty success panels.

An offer is not an approval to connect a service, query a datasource, create a
dashboard, or save a local file.

## 1. Choose the output using existing evidence

| Choice | Next action |
|---|---|
| Inline | Show a concise evidence table or supported diagram in chat; no local artifact or new query is required |
| Existing AMG dashboard | Offer scoped search/inspection and a link with relevant filters, after applicable read approval |
| Create AMG dashboard | Confirm an existing instance, folder, datasource and reviewed panel plan; request separate create approval |
| Decline | Continue the investigation without further visual prompts unless the developer asks |

Use the already-collected source-labeled evidence. Scalar aggregates can support
tables but not an invented time series. If a necessary new aggregate or datasource
validation query is justified, propose the exact scope/window and bounded cost;
obtain its read approval separately. Missing, denied, stale and partial signals
remain labeled, not zero or healthy. A chart cannot establish root cause or
recovery beyond its underlying evidence.

## 2. Establish the real AMG operations

Sources reviewed November 5, 2026:
[AMG remote MCP documentation](https://learn.microsoft.com/en-us/azure/managed-grafana/grafana-mcp-server).
The documented endpoint on an existing instance is
`https://<grafana-endpoint>/api/azure-mcp`.
Resolve the actual instance endpoint; do not derive it from a guessed name.

| Documented tool | Intended use |
|---|---|
| `amgmcp_dashboard_search` | Find a relevant existing dashboard or check for a target collision within approved scope |
| `amgmcp_dashboard_inspect` | Inspect an existing dashboard's metadata, selected panels or queries |
| `amgmcp_datasource_list` | Establish the configured datasource UID/type and intended source |
| `amgmcp_dashboard_update` | Create, replace or patch a dashboard; choose only the separately approved operation |

These are documented names, not guaranteed host tools or input schemas.
Discover actual operations and accepted inputs before use. Azure MCP's
`grafana_list` only lists workspace resources; it does not create dashboards.
Do not invent a dashboard-write operation on that router or infer it from
resource-list access.

Prefer an applicable available dashboard-authoring specialist if one is actually
loadable. Resource-health Grafana specialists are not automatically dashboard
authors. Do not install all AMG skills or run a pulse check merely to create a
chart.

## 3. Confirm access and offer setup if missing

Reuse an existing approved AMG connection. If missing, follow
[approved capability setup](acquire-capability.md) with the documented AMG
endpoint and host-specific configuration, preserving existing server entries.
Obtain connection/configuration and sign-in approvals before setup. VS Code's
documented Entra OAuth flow is not proof of CLI compatibility. Never request
tokens in chat, create a service account token, or dump configuration to connect.

Confirm the existing instance and destination folder. Dashboard creation needs
the applicable Grafana write permission; resource Reader alone does not grant
it. Datasource identity, Azure scope, network reachability and query permission
are separate from Copilot's source access. A query that worked through Azure
MCP may fail or access a different population through Grafana's datasource.
Do not grant roles, create datasources, change identity or alter access policies.

If no AMG instance exists, explain that creating one is a separate potentially
billable provisioning task. Do not provision it automatically or block the
investigation. Offer inline output and retain a specific dashboard prerequisite.

## 4. Review the dashboard plan before writing

Present the existing instance, folder, title, intended audience/inherited access,
new-dashboard versus existing-dashboard choice, and a compact panel plan:

- Confirmed datasource UID/type and actual application/resource/environment
  filters, source table/metric, query language and supported query model.
- Exact UTC incident window, aggregation, units, sample/count semantics and
  panel-to-evidence references. Use explicit fixed scope and time bounds for the
  incident dashboard; do not silently broaden to subscription-wide or all agents.
- Supported panels, for example request latency, failures, or tool/dependency
  duration, only when the necessary signals and identities are established.
- Coverage gaps and any query not yet validated through the datasource.

Do not paste KQL into a Prometheus target or assume resource/workspace query
models are interchangeable. Reuse a compatible inspected panel or reviewed
authoring guidance; if the query model cannot be established, explain the gap
rather than write guessed dashboard JSON.

Dashboard definitions persist queries and organizational identifiers on AMG;
viewing panels can execute datasource queries. Explain the audience/data-access
implications and query cost. Keep auto-refresh off by default and do not render,
refresh or validate against the datasource without its applicable query approval.
Do not embed raw prompts, responses, credentials, connection strings or sensitive
telemetry in panel definitions, descriptions or annotations.

Ask for approval for this specific create operation. Prefer a new dashboard;
creation approval does not authorize overwrite, patch, delete, alerts, sharing
changes or datasource changes. Check for collisions through approved metadata
reads and use supported create/non-overwrite semantics. If collision protection
cannot be established, stop before writing; never overwrite as a fallback.

## 5. Verify the saved artifact and return to investigation

After the approved write, use an approved bounded dashboard metadata read to
confirm the returned UID/version, folder and intended panel/query scope. Report
the actual dashboard URL returned by the service; do not fabricate one.
Metadata verification does not establish that panels rendered or queries ran.
Report query/render validation separately as passed, failed or not run.

A denied, failed, conflicting, partially applied or unverified write remains
that state. Before any retry, inspect permitted state to avoid duplicate
dashboards; obtain approval for a correction or rollback. Do not auto-delete,
overwrite or switch to another instance. Always preserve the textual findings.

Carry the presentation choice, offer/decline state, approved instance/folder,
datasource identity/scope, panel/query references, write outcome, UID/version/URL
and validation gaps in the conversation handoff. Do not save an extra local
dashboard/report file without permission. A dashboard link is not proof the
incident is resolved.

For ongoing monitoring after a recovery report, follow
[monitoring follow-up](monitoring-follow-up.md). Agree any rolling time window
and refresh cadence separately from the fixed incident view; keep auto-refresh
off without approval. Preserve the recovery verdict and unresolved coverage.
