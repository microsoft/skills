# Optional Application Insights transaction link

The relocated `scripts/build_appinsights_trace_link.py` builds a URL locally
and prints JSON; it does not query Azure or save evidence. Execute only with an
approved Python 3.9+ interpreter and local script permission. It is not required
for supplied-evidence analysis. Do not issue new reads just for a portal link.

Use an already resolved root telemetry event, preferably `availabilityResults`
then root `requests`. Required flags are `--subscription-id`, `--resource-group`,
`--component-name`, `--resource-id`, `--event-id` (telemetry itemId UUID, never
span/dependency ID), `--operation-id`, `--timestamp`, `--event-table` and
`--end-time`. Preserve exact ISO timestamps including fractional seconds.
`--duration-ms` must be positive; default is 86400000. Use the approved window,
not the default if different. Supported component event tables are
`availabilityResults`, `requests`, `dependencies`, `traces`, `customEvents`,
and `exceptions`; map workspace evidence only when equivalence is verified.

The helper retains the route and encoding shape with `portal.azure.com` as
its adapted default host. An offline string
regression is not proof of portal navigation or host compatibility. Include
the URL only when resource/event inputs are verified. Otherwise provide the
verified component link or omit the unresolved slot. Keep raw correlation IDs
in conversation context, not a local artifact; cache ID is a URL parameter,
not an investigation or conversation identifier.
