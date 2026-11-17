# Bounded trace and workload queries

## Standalone availability gate

Check availability before reading the cross-skill trace reference below.
Use available shared guidance unchanged; never download, install or require a
missing sibling-file read. If absent, keep these local schema/scope/window
patterns and remaining read/row budgets, use only sufficient existing authorized
operations and report material coverage gaps. No bulk reconstruction, invented
operations or wider reads; insufficient evidence remains INCONCLUSIVE.

Use these patterns after resolving the exact incident operation IDs and actual
source/schema. Workspace tables below are candidates, not component dialects.
For population/critical-path/top-attribute questions, use the shared
[trace capability reference](../../trace-capabilities.md):
prefer sufficient supported server-side analysis; these representative queries
are not a bulk-download or local population-analysis workflow. Resolve the
reference without claiming another skill loaded.

## Tool-call causal chain

1. Query `AppDependencies` by exact `OperationId` and tool name to resolve the
   failing tool span IDs.
2. Query child dependencies with exact `ParentId`/`Id`; project only endpoint,
   duration, status, result code, and selected semantic property keys.
3. Query `AppExceptions` by exact operation and parent span. Use `ParentId`,
   `ExceptionType` and a minimized sanitized category from `ProblemId`;
   `AppExceptions` does not guarantee an `Id` column.
   Do not project raw exception messages or stacks under noncontent approval.
4. Query `AppTraces` by exact `ParentId`. Do not search full messages for generic
   words such as `manual`, `cache`, `error`, or `connection`; agent prompts and
   ordinary headers produce large false-positive result sets.
5. Resolve fallback spans by exact operation and tool name, then compare their
   timing and status with the failed dependency.

Explain separately:

- transport/dependency status;
- exception type and parent span;
- structured tool result and semantic error fields;
- lifecycle logs that say success because a value was returned;
- retry and fallback outcomes;
- parent-agent outcome.

## Container logs

Filter namespace, pod/container, time window, and a specific error marker before
projecting messages. Do not infer severity from `LogLevel` alone. Inspect a
small representative sample before counting, and avoid broad tokens such as
`connection` that match normal HTTP headers.

## Kubernetes inventory

For current state, include `PodCreationTimeStamp`, `PodStartTime`, `PodUid`,
controller, pod status, container status, and restart count. Separate current
running controller members from retained terminated jobs whose telemetry has a
fresh `TimeGenerated` but an old creation time.

## Probe ledger

Record every material caller probe:

- `passed`: succeeded as intended;
- `recovered`: initially failed or was invalid, then corrected;
- `failed`: unresolved functional failure;
- `permission_gap`: required evidence denied;
- `not_required`: optional probe whose evidence was already available elsewhere.

Keep the caller probe ledger separate from any external service's evidence audit.
