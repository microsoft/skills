# Supplied recovery evidence, version 1

This is a local, transient, offline input contract, not an Azure API, SLO
standard, source authenticity verifier, or general evaluation engine. It follows
the onboarding helper's stdlib Python 3.9+, strict JSON, UTC, bounded input and
sanitized-error conventions but does not depend on sibling helper directories.

Every object below has **exactly** its listed fields. Unknown fields, duplicate
JSON keys, unsupported enum values, nonfinite numbers (including exponent
overflow), invalid timestamps, and inconsistent counts are input errors. Lists
are bounded. No raw text fields exist. All labels/references are 1-128 ASCII
letters/digits/`.`/`_`/`-`, beginning with a letter/digit. This is format
restriction, **not automatic redaction**: never submit secrets even as labels.

## Root

| Field | Exact meaning/type |
|---|---|
| `schema_version` | Integer `1`, not boolean |
| `incident` | Sanitized incident reference label |
| `scope` | Scope object below |
| `change` | Actual change object below |
| `evaluated_at` | Explicit UTC ISO 8601 timestamp, no later than current time |
| `max_evidence_age_seconds` | Positive integer; maximum post-result collection age and assessment reuse age |
| `checks` | 0-50 check objects; unique `id` |
| `supporting_results` | 0-50 objects with exactly `kind` (`deployment`/`evaluation`), `reference` (label of an existing result), `state` (`passed`/`failed`/`partial`/`unknown`) |

`scope`: exactly `environment` (label), `targets` (1-50 unique labels),
`confirmed` (boolean), `confirmed_at` (UTC, no later than evaluated time).
Targets are sanitized aliases of **explicitly confirmed deployed targets**,
not inferred associations. The owner must retain the actual target/source
associations and provenance in the authorized conversation/source system.
These labels do not establish cloud resource existence/access. Confirmation
may happen after deployment or historical collection; it must apply to the
entire retained evidence scope. Unconfirmed scope remains INCONCLUSIVE.

`change`: exactly `id`, `version` (labels for actual approved change and deployed
candidate version/configuration), `deployed_at` (UTC, no later than evaluated
time), `confirmed` (boolean attesting actual deployment to **all** listed targets).
If targets changed at different times/versions, use separate inputs; do not
collapse them into a fictitious deployment. Unconfirmed change is INCONCLUSIVE.

All UTC timestamps require `T` and `Z` or zero offset, including fractional
seconds if desired. All integer limits are 1-2147483647 unless specified
otherwise; booleans are not numbers. The helper uses current UTC at execution,
not an input-controlled “now.” Equality at age/duration/sample/threshold
boundaries is accepted.

## Check

| Field | Exact meaning/type |
|---|---|
| `id`, `target` | Labels; target must belong to scope |
| `role` | `symptom` or `guardrail` |
| `required` | Boolean; optional gaps/violations are reported but do not decide the overall verdict |
| `metric`, `unit` | Labels identifying one identical metric definition and unit in both windows |
| `kind` | `mean`, `fraction`, `percentile`, or `unsupported` |
| `operator` | `lte` (at most bound) or `gte` (at least bound) |
| `threshold` | Explicit finite nonnegative number, fraction bound at most 1 |
| `expected_workload` | Label of the agreed traffic/population/cohort definition |
| `comparable` | Boolean owner attestation of original/post workload and measurement comparability |
| `min_samples` | Explicit positive minimum represented observations in **each** window |
| `min_observation_seconds` | Explicit positive minimum window duration **and actual first-to-last event span** in each window |
| `freshness_seconds` | Explicit positive maximum event age: original latest relative to original end; post latest relative to **current time** |
| `original`, `post` | Evidence objects below |

**Conditional check field:** only `kind=percentile` has the additional required
field `percentile`: a finite numeric value strictly greater than 0 and at most
100 (for example `95` for p95), never boolean. Other kinds retain their exact
fields above and must not include it.

No inferred defaults. A mean is a measured nonnegative sum divided by represented
observations; a fraction is an integer matching-event count divided by integer
eligible-event count. `sample_count` is the denominator, **not aggregate rows**.
Mean units must be consistent. For fraction, use unit `ratio` and values 0-1;
percentages must be converted explicitly by the evidence provider. Percentile
checks instead compare an actual **source-computed percentile value directly**
to the explicit bound. Do not reconstruct a percentile from averages, multiply
it by a count to fabricate a total, or average percentiles across subwindows.
Same-percentile comparability attests consistent percentile/quantile definition,
source algorithm/approximation, target population, query semantics and units.
The helper does not calculate percentiles from observations or validate the
source computation.

