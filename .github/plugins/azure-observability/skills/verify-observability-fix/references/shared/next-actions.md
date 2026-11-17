# Result-to-next-action contract

Apply after a relevant investigation, completed plan or change result, including direct
specialist use and optional service returns. This is conversation guidance,
not an executable workflow or permission grant. Reapply the current-request
intent gate first: conceptual answers, general coding and unrelated topic
switches get no journey continuation.

## Keep coordinated presentation through the result and plan review

First determine from the conversation whether this is an **already coordinated
journey** still in scope, not from the skill currently answering. This is retained
conversation context, not a new runtime state mechanism. A specialist delivering
the answer preserves that presentation; it need not reload the coordinator.
An explicit standalone specialist request does not start a journey or load the
coordinator for presentation. Keep its applicable direct skill header only.

For an already coordinated journey, read and apply
[the journey indicator](journey-indicator.md) at the actual response point:
**Using:** actual host-loaded skills being followed and **Stage:** the full
current stage label go at the TOP, before the indicator and substantive body.
Locally read instructions use **Instructions read:** / **host activation
unverified** instead. Never claim a coordinator or health load from context alone.
On a meaningful Investigate transition show **Investigate the affected path**,
not the entry Detect graph. When an offered fix-plan review is accepted, start
that review with **Guide an approved fix**, **You're here: Remediate**, its
single-highlight rounded Mermaid indicator, then **Up next:** the smallest
planning action and **Planning only · No changes made**. Only then give the
review content. A stage line buried at the end does not satisfy this contract.
Do the same for a meaningful Validate transition after an actual effective
change, with **Validate recovery** and recovery still unverified as applicable.
Routine continuations need no repeated diagram. Honor no-diagram, accessible
text and rendering-failure fallback from the indicator reference.

