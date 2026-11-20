# Trigger & Binding Troubleshooting

Diagnostics for HTTP, Timer, Queue, Blob, Service Bus, Cosmos DB, and Flex Consumption.

## HTTP Trigger

| Symptom | Cause | Fix |
|---------|-------|-----|
| 404 on known route | Route template mismatch or function not indexed | Check `route` in `function.json`/attribute; confirm the function loaded via `az functionapp function list` |
| 500 on every request | Unhandled exception in the function | Query `exceptions` in App Insights for the stack trace |
| 408 / timeout | Execution timeout or gateway idle timeout | `functionTimeout` controls execution, but HTTP responses still have a 230-second platform limit. For long work, return 202 with a status endpoint or use Durable HTTP APIs |
| 401/403 unexpected | Function-level auth key mismatch, or Easy Auth intercepting the route | Verify `authLevel`; check `az webapp auth show` if App Service Authentication is enabled |

```kusto
requests
| where toint(resultCode) >= 400
| order by timestamp desc
| take 50
```

## Timer Trigger

| Symptom | Cause | Fix |
|---------|-------|-----|
| Timer never fires | Invalid NCRONTAB expression | Validate the schedule with an NCRONTAB parser; check `TZ`/`WEBSITE_TIME_ZONE` if the schedule assumes a non-UTC zone |
| Timer fires twice | `runOnStartup` adds invocations as hosts start, or another app/slot runs the schedule | Set `runOnStartup` to `false` in production and inventory deployments. Normal scale-out isn't the cause: a blob lease allows one scheduled invocation per app |
| Timer never fires or runs late | Host storage is unavailable, the app is stopped/disabled, or the host ID collides with another app using the same storage | Check `AzureWebJobsStorage`, host storage permissions, `AzureFunctionsWebHost__hostid`, and `Host.Triggers.Timer` traces. Always On applies only to Dedicated plans; Consumption and Flex timers are designed to wake from zero |
| Missed-run catch-up not happening | Schedule monitoring is disabled | Set `useMonitor` to `true` when catch-up is required. It defaults to `true` for intervals of at least one minute and `false` for more frequent schedules |

## Queue Trigger

| Symptom | Cause | Fix |
|---------|-------|-----|
| Message never processed | Poison message after `maxDequeueCount` (default 5) retries | Message moved to `<queue>-poison`; inspect it to find the root cause |
| Duplicate processing | Host stopped after side effects but before message deletion, or another consumer read the queue | The Functions host renews visibility during an invocation; `visibilityTimeout` controls retry delay after failure. Check host restarts and make side effects idempotent |
| Function stops triggering | Storage authentication fails | Re-check `AzureWebJobsStorage` and `Host.Listener` traces for `StorageException` |

```bash
# Peek poison messages
az storage message peek --queue-name "<queue>-poison" --account-name <account> --num-messages 32
```

**After fixing the root cause, verify before bulk-replaying:**
1. Review prior attempts' downstream state/logs and establish a safe, idempotent replay path before re-enqueuing any message.
2. Re-enqueue one representative poison message (not the whole batch) and confirm it completes successfully without duplicate side effects.
3. Confirm its `dequeueCount` stays at 1 (no further retries) and the function's App Insights `requests` entry shows `success == true`.
4. Watch the `<queue>-poison` queue depth over the next few minutes/hours to confirm it stops growing for that failure signature before replaying the remaining messages in a bounded batch.

## Blob Trigger

| Symptom | Cause | Fix |
|---------|-------|-----|
| Trigger delayed by minutes | Blob-trigger polling (non-Event Grid path) scans the container on a timer | Switch to the Event Grid-based blob trigger (`source: "EventGrid"`) for near-real-time triggering |
| Trigger never fires for a version | A receipt already exists for that blob path and ETag | Overwriting the blob creates a new ETag and should trigger. To reprocess the same version, delete only its matching receipt after confirming duplicate side effects are safe |
| Trigger fires for the wrong container | `path` pattern too broad or missing container scoping | Tighten the `path` binding expression (e.g. `samples-workitems/{name}`) |

## Service Bus Trigger

| Symptom | Cause | Fix |
|---------|-------|-----|
| Message stuck retrying | `MaxDeliveryCount` exceeded, moved to dead-letter | Inspect the dead-letter sub-queue for the underlying exception |
| `MessageLockLostException` | Execution exceeds lock renewal, or high prefetch lets locks age before processing | For single-message triggers, reduce work/prefetch or increase `maxAutoLockRenewalDuration` (default 5 minutes). It doesn't apply to batches; batch processing must finish within the entity's lock duration. Use manual renewal only with `autoCompleteMessages: false` and exposed message actions |
| No messages arriving | SAS key rotated, or namespace network rules block the Functions host | Verify the connection app setting; check namespace firewall/VNet rules if not using a private endpoint |

```text
# View dead-letter message contents
# Azure CLI does not support peeking Service Bus dead-letter message bodies directly.
# Use one of the following instead:
#   - Service Bus Explorer in the Azure portal (namespace -> Queues -> <queue> -> Dead-letter)
#   - An Azure Service Bus SDK (.NET, Java, Python, or JavaScript) with a receiver scoped
#     to "<queue>/$DeadLetterQueue", using a peek or receive operation.
```

## Cosmos DB Trigger

