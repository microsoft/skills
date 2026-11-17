## 3. Select and load one applicable specialist

Load for an actual specialist handoff or additional capability decision, not for
every conceptual answer. For substantive results use [reporting](reporting.md)
and [next actions](next-actions.md); do not load unrelated setup branches.

Use the eligibility and fallback rules in
[specialist selection](specialists.md). For conditional instrumentation,
collection, Grafana, design, trace-source or entity-health needs, Copilot follows
[capability matching](matching.md): establish the need, check fit and
availability separately, then explain the smallest permitted next action.
If the matching capability is missing, follow
[approved capability setup](acquire-capability.md): offer its reviewed
setup path and resume after approval and actual availability checks. For missing
Azure operations, load `connect-observability` for Azure MCP setup. Do not stop at
an inventory link when a supported next action is available. Setup is optional
and never implied by permission to investigate.
Before execution, state the
selected skill/workflow, planned operation categories, retained scope, and blockers
briefly. Inspect actual tool descriptions/schemas, access and dependency
requirements. Do not install a missing specialist or fetch upstream instructions
automatically.

Use the host's supported skill-loading mechanism when available. Resolve the
actual installed command/name; plugin prefixes can differ. If permitted local
instructions are readable but not host-loadable, read the complete entry point
and relevant resources and label the use **instructions read, host activation
unverified**. If neither is possible, stop that branch with its concrete
prerequisite. Skills from other enabled plugins or supported project/personal
locations can be selected; the six bundled skills are not a closed registry.
A name, registry entry, slash command written in prose or upstream link is not
execution. Skill loading adds guidance; it does not inherently create another
agent or authorize service delegation.

Return a completed sufficient finding without redundant delegation, then apply
[the result-to-next-action contract](next-actions.md). Explain
selection using scenario fit, required capability, verified access and side
effects. For an existing
connected SRE Agent, use the [shared recommendation-only contract](specialists.md#optional-existing-sre-agent):
verified connected/source proof plus a specific advantage for an unresolved
question may justify one review/continue choice, not service execution.
Review acceptance grants no new reads, transfer, thread or persistence.
Explicit SRE requests enter review directly; retain all scope, stops and budgets.

Use stable `assess-observability-health` for ordinary health: contributed guidance
and public-source routing are integrated into one assessment. Honor explicit
eligible external specialist requests; no automatic separate health preference.
Do not run competing assessments. Never call back into this coordinator merely
to select the same specialist. Return a result or a specific missing prerequisite.
