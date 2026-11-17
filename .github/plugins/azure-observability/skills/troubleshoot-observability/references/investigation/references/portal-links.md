# Azure portal links for RCA evidence

## Standalone availability gate

Check availability before invoking the optional cross-skill helper below.
Use the existing shared helper when present and separately approved; never
download, install or require a missing sibling-file read. If absent, retain
the investigation and use a verified existing source/component link or omit
the unresolved URL. Do not guess a portal route or read new telemetry merely
to replace the helper; portal navigation remains unverified.

## Application Insights end-to-end transaction

Prefer the portal's `AppInsightsExtension/DetailsV2Blade` view for a
representative operation.

Use an already resolved representative event from the confirmed component.
Do not query merely to build a link. Retain these verified event fields:

- the telemetry record's `itemId` UUID as `eventId` (never its `id`,
  request ID, dependency ID, or span ID);
- `operation_Id`;
- exact event `timestamp`;
- source table name such as `traces`, `requests`, or `dependencies`; and
- the Application Insights subscription, resource group, name, type, and ARM
  resource ID.

Choose the event anchor in this order:

1. For a synthetic or availability-rooted end-to-end operation, use the matching
   `availabilityResults` item. Project `itemId`, not `id`, and preserve the
   timestamp's fractional seconds. This opens the transaction's Simple View
   from the top-level availability result.
2. Otherwise use the root `requests` item that spans the operation.
3. Use a `traces` or `dependencies` item only when neither root event exists.
   Those anchors can open an event-focused detail rather than the preferred
   top-level Simple View.

Reuse the packaged health helper; do not copy another implementation. Resolve
`../../../../assess-observability-health/scripts/build_appinsights_trace_link.py`
relative to this reference's directory (`references`). From the investigation
directory, the path is
`../../../assess-observability-health/scripts/build_appinsights_trace_link.py`.
Check that this optional core helper is actually present before reading it.
Local helper execution needs applicable approval; otherwise retain already
verified links or a copy-ready scoped query.

Run the resolved helper with the resolved component and
event fields. It returns structured JSON containing `ok`, `url`, and `cache_id`.
The builder rejects non-UUID event IDs because a 16-character trace/span ID can
produce a plausible but nonfunctional URL.
The script builds the `portal.azure.com` URL with these route segments.
URL construction is tested offline; portal rendering and navigation are unverified:

1. `#view/AppInsightsExtension/DetailsV2Blade`
2. `ComponentId~/` followed by a URL-encoded JSON object containing
   `SubscriptionId`, `ResourceGroup`, `Name`, `LinkedApplicationType: 0`,
   the double-URL-encoded `ResourceId`, `ResourceType:
   "microsoft.insights%2Fcomponents"`, and `IsAzureFirst: false`
3. `DataModel~/` followed by a URL-encoded JSON object containing `eventId`,
   `operationId`, `timestamp`, a generated UUID `cacheId`, `eventTable`, and a
   `timeContext` with an evidence-appropriate `durationMs` and `endTime`

The portal sometimes includes feature query parameters before the fragment.
Preserve them when a known-good copied link supplies them; they are not evidence.

Do not try to build DetailsV2 from an operation ID alone. If no representative
event can be resolved, use a scoped Transaction Search or Logs link. Use a
copy-ready KQL query only when no reliable clickable link can be constructed.

## Foundry application conversation

Keep application conversation IDs distinct from distributed trace IDs. For a
Foundry `gen_ai.conversation.id`, query the linked Application Insights
component for a representative event in that conversation and use the event
fields with the shared health helper above. The resulting link targets
the correlated end-to-end transaction; portal navigation remains unverified.
The Foundry conversation ID is the
lookup key, not the portal URL payload.

Do not invent a portal URL, attach raw artifacts or expose unnecessary
identifiers in normal chat.
