# Continue monitoring after a recovery check

Load only after reporting a recovery verdict, or for an explicit ongoing
monitoring request. This is optional follow-up, not another recovery comparator.
An INCONCLUSIVE or NOT_RECOVERED result remains unchanged even if a dashboard
is created or alerts are configured. State remaining evidence gaps first.

## One choice, using the retained investigation

Honor an existing choice, decline, no-follow-up or stop. Do not crowd a pending
evidence/fix decision with a second question. If no decision is pending, offer:

> How would you like to keep watching this issue?

Use available host choices: **Existing AMG dashboard**, **Alert guidance**,
**Later health check**, **Finish here**. A developer may explicitly choose a
new dashboard. Selection authorizes discussion/plan review only, not reads,
connections, writes, scheduled jobs or ongoing background monitoring.

| Selection | Concrete next step |
|---|---|
| Existing AMG dashboard | Follow [visual evidence](visual-evidence.md); use scoped approved search/inspection of a confirmed instance, then a verified link |
| New AMG dashboard | Follow the same contract; confirm instance/folder/datasource and review panels before separate creation approval |
| Alert guidance | Review source, issue-specific signal, agreed threshold/window, severity, audience/action group, noise/cost, test and rollback; discover an applicable authoring workflow before execution |
| Later health check | Agree a suggested time/window, expected activity, symptom and guardrails; explain that the developer must initiate it unless a separately approved supported scheduler exists |
| Finish here | End with the verdict and gaps; no repeated offers or background work |

For an ongoing dashboard, distinguish an incident's fixed UTC window from an
explicitly agreed rolling observation window. Confirm target/environment/version
filters and sampling, source semantics and refresh cadence. Auto-refresh stays
off unless separately approved; viewing/refreshing panels can execute datasource
queries and incur costs. Reuse collected evidence; no speculative panels.

Unknown thresholds require agreement, not invented SLOs. Quiet alerts can mean
idle traffic or missing data. Notification destinations and dashboard audiences
can expose organizational information; obtain relevant access/data-handling
approval. Never silently create an AMG instance, datasource, alert, action group,
identity, role assignment or new connection.

If tools, authoring guidance or access are missing, explain the exact blocker and
offer a useful in-chat plan or retained-evidence table. Missing Grafana never
blocks the recovery report. If no comparator is available, report recovery
unverified and offer monitoring without claiming a verification execution.

Retain the chosen follow-up, proposed scope/window/cadence, approvals and declines,
actual artifacts/actions and their metadata/query-validation status in the handoff.
Metadata success does not prove panel rendering, alert delivery or incident recovery.
