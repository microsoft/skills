# Local mapping and readiness contract, version 1

Experimental local format, not a platform API or universal correlation schema.
The helper is standard-library Python and executes no cloud operations.
This contract applies when the helper runs. Without an approved runnable Python
interpreter, the skill can continue tools-only read-only onboarding, but must
report that readiness classification was not computed and must not persist a
mapping. Conversation observations are not helper-validated contract output.
Unknown fields and duplicate JSON keys are rejected; input errors never echo
field values. Input files are limited to 128 KiB.

## Mapping

Required fields, with no extras:

- `schema_version`: integer `1`.
- `application`, `environment`: labels of 1-64 ASCII letters, digits, `.`, `_`,
  or `-`, beginning with a letter/digit. Use labels, not prompts or URLs.
- `workload`: `web-api` or `foundry-agent`.
- `confirmed_at`: timezone-aware UTC ISO 8601 timestamp, not in the future.
- `resources`: 1-50 objects containing `resource_id` and `basis`.
- `telemetry_sources`: 1-50 objects containing `resource_id`, `kind`, and `basis`.

IDs must be subscription/resource-group-scoped Azure resource IDs, not portal
URLs, credentials, query strings, or resource-group IDs alone. Nested resource
types are supported. IDs must be unique within each list (case-insensitive).
The initial parser accepts only ASCII resource-name segments using letters,
digits, `.`, `_`, `-`, and parentheses, beginning with a letter/digit. Other
Azure naming forms must be reported as a local parser limitation, not an
invalid or nonexistent cloud resource.
`basis` is `user-confirmed`, `deployment-output`, or `resource-metadata`.
Source `kind` is `application-insights`, `log-analytics`, `azure-monitor-workspace`,
`grafana`, or `foundry-project`; its ARM provider/type must match.

```json
{
  "schema_version": 1,
  "application": "example-api",
  "environment": "staging",
  "workload": "web-api",
  "confirmed_at": "2026-10-29T12:00:00Z",
  "resources": [
    {
      "resource_id": "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/example/providers/Microsoft.Web/sites/example-api",
      "basis": "user-confirmed"
    }
  ],
  "telemetry_sources": [
    {
      "resource_id": "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/example/providers/Microsoft.Insights/components/example-ai",
      "kind": "application-insights",
      "basis": "resource-metadata"
    }
  ]
}
```

This example is synthetic. Structural validation does not prove resource
existence, association, consent, or access. Confirm the full scope in chat,
including multiple subscriptions. Provenance categories summarize evidence;
retain actual evidence references transiently in the conversation.

## Transient assessment

Required fields:

- `schema_version`: integer `1`.
- `mapping`: a valid mapping, or `null` when not resolved.
- `checked_at`: UTC assessment time.
- `max_check_age_seconds`: positive integer specifying how long checks may be
  reused. This is a task-specific input, not a default policy.
- `prerequisites`: exactly `tools`, `identity`, and `mapping`, each with state
  `verified`, `missing`, `denied`, `failed`, or `unverified`.
- `signals`: up to 50 objects using the fields below.

A verified mapping prerequisite requires a valid mapping. An assessment cannot
predate mapping confirmation; a signal check cannot predate confirmation.
With all prerequisites verified, declare at least one required signal; an empty
plan cannot establish readiness.

Every signal contains exactly:

| Field | Value |
|---|---|
| `name` | `requests`, `dependencies`, `traces`, `exceptions`, `metrics`, `agent-runs`, `evaluations`, `model-calls`, or `tool-calls` |
| `source_resource_id` | A source ID from this mapping; signals require resolved mapping |
| `required` | Boolean; whether this signal is core to the declared task |
| `state` | `usable`, `missing`, `denied`, `empty`, `stale`, `throttled`, `failed`, `partial`, `unverified`, or `unsupported` |
| `checked_at` | UTC timestamp of the check/status determination |
| `window_start`, `window_end` | Explicit UTC observation bounds, start before end, end no later than the check |
| `freshness_seconds` | Positive integer for the task's expected event freshness |
| `record_count` | Nonnegative integer count of telemetry events, or `null` when unknown; not aggregate response row count |
| `latest_event_at` | UTC latest event timestamp inside the window, or `null` |
| `complete` | Boolean; absence of partial/truncated results for this check |

Signals are unique by name/source. `usable` requires complete, positive-count
data and a last-event time. `empty` requires complete, zero-count data and no
last-event time. `partial` must not claim completeness. Zero-count observations
cannot contain a latest event, and positive counts require one. All timestamps
must be no later than the supplied assessment/current time.

The helper recomputes freshness against the current time, not just the time of
the original check. Expired checks become effectively `unverified`; otherwise
old `usable` data becomes effectively `stale`. Original states remain in output.
No threshold is silently widened.

### Classification

- **blocked**: a prerequisite is missing/denied/failed, or a required signal is
  missing/denied/failed/unsupported.
- **telemetry-unverified**: prerequisites remain unverified, or no required signal
  is currently usable.
- **limited-coverage**: some required signals are usable but other declared
  signals have gaps.
- **ready**: prerequisites and all declared signals are currently usable.

Expired checks invalidate prerequisites too: a report older than its explicit
check-age limit is telemetry-unverified unless an existing blocker remains.
Readiness is not a health verdict. Neither a positive count nor complete
transport telemetry proves successful customer outcomes or agent quality.

`assess` returns `readiness`, stable reason codes, and per-signal original and
effective states with the supplied metadata. These are local input-derived
results, not independently verified evidence.

## Persistence

`save` writes only a validated mapping to `<project>\.obs\application.json`.
It requires `--consent`, Git confirmation that the destination is ignored, and
`--replace` to overwrite. Tracked destinations and symlink destinations are
rejected. It does not update ignore rules or create cloud connections.

`load` reads that exact path and validates it; it does not revalidate Azure.
No report, token, identity preference, connection string, prompt, or telemetry
payload is retained by these commands. Resource IDs and labels are still local
organizational metadata: review before sharing.

Exit `0` indicates successful validation/classification/persistence; inspect
`readiness` for the operational result. Exit `2` indicates invalid input or
an explicit local I/O/prerequisite error. Error messages omit input values.
