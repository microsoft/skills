# Intent and journey presentation details

Load only for an ambiguous admission or presentation decision. The entry retains
the normal routing and safety core; do not load this entire guide for every task.

This is the thin entry point for the observability journey, not a new diagnostics
engine, background monitor, or deterministic sibling-skill API. Specialists remain
independently usable. The host loads instructions and controls tool execution and
approvals. These instructions do not enforce permissions.

## Standalone availability gate

For an admitted task, check availability before reading any cross-skill reference
or loading a sibling. Individual installation may omit them. Use available
shared instructions unchanged in the bundle; their use below is conditional.
Unknown availability follows the missing-reference fallback.
Never download, install or attempt a mandatory missing sibling-file read.
If a required specialist is absent, preserve the confirmed scope/window,
selected evidence and remaining budgets, report the precise capability blocker
and offer the smallest permitted manual next step using current capabilities.
Do not invent a replacement specialist, reset onboarding or claim its execution.
This coordinator remains thin; no new standalone service or automatic reads,
setup, edits or recovery certification are implied.

## Current-request intent gate — before presentation or operations

Apply this gate on every user turn **before any journey header, diagram,
capability discovery, onboarding question or read**. Loading this skill does
not establish that the current task belongs to the observability journey.

- Enter only for a current request about observability, telemetry, monitoring,
  alerting, application/resource/agent health, diagnosis of an actual failure
  (including a failed deployment), operational application latency/performance,
  or recovery from an evidenced incident. Natural language such as "my API is
  slow" qualifies without tool names or the word observability. A generic "fix"
  or "slow" outside application/operational context does not.
- Explicit instrumentation, collection or alert setup/design is in scope even
  for a new application. Offer the relevant design/setup workflow without
  requiring a deployed target or inventing an existing gap. The request is not
  permission to provision, edit, install or enable anything.
- Answer conceptual observability questions directly. Do not start a journey,
  force application onboarding, discover tools or request resource identifiers
  merely to explain monitoring, tracing, alerts or instrumentation.
- Resource-group/resource creation, building a new app or Foundry agent, model
  deployment, RBAC, subscription, cost, general coding and documentation tasks
  do not qualify without an explicit observability purpose or actual diagnostic
  question. Do not turn routine deployment readiness into diagnosis.
- If incidentally loaded for an unrelated task, emit no observability **Using**,
  **Stage**, **Discovered**, journey stepper or observability questions/tools.
  Continue the normal task or let an appropriate available workflow handle it
  without invoking this coordinator. Preserve normal task/host approvals.
- Prior investigation context is not sticky: a topic switch ends journey
  presentation immediately. Resume only on a relevant current request; an
  unambiguous in-scope "continue" can retain the existing limits. Clarify only
  genuinely ambiguous operational intent with one minimal question, without
  a header, diagram or reads; do not interrogate every resource-creation task.
- Honor an explicit applicable specialist request directly. Do not load this
  coordinator just to add presentation or run a mandatory end-to-end sequence.

The presentation and routing rules below apply only after this gate admits an
actionable observability request and this coordinator is actually selected.

At the top of each substantive in-scope journey answer, show **Using:** with only the
actual host-loaded skills being followed for this step, plus **Stage:**.
Include relevant skills from other plugins or supported skill locations, not
just the six bundled skills. Do not list the history of every loaded skill.
If instructions were only read locally, use **Instructions read:** and
**host activation unverified**, not **Using:**. Loading is not tool execution.
Follow [capability discovery and approval](acquire-capability.md)
for a scenario-relevant **Discovered:** label and the next permission decision.
Keep this compact header above the journey indicator; neither proves execution.
Apply [result and plan presentation](next-actions.md) before the
substantive investigation result or accepted plan review, including when a
specialist answers within this already coordinated journey. Preserve evidence
depth and source bounds; do not leave the Remediate stage/indicator at the end.

Use these customer-facing stage labels while retaining the actual skill names
for loading instructions:

| Role / stage | Customer-facing name | Execution boundary |
|---|---|---|
| Foundation | Connect your application | Confirm deployment, telemetry association and task-specific access; not provisioning or instrumentation setup |
| Detect | Detect health issues | Assess existing signals or accept an existing alert/symptom; not a new continuous monitoring service |
| Investigate | Investigate the affected path | Follow relevant correlated application, dependency and infrastructure evidence; use Foundry only for applicable AI-specific work |
| Remediate | Guide an approved fix | Use an eligible existing change workflow with separate approvals for edits, jobs and deployment; no automatic production changes |
| Validate | Validate recovery | Compare customer-outcome and guardrail evidence after an actual change; deployment success or better evaluation scores alone are insufficient |

Azure Monitor is the operational observability foundation. Foundry is an
optional AI-specific branch, not a prerequisite for web/API or all AI workloads.
These stage labels do not add skills or rename identifiers. Enter the next
necessary stage; do not force every request through all four.

Read [the inline journey indicator](journey-indicator.md) for a
journey entry or meaningful stage/status transition. Show its compact rounded
Mermaid stepper in the response without requiring the developer to request it.
Use its text fallback when rendering is unavailable; presentation never
authorizes operations or implies completed stages.

Read [the handoff contract](handoff.md) and
[specialist selection](specialists.md) before delegating work. Use
[the journey coverage guide](coverage.md) only for the affected path;
do not sweep every Azure service.

## 1. Choose the next necessary stage

Honor an explicit specialist request. Otherwise select from the user's intent
and retained evidence, not from a fixed sequence:

| Request or retained state | Next necessary stage |
|---|---|
| "Find this app's telemetry" or missing target/source for an admitted observability request | Connect your application using `connect-observability` |
| Current application/resource/agent health question | Detect health issues using an eligible existing health specialist |
| Completed ranked assessment with no finding selected for investigation | Ask the developer to choose a finding; retain the assessment instead of running health again |
| Developer-selected finding from a completed assessment | Investigate that finding using its retained specialist state, scope and evidence |
| Named operational alert, trace, runtime/tool failure, failed deployment diagnosis or slow application operation | Investigate the affected path directly after minimum scope/access checks |
| Explicit collection/instrumentation/alert setup or design request, or an established relevant gap | Select one applicable design/setup specialist; no deployed-target prerequisite for design and no implicit provisioning approval |
| Proposed fix or optimization tied to an observability finding | Guide an approved fix: review the evidenced hypothesis and use the applicable existing change workflow |
| "Did the fix work?" for a known incident/change | Validate recovery using `verify-observability-fix`; request missing evidence, not another deployment |

For "my agent is slow", do not automatically start evaluation, optimization,
deployment, instrumentation setup, or a broad health sweep. First identify the
customer-visible symptom and the narrow affected path.

For trace/population latency questions, follow
[operation-based trace selection](trace-capabilities.md). Prefer an
existing sufficient authorized server-side analysis; do not force a new MCP,
bulk retrieval or local percentile/critical-path reconstruction.
For missing parents/handoffs, compare filtered-query coverage with exposed
Azure Monitor TraceStore retrieval organically; no developer tool name,
standalone server or advanced-analysis gap is required. Offer only the smallest
applicable approved check/lookup and reuse fresh confirmed source/schema facts.
For a material unresolved trace cap/parent/correlation issue, show the shared
**Trace capability decision** before asking for the next evidence pass or budget.
Once per material issue, explain existing-path sufficiency, candidate availability/
eligibility uncertainty and the bounded choice; do not defer it to cloud checks.
