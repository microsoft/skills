# Assessment evidence and handoff

This is a conversation-level output contract, not a new persistence format or
an API. The caller must report actual tool evidence and gaps. No local runtime
is needed to write a truthful chat assessment.

## Evidence table

Use one row per named signal/source/scope:

| Field | Requirement |
|---|---|
| Signal | Name from query result, not inferred from row position |
| Source | Verified resource ID or a short alias with its ID retained in context |
| Query reference | Actual operation and query/metric identifier; retain filters and explicit UTC bounds |
| Retrieval time | Actual UTC tool/check time |
| Counts | Label stored rows versus represented events versus logical operations; unknown is not zero |
| Outcome | Failure/latency/quality measure with units, denominator and sampling limitations |
| Latest event | Actual returned timestamp, or unavailable |
| Coverage | Usable, denied, empty, stale, failed, throttled, partial, unsupported, or unverified |
| Completeness | Reported complete/partial/truncated, or no partial error reported with completeness otherwise unknown |

Preserve the association between every value and its original query result.
If a summary disagrees with source evidence, disclose and reconcile the
disagreement before using it. Never silently relabel or select the more
convenient result.

Thresholds and activity expectations must come from the user or verified
configuration/policy, with their basis stated. Unknown threshold means report
the measurement without calling it a regression or declaring it normal.

## Verdicts

Use the single [health classification contract](health-contract.md) for verdicts,
finding states and ranking. Do not compute a parallel public/contributed verdict.
Historical failures do not establish current degradation or change recovery.

If all recent traffic is idle, do not infer availability from zero errors.
If pressure/quality is core and unavailable, do not declare that full scope
healthy from request success alone.

Readiness classification and health verdict are distinct. In tools-only
onboarding, readiness may be "not computed"; a health assessment may still
report a supported observation or INCONCLUSIVE. Never imply the onboarding
helper was run or that it independently verified the evidence.

## Finding handoff

Retain only minimized context:

- Selected finding and whether it is current, historical, or a coverage gap.
- Existing specialist title, rank, finding state, ranking basis and investigation
  recommendation when supplied. Preserve its fields rather than generating a
  second assessment; unknown rank/state stays unknown.
- The developer's chosen finding, distinct from the assessment's recommendation.
- User-confirmed task, application/environment and verified affected IDs.
- Observation window, retrieval times, expected traffic and criteria.
- Quantified evidence with source/query references and completeness caveats.
- Actual representative operation/trace/span IDs, when resolved.
- Facts versus hypotheses, contradictions, known test/fixture conditions.
- Next bounded read needed and any additional access/approval requirement.

Keep distributed trace, investigation, agent conversation, and cross-product
correlation IDs distinct. Do not invent a universal identifier. Do not persist
raw telemetry or automatically send context to an external/internal specialist.

If the next request investigates a completed assessment, reuse this evidence
and selection. Do not repeat health assessment or replace the specialist's
finding state with a coordinator verdict. A `recovered` assessment finding does
not establish `VERIFIED_RECOVERED` after an approved change.