Do not feed an average-of-averages, percentile, rate-per-time, missing denominator,
composite evaluation score, or HTTP status code as a mean/fraction. Represent unsupported
measurements with `kind=unsupported` (INCONCLUSIVE); an unrecognized kind is
invalid schema. The helper cannot detect a falsely described metric.

Comparability attests consistent target/environment filters, metric/query
semantics, instrumentation, aggregation/unit, sampling, traffic mix, cohort,
coverage and relevant workload conditions; matching labels alone do not prove
it. Different window lengths are permitted only when that attestation is valid
for the normalized measurement. Never compare raw counts as normalized rates.
No statistical significance or population equivalence is inferred. Check IDs
must describe the incident's agreed original symptoms and guardrails. Cover
multiple targets explicitly with checks; target membership alone proves nothing.
Passing aggregate gates does **not** establish continuous/sustained SLO compliance
between observations. When that is the criterion, the agreed plan must include
separate required checks for every agreed subwindow, with actual evidence for
each. Neither an overall percentile nor first-to-last event span proves unseen
intervals were healthy.

## Evidence object (both windows)

| Field | Exact meaning/type |
|---|---|
| `state` | `usable`, `missing`, `denied`, `empty`, `stale`, `partial`, `failed`, `unsupported`, `noncomparable`, `throttled`, `unverified` |
| `complete` | Boolean; true only with full, nontruncated source/window coverage |
| `source` | Sanitized label/reference to the actual telemetry/evaluation source used |
| `query_ref` | Sanitized reference to the **actual query and result**, retained in the authorized source/conversation, not query text or an invented operation |
| `collected_at` | UTC time of actual result/status collection |
| `window_start`, `window_end` | UTC bounds: start < end <= collected <= evaluated |
| `first_event_at`, `latest_event_at` | UTC earliest/latest represented event timestamps inside window, or null |
| `sample_count` | Integer 0-2147483647 represented eligible observations, or null |
| `total` | Finite nonnegative measured sum (`mean`), integer matching-event count 0..sample_count (`fraction`), or null; **must be null for percentile** |
| `workload` | Agreed population label, must match check's expected workload to be adequate |
| `version` | Actual filtered workload version/configuration label; post must equal change version |

**Conditional evidence fields:** only `kind=percentile` has both additional
required fields:

- `percentile`: finite number >0 and <=100, identifying the actual source result's
  percentile. It must match the check's percentile for adequate evidence.
  A valid but different percentile yields `original_percentile_mismatch` or
  `post_percentile_mismatch` and that window cannot establish recovery or a
  violation. Invalid numbers/ranges/types are input errors.
- `percentile_value`: finite nonnegative source-computed numeric measurement in
  the declared unit, or null when unavailable. Null is INCONCLUSIVE. Booleans,
  negatives and nonfinite numbers are invalid. A value requires positive actual
  `sample_count`; unknown/zero samples require null value. A positive count
  still requires valid first/latest timestamps and minimum sample/span gates.

Other kinds reject these additional fields. `sample_count` remains the number
of actual represented eligible observations, not the number of returned
percentile aggregate rows. Null `total` on a percentile is required, not missing
measurement; `percentile_value` is the measurement for that kind.

Each evidence object is explicitly bound to its containing check's target,
environment, metric, unit and window. The provider must confirm these filters,
the source association and real query provenance; the helper cannot inspect
remote references or verify assertions. Unknown source/query references should
use a sanitized placeholder with `state=unverified`, never `usable`.

Null count requires null total and null event times. Zero count requires null
event times and null or zero total. Positive count requires both event times;
one sample requires identical first/latest times. A null total remains
INCONCLUSIVE for mean/fraction even with a known positive count. `empty` requires zero count;
`partial` requires `complete=false`. `usable` with missing totals, zero samples,
or incomplete coverage does **not** bypass gates. All non-usable states remain
distinct in reason codes and cannot establish recovery or a proven violation.

Original window end <= deployment; post window start >= deployment. Violations
of these chronological constraints are invalid input, not a heuristic gap.
Original collection can occur after deployment when querying historical data.
Historical originals are not expired against current time: freshness is checked
against their own window end. Post collection and assessment age are checked
against current time. Positive samples spanning too little actual time cannot
pass merely because the requested query window was long.

## Arithmetic and precedence