Before substantive end-to-end investigation synthesis, apply
[the handoff's report depth](handoff.md#substantive-report-depth). Keep evidence,
source bounds and consequential gaps even with a compact header/diagram; do
not force that report on a quick question. An accepted plan review briefly
carries its decisive support and uncertainty, rather than duplicating the
entire diagnosis/count table. Include the smallest change, risk, exact target/
version (unknown if unconfirmed), proposed acceptance criteria and rollback.
Proposed acceptance criteria are not an agreed SLO. Once an option is selected,
end with the operative source question or concrete edit-consent question below, never source and
deployment consent together. Planning consent still authorizes no operations.

## One decision, not an automatic stage transition

End an actionable investigation with **Stage: Investigate the affected path**
and **Next action:** the concrete smallest supported change to review, then one
concise human question: **Would you like me to review the smallest fix and
rollback plan?** Use the host's supported choice mechanism when available
(**Review fix** / **Stop with diagnosis**); otherwise ask in ordinary chat.
Never require a skill name, slash command or long prompt.

- A sufficient finding should return without redundant investigation-service
  delegation. That stopping rule does not suppress this planning offer.
  This question belongs in chat, not a new service request or conversation.
- A yes to this question permits plan review only. Stay at **Guide an approved
  fix** while reviewing supporting evidence, exact target/version, smallest
  change, risk, acceptance criteria and rollback. It authorizes no edits,
  deployment, traffic, jobs/evaluations, reads, installs, connections or saving.
  Obtain applicable action-specific approvals before execution. Use an existing
  eligible change workflow; do not auto-run it.
- Prefer the narrowest causally supported option. For synthetic evidence of
  deliberate retry-delay injection, review disabling that injector first.
  A retrieval-size reduction is a separate optional optimization whose latency
  effect is unproven and whose quality risk requires confirmation. Do not bundle
  speculative optimizations or unrelated changes into the demonstrated fix.
- If material cause remains unresolved, do not manufacture a fix or force
  remediation. State **Stage: Investigate the affected path** and propose the
  smallest missing evidence read with source, question, scope/window, finite
  budget and appropriate approval instead. In evidence-only mode ask for the
  smallest missing supplied observation, or offer separately approved collection.
- An unresolved investigation with missing evidence and an exhausted budget
  must end with ONE actionable question, not just "more evidence is needed":
  **May I read [specific source] for [unanswered question], limited to [target,
  UTC window, predicates, finite reads/rows and selected safe fields], or would
  you prefer to supply that sanitized evidence?** Use a real supported operation
  only; if none is exposed or no-query remains, ask for supplied evidence instead.
  For a material trace cap/parent/correlation issue, first show the shared
  [Trace capability decision](trace-capabilities.md) before this next-pass request.
  Reuse covered approvals and honor stop, decline and no-follow-up; do not loop
  questions, silently renew the budget or turn unknown cause into a fix.
- Read-only or no-changes forbids execution, not an optional plan review.
  Diagnosis-only limits work to diagnosis unless the developer opts into that
  optional plan. Explicit **recommendations only**, **no follow-up**, **stop**,
  or a previously declined continuation suppresses the question. State the
  result/stage and that work stopped as requested; do not nag or execute.
- Retain next-step offered/accepted/declined state, scope, execution ceiling and
  known preferences in conversation across handoffs. Reuse an accepted plan
  review or declined offer rather than asking again. An existing approved
  change plan with unexpired, covered action approvals needs no redundant
  prompt; continue only those covered actions. Host approvals still apply.
- Optional inline/Grafana presentation must not crowd or replace this decision.
  Preserve the user's visual choice/decline. Defer a new visual question while
  the next-action question is pending; never bundle two choices in one question.

## After a reviewed supported plan, unblock implementation

During accepted Remediate plan review, present up to three evidence-backed
options rather than assuming every issue needs a code edit:

| Option type | What the developer can do |
|---|---|
| Correct the issue | Review the smallest supported code/config fix, with a local diff or PR proposal when source is available |
| Mitigate impact | Review a supported rollback, capacity/config adjustment or operational workaround, with risks and reversibility |
| Prevent or detect recurrence | Review an issue-specific alert/collection change with signal, agreed threshold/window, audience, noise/cost and validation |

Include only applicable options, explain which addresses the symptom versus
detects it, and recommend the smallest supported one with its uncertainty.
An alert is not a fix for the underlying failure. Unknown cause permits a
clearly labeled reversible mitigation or monitoring proposal only when its
support and risks are explicit; do not manufacture a causal correction.
Each option states evidence, target/version, expected benefit, risk, required
access, acceptance criteria and rollback. End with one option-selection question.
If the developer already chose an option, proceed to its review without asking again.
When selection is pending, stop before the implementation question below.
After selection/review, ask only the applicable smallest implementation question.

Selecting an option permits planning only. A PR proposal is not approval to
read remote code, edit files, commit, push, publish a PR or deploy. Discover the
actual eligible source-control/change operations before a separately approved
action. If unavailable, return a useful in-chat patch/plan with an explicit
blocker rather than claiming a PR exists. Alert creation/update and operational
mitigation likewise require separate exact-action approvals, including any
notification destination, query cost, persistent configuration or production risk.
Do not force source-file questions for an alert or other non-code option; ask
for its smallest missing target/signal/destination fact instead.

Stay at **Stage: Guide an approved fix** and end with **Next action:** the
smallest concrete implementation step, not just "source is a prerequisite" or
an approval disclaimer. Reuse covered unexpired approvals; explicit stop,
decline, recommendations-only or no-follow-up still suppresses continuation.
Do not repeat the already accepted plan-review question.

- If source/configuration is known, propose the exact target and minimal edit
  for operation-specific approval, not a generic "proceed?" or immediate edit.
  If already permitted, inspect only relevant nonsecret source in the local
  application workspace before asking for files. A plan-review yes grants no
  source reads. No broad scans, credentials, `.env`, or installed plugin/cache
  edits; no automatic cloning, installs or cloud code export.
- If source/configuration is unknown after any permitted scoped inspection,
  ask ONE actionable minimal question: **Where is the source/config for the
  affected agent/tool adapter? Open the workspace or share the relevant files
  with secrets removed.** Adapt agent/tool wording to the affected component
  for web/API cases. Do not demand engineering recipes, file layouts or commands
  from the developer. If remote-only, propose a separately approved bounded
  source read; telemetry permission does not cover fetching/exporting code or
  sensitive configuration. Do not fetch it automatically.
- Once source is supplied, review the concrete diff, exact target/version,
  acceptance criteria and rollback, then obtain edit approval before applying
  it. Opening/sharing source and accepting plan review are not edit, deployment,
  job, traffic or read consent. Host approvals still apply; execute only
  covered actions, without redundant prompts for eligible retained approvals.
- For a historical incident, confirm the effective current code/version and
  target before applying the historical fix. Ask for the minimal missing
  current confirmation, or propose a separately approved bounded read. Do not
  assume the old version remains deployed or create missing resources. An
  unresolved cause still needs the smallest missing evidence, not a speculative
  implementation.

After an actual local edit, distinguish local unit validation from deployed
behavior. State what changed locally and whether anything is effective in the
affected environment; do not imply deployment or production recovery. Propose
an approved existing validation/deploy workflow only as needed. Local-only fixes
do not require cloud deployment. Do not automatically run new tests, evaluations,
traffic or reads. Compare supplied evidence only after an actual effective
change in the scope being verified; a local-only comparison cannot certify
deployed behavior.

## After an actual change, offer bounded recovery comparison

Once an actual separately approved change is confirmed effective in the scope
being verified (not merely edited locally for a deployed symptom), proactively state
**Next action: Validate recovery** and ask **Would you like me to compare the
post-change evidence with the retained baseline and agreed guardrails?**
Select available `verify-observability-fix` through supported host loading for
that comparison, without requiring the developer to type its name. Reuse a
previously accepted verification request instead of asking again; preserve an
explicit stop/decline. A proposed or merely approved plan stays at **Guide an
approved fix**, not Validate, until an actual change is confirmed.

Verification consumes only existing explicitly supplied evidence: retain the
original symptom/baseline, actual changed version/time, agreed thresholds,
comparable population/window, freshness, volume and quality/error guardrails.
A yes or "continue" grants no new reads, jobs, traffic or persistence. If
required evidence or criteria are missing/stale, report INCONCLUSIVE and ask
one question for the minimal missing supplied evidence/decision, or propose a
separately approved collection workflow. Do not auto-collect or invent success.
Deployment success alone is not recovery; comparison does not establish cause.
After comparison, make the verdict, stage and any remaining bounded next action
explicit, without restarting diagnosis or forcing every task through four stages.

Once that result is reported and no evidence/fix decision is pending, follow
[monitoring follow-up](monitoring-follow-up.md): offer an existing/new AMG
dashboard, alert guidance, a developer-initiated later health check, or finish.
Honor stops/declines and existing preferences. Monitoring never replaces
comparison, changes an INCONCLUSIVE/NOT_RECOVERED verdict, or grants reads,
writes, auto-refresh, connections, scheduling or ongoing detection.