| Symptom | Cause | Fix |
|---------|-------|-----|
| Independent apps receive only part of the feed | Apps share a lease container and prefix, so they load-balance one logical processor | Give each independent workflow a unique `leaseContainerPrefix`, or use a dedicated lease container |
| No changes delivered | Lease container missing, or `createLeaseContainerIfNotExists` is false without a pre-created container | Verify the lease container exists; grant the identity/connection write access to it |
| Missing/default fields or deserialization failure | Bound model doesn't match document shape, casing, or schema version | `StartFromBeginning` only controls initial feed position and is ignored after checkpoints exist. Compare the document with the bound type, then inspect it through a supported raw JSON type (`JsonElement`, `string`, or `JObject`) |
| Feed replays from the start unexpectedly | New lease container, or `StartFromBeginning: true` with no existing leases | Expected on first deployment; set `StartFromBeginning: false` (default) after backfill. It only affects lease creation with no prior checkpoint |

For a manually created lease container, use partition key `/id`. The trigger identity needs
read/write access to lease items. Multiple triggers can share that container only when each
uses a unique `leaseContainerPrefix`.

## Flex Consumption Specifics

| Symptom | Cause | Fix |
|---------|-------|-----|
| Cold start despite "always ready" expectation | No always-ready instance for the function's scale group | Configure `http`, `durable`, `blob`, or `function:<FUNCTION_NAME>` with `az functionapp scale config always-ready set` |
| Can't reach a VNet-integrated resource | VNet integration is absent or routing, security, or DNS blocks the destination | Inspect the plan-specific subnet delegation, DNS resolution, route table, and NSG. Change Route All only when the observed routing requirements justify it |
| Deployment succeeds but scaling is capped | Maximum instance count or the regional subscription memory quota is exhausted | Inspect `az functionapp scale config show -g RG -n APP`; check **Usage + quotas** for the subscription and region |
| Binding fails after dependency changes | Mixed Functions programming models or incompatible binding-extension versions | Use one programming model and align its binding packages. .NET isolated apps use `Microsoft.Azure.Functions.Worker.Extensions.*`; non-.NET apps using extension bundles should not also install the same binding extensions manually |
| Outbound/dependency calls fail or time out under load while CPU, memory, host health, and other destinations stay normal | Outbound SNAT/ephemeral-port pressure on the shared or subnet egress path | Don't rule this out just because a NAT Gateway is absent or a SNAT-specific detector has no data — a missing NAT Gateway on the integration subnet is itself evidence *for* SNAT pressure, not against it. Decide from telemetry: compare new-connection counts, connection-reuse rate, and concurrency against `EADDRNOTAVAIL`/`ETIMEDOUT`/timeout counts between the failing window and a healthy baseline. High new-connection volume with low reuse under concurrency, correlated with the failure window, points to connection/SNAT pressure even without a detector confirming it directly; only attribute failures to the partner/dependency when the evidence (e.g., partner-reported throttling codes, stable low-churn connection pattern) actually supports that instead |

For Function networking failures, make the final response decision-useful:

1. **Topology**: Name the observed hosting plan, integration subnet and delegation, destination subnet or endpoint, DNS path, and relevant route or NSG associations. Distinguish the source and destination network paths.
2. **Cause**: Connect route, NSG, DNS, and telemetry evidence to the failure timeline.
3. **Scope**: Explain which destination is affected, why health checks, host or deployment dependencies, and other destinations remain healthy when supported by evidence, and whether Route All is relevant.
4. **Fix**: Recommend the smallest reversible correction; don't apply it without authorization. If the fix provisions a billable resource (e.g., a NAT Gateway, public IP, or Premium tier), state its ongoing cost and how to remove it once the final report confirms recovery.
5. **Verify**: Recheck DNS, effective routing and security, resource health, the failed operation, and correlated telemetry. Never stop, start, or restart the app to force recovery — that action is prohibited even when an initial post-fix probe still shows pre-fix behavior. If the same repro call still fails after a confirmed-correct change, assume stale/pooled connections from before the fix and either retry after a brief wait for natural connection turnover or look for a distinct parameter, mode, or endpoint meant to validate recovery (some repro calls are fixed pre-fix evidence probes). When citing a recovered identifying property (e.g., an egress IP), confirm it with a live, post-fix outbound call that reports the observed value directly (e.g., an IP-echoing endpoint) and compare it to the resource's assigned value — don't infer the match from the resource's configuration alone or from an earlier narrative mention. If the repro requires an authenticated call and the key isn't already in hand, retrieve it through the management plane (e.g., `az functionapp keys list` / `az functionapp function keys list`, or the equivalent MCP tool) — this reads an existing secret, it doesn't weaken auth. Treat correlated telemetry (NAT datapath stats, SNAT counters) as supporting evidence only; it does not substitute for the live repro call when one is required to close the verification gate. Only report the gap and fall back to telemetry-only evidence if key retrieval itself is genuinely unavailable, and say so explicitly.

State only verified facts and identify any evidence gaps. The final report must include the resource's ongoing cost and removal steps whenever the fix added a billable resource.

## Integration Testing Trigger Failure Paths

Assert the failure path, not just the happy path:

- **Queue**: force failure; confirm the message reaches `<queue>-poison` after `maxDequeueCount`.
- **Service Bus**: exceed lock renewal; confirm retries don't duplicate side effects.
- **Cosmos DB**: omit a required field; assert a clear deserialization error.
- **HTTP**: verify long work returns 202 instead of waiting past the gateway limit.