The helper validates **the entire document first**, even optional checks. Invalid
input returns no verdict. It then computes per-window gaps and reads a numeric
`percentile_value` directly for percentile, or computes `total / sample_count`
for mean/fraction, only for supported adequate evidence.

1. Unconfirmed scope/change or expired assessment blocks any proof.
2. With those global prerequisites satisfied and comparability affirmed, an
   adequate required post window violating its absolute bound yields
   **NOT_RECOVERED**, even if its original evidence is missing or another check
   is failed/denied/partial. Explicitly noncomparable evidence cannot prove a
   threshold violation or recovery.
   The proof is of current violation, not of regression or change causation.
3. Otherwise **VERIFIED_RECOVERED** requires at least one required symptom,
   for each listed target, and **all** required checks with adequate original and post evidence,
   comparability affirmed, candidate version matched and post bound passed.
   Every required symptom must also have violated its original bound. Passing
   guardrails require valid baselines but need not have originally failed.
   No included supporting result may have unresolved non-passed status.
4. All remaining cases are **INCONCLUSIVE**, including an empty/optional-only
   plan or an original symptom whose failure is not established.

Optional checks do not hide a proven required violation, nor do they alone
prove failure/recovery. The task owner must mark all necessary guardrails
required. Supporting deployment/evaluation status flags **never independently
establish recovery or nonrecovery**. However, any included `failed`, `partial` or
`unknown` supporting result produces the root coverage gap
`unresolved_supporting_evidence`, preventing VERIFIED_RECOVERED. These objects
lack candidate/version/time applicability fields, so the helper cannot dismiss
potentially contradictory support as irrelevant. A sufficient required post
violation still yields NOT_RECOVERED despite this gap. Per-check comparisons
remain unchanged; the supporting gap is reported at root scope.

Resolve relevance using actual applicable required checks; a relevant evaluation
failure cannot be hidden in supporting metadata. Any included non-passed result
remains unresolved to this helper. Omit only support demonstrated irrelevant
with an explanation outside the input, rather than silently dropping relevant
failures, relabeling status or tweaking scores. Empty `supporting_results` is
allowed with an actual confirmed change. Passed support alone never proves
recovery; all required measurable evidence must still satisfy the gates.

Per-check output: zero-based `check_index` (join to input without echoing IDs),
`required`, `verdict`, `reasons`, `original_value`, `post_value`, `delta`.
Values are null when that window is inadequate. Delta is post minus original,
only when there are no evidence/plan gaps; it is descriptive, not a statistical/cause claim.
A symptom that failed originally and still fails post can have a delta while
remaining NOT_RECOVERED. Insufficient original evidence never masks a sufficient
post violation; reasons preserve both.

Root output: `schema_version=1`, `verdict`, `reasons` (global gaps and/or
`required_symptom_missing` / `required_target_symptom_missing` /
`unresolved_supporting_evidence`), `checks`,
`supporting_results_establish_recovery=false`.
Inspect per-check reasons as well as root reasons. No scope/incident/source/
query/version labels, raw input, or supporting result references are echoed.
Reason codes are fixed strings (`source_<state>` prefixed with `original_` or
`post_`, sample/span/freshness/measurement/workload gaps, plus explicit global/
comparability/version/percentile/original-symptom gaps, and `post_threshold_violation`);
no confidence scores.

## Run the comparison

```text
python "<skill-directory>\scripts\recovery.py" <sanitized-input.json>
```

Resolve `<skill-directory>` from the installed skill location, not the
application workspace. Use an existing approved Python 3.9+ interpreter; do not
install a runtime. If unavailable, use tools-only comparison with the same
arithmetic, chronology, completeness and verdict rules. If exact validation
cannot be performed, report INCONCLUSIVE.

Input is UTF-8 JSON, maximum 128 KiB; the helper reads at most limit + 1 byte.
Exit `0` means classification succeeded, **not recovery**: inspect `verdict`.
Exit `2` means invalid schema/JSON/arguments, oversized input or local read error;
stderr is a fixed sanitized error without paths, input values or traceback.
`--help` prints usage only. Output contains minimized aggregates which can still
be sensitive: review before sharing. There are no output/save/network/subprocess
operations. Do not create persistent inputs/results without separate consent.

The adjacent `fixture.json` (fraction) and `fixture-p95.json` (source-computed
slow-agent p95 latency) are entirely synthetic. Running them with current time much
later than their timestamps correctly returns INCONCLUSIVE. Do not widen
freshness or alter “now” to make a live result green. Synthetic examples do not
establish live recovery or source accuracy.
