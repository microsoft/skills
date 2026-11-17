## 4. Carry evidence through investigation and approved change

Load for substantive investigation/change synthesis. Follow
[monitoring follow-up](monitoring-follow-up.md) after the recovery verdict when
no other decision is pending; it never changes that verdict.

Keep the [handoff](handoff.md) in the conversation by default.
Preserve source/query labels, UTC times, units, denominators, sampling,
completeness, facts versus hypotheses, and actual correlation identifiers.
Do not assign evidence by completion order or invent topology.

For an existing health assessment, follow the [health continuation boundary](specialists.md#continue-from-an-existing-health-assessment).
Preserve the specialist's original finding rank/state and the developer's
selection. A recommendation or highest rank is not consent to investigate.
Do not run a second assessment to translate the first specialist's output.

Use the relevant specialist for a bounded investigation. If unavailable, explain
the gap and the next supported step; do not label a health summary as completed
RCA. A demonstrated downstream failure can be reported despite other gaps.
Coincident deployment/CPU changes are not proven cause.

After presenting material investigation evidence, follow
[the result-to-next-action contract](next-actions.md): name the
smallest supported change and offer plan review with one concise question.
After a completed supported plan, apply that contract's implementation step:
ask for missing source or propose the exact minimal edit for separate approval.
Do not jump from a plan or local edit to deployed recovery.
If cause remains materially unresolved, propose the smallest missing evidence
instead. A read-only diagnosis may offer planning, never execute a change;
explicit stop/no-follow-up and retained decisions govern continuation.
Optional [visual evidence](visual-evidence.md) must not compete with
that question; defer a new inline/Grafana offer. Honor an explicit visual request
at any stage and retain an existing choice/decline instead of repeating it.
Dashboard creation needs separately approved persistence/write access and a
confirmed existing AMG instance/datasource. Missing Grafana must not block
diagnosis, trigger provisioning or cause unrelated reads to fill panels.

For a proposed fix, identify the supporting evidence, target version, smallest
change, risks, acceptance criteria and rollback plan. Reuse existing Foundry
evaluation/optimization or application/deployment workflows where eligible.
Review their prerequisites and side effects before starting. Read-only remains
the default. Ask for the applicable approval before editing, creating a job,
generating traffic or deploying. Do not weaken evaluators or remove difficult
test cases to manufacture improvement.

## 5. Verify the customer outcome, then report

After an approved change has actually occurred, proactively offer bounded
comparison under [the result-to-next-action contract](next-actions.md).
Confirm the change is effective in the scope being verified: a local edit alone
cannot support deployed recovery; local-only fixes need no cloud deployment.
Reuse an already accepted verification request, otherwise ask one concise
question before comparison. A yes permits no new reads, jobs or traffic. Select
`verify-observability-fix` with the original symptom, changed version/time,
comparable evidence, agreed criteria, and existing deployment/evaluation results.
Do not rerun or create evaluations just to complete a report.
If only a plan exists, stay at Guide an approved fix. Missing/stale supplied
evidence requires the minimal missing input or separately approved collection,
not a fabricated recovery result.

Deployment success, HTTP 200, quiet alerts and a better evaluation score are
supporting facts, not sufficient recovery proof. Missing, stale, idle, partial,
noncomparable or denied required evidence yields INCONCLUSIVE. Report observed
failures without masking them behind unrelated missing evidence.

Return:

1. What is known about the customer's symptom and affected scope.
2. The current stage and evidence-backed finding/verdict, with explicit gaps.
3. What happened: instructions read/host-loaded, operations executed, retained
   evidence used, side effects approved, and fallback or skipped steps.
4. The next bounded action and any approval needed, or the recovery result.

Do not turn every answer into a contributor-credit table. Execution provenance
is for truthful reporting and debugging, not ceremony. Never claim all stages
ran when only instructions were read or offline fixtures were tested.

Offline fixtures do not establish installed-host routing, execution or recovery.
