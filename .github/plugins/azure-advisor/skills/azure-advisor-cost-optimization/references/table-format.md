# Tables and selected resources

Apply on every model, including Auto. Keep scope, currency, pricing basis, full totals and
coverage outside disclosures. Distinguish returned rows from initially visible rows.

## Opening discovery format

Use all four blocks even for one type or unavailable prices. For Completed, replace
Yearly potential savings with Realized savings throughout.

```text
## Scope
<scope> | <coverage> | <returned pricing basis> | Advisor estimates, not invoices

## Advisor found
<returned count and correct meaning> across <returned type count> recommendation types.

## Savings
- Yearly potential savings: <amount or Unavailable>
- Cost: <amount or Unavailable>
- Currency: <measure currency>
- Pricing basis: <returned basis>

## Recommendation types
|Recommendation type|<Recommendations or Affected resources>|Yearly potential savings|Cost|
|---|---:|---:|---:|
|<exact returned name>|<group count>|<amount>|<amount>|
```

## Inline expansion

Show at most 15 rows initially. Include every further returned row in nested inline
`<details>` / `<summary>` sections, up to 15 rows per section, identical columns, labeled
`Show N more (start-end of total returned)`. Nest the next disclosure after its preceding
batch so each click reveals one batch. Use the actual final batch size.
These controls only reveal content: no `ask_user`, Azure query, selection or new user prompt.
Keep explicit user limits; never invent rows beyond the returned/capped result.
Server truncation is separate from collapsed content.

Use blank lines around Markdown tables in disclosures:

```markdown
<details>
<summary>Show <count> more (<start>-<end> of <total> returned)</summary>

<same table header and next returned rows>

<next nested disclosure, if needed>

</details>
```

## Resource links

In resource tables, make the existing resource name a Markdown link; keep its exact
display name, wrapping and column order. Use the affected-resource ID from
`properties.resourceMetadata.resourceId`, or prevalidation `resourceId`, never the
Advisor recommendation `id`. Build `<portal-base>/#resource<resource-id>/overview`,
URL-encoding path segments (including Markdown delimiters) while preserving `/`.
Use the current cloud's portal base: `https://portal.azure.com` for AzureCloud,
`https://portal.azure.us` for AzureUSGovernment, `https://portal.azure.cn` for AzureChinaCloud.
When no different cloud is specified, use AzureCloud, matching MCP's default; a missing
cloud field in a response must not suppress links. Reuse any known cloud override.
If the resource ID is missing, a specified custom cloud has no known portal, or deletion
is confirmed, keep the name plain text. Do not query or ask for cloud solely to construct
links, or imply that a link verifies existence/access.

## Resource detail

For read-only selected-type details, use this literal layout, not opening discovery:

```text
## Selected recommendation
**<exact returned recommendation name>**

Advisor returned **<count and resource kind>**, with **<returned type savings and lifecycle label>**.
<coverage/truncation; rows returned and initially shown>

**Scope:** <scope> | **Currency:** <currency> | **Pricing basis:** <basis> | Status: <status>.
Figures are Advisor estimates, not invoices.

|Resource|Resource<br>group|Yearly potential<br>savings|Cost|
|---|---|---:|---:|
|<name>|<group>|<amount>|<amount>|
```

Keep the intro short; put Cost in the table, not a second accumulated-cost sentence.
Use the monetary rules in [Output and savings](output-and-savings.md).
For SG/multiple subscriptions, insert Subscription immediately after Resource. Apply the
[resource ownership](output-and-savings.md#resource-ownership) name-reuse rules;
SG scope does not replace row ownership.
For Completed use Realized savings; append [Lifecycle](lifecycle.md) columns.
One table per selected type. End with a brief ownership/retention caution and no-resources-
changed statement; no unrequested safety-check/resource-selection flow.

Preserve priority order; otherwise sort returned lifecycle-appropriate savings descending,
unknown last, stable ties. No padding spaces/spacer columns in pipe markup.
Wrap long headers/names with `<br>`, including unbroken suffixes when needed. Removing breaks
must recover the exact name; no abbreviations/truncation. Keep currency/basis above the table.
USD uses `$`, thousands separators and two decimals; other currencies use unambiguous notation.
Unavailable stays Unavailable, not money.

Display full resource IDs below tables only for disambiguation, confirmation, artifacts or
explicit requests. Never call recommendation IDs resource IDs. Resource-name portal links
are allowed; ordinary analysis omits raw payloads and unrequested remediation links.
Actionability owns remediation links.

Pagination selects nothing or authorizes updates. Batch confirmation follows
[State updates](state-updates.md).

## Prevalidation results

Use this layout for returned safety checks, not the discovery layout or per-resource cards:

```text
**<safe count> passed automated checks; <review count> need review; <blocked count> blocked
(<deleted count> already deleted).** Passing checks is not deletion authorization.
**Scope:** <scope> | **Checked:** <evaluatedAt> | **Minimum unused age:** <days> days
**Coverage:** <checked/selected counts, truncation and unmatched selections>
**Pricing basis:** <basis> | **Currency:** <currency> | Advisor estimates, not invoices

## Resources that passed automated checks
<count and returned known yearly potential savings; outstanding manual checks still apply>
|Resource|Resource group|Yearly potential savings|
|---|---|---:|
|<exact name>|<group>|<amount or Unavailable>|

## Resources requiring additional review
<count and returned known yearly potential savings>
|Resource|Resource group|Review required|Yearly potential savings|
|---|---|---|---:|
|<exact name>|<group>|<actual warning/unverified check and reason>|<amount or Unavailable>|

## Resources blocked for deletion
<count; separately identify the already-deleted count, not aggregate blocked savings>
|Resource|Resource group|Reason / next step|
|---|---|---|
|<exact name>|<group>|<active blocker, or confirmed deletion date and no action needed>|

## Checks performed
|Check|Outcome|Minimal detail|
|---|---|---|
|<returned check name>|<actual outcome or Mixed>|<short returned fact/reason; affected resources for mixed or limited coverage>|

**Manual checks - not executed:** <shared outstanding confirmations and advisory steps>
```

Keep all three bucket headings; write `None.` for an empty bucket instead of an empty table.
For multiple subscriptions, add Subscription immediately after Resource, reusing subscription names
as above. Reuse the wrapping, money and
15-row inline-expansion rules above; never truncate identities or hide coverage/totals.
Put warnings, unreadable evidence and active blocking reasons in the main resource tables,
not only inside disclosures. Exclude confirmed-deleted resources from outstanding manual tasks.
Treat returned age as "used or changed", not proven runtime usage or detachment time. Show
the timestamp and signal only if returned; never invent their attribution.

Use one shared checks-performed table. Cover every returned automated check, grouping identical
check/outcome pairs once. Keep details to one short returned fact or reason. For differing outcomes,
use `Mixed` and identify each affected resource's actual outcome; identify limited coverage too.
Never claim "all passed" from one resource. Keep information-only checks non-gating and label manual steps
`Manual - not executed`, not passed. A check absent from the result is not an executed check.
Do not invent metrics for a resource type whose returned checks do not include them.

Do not add per-resource evidence cards, tables or disclosures by default. Only when explicitly
asked for detailed evidence, show a `Check | Outcome | Evidence` table for the requested
resources, preserving their returned outcomes and material evidence. Keep the default answer
to resource tables, one shared checks table and outstanding manual confirmations.
Do not dump raw payloads, KQL or unrequested scripts.
Do not repeat full ARM/recommendation IDs as visible text unless needed for disambiguation or requested.
Confirmed-deletion presentation and safety rules remain in
[Prevalidation](selection-and-handoff.md#read-only-prevalidation).

## State update proposal and result

Use one compact proposal for postpone/dismiss. Other state changes retain their
lifecycle-appropriate savings measure, including Realized savings for Completed.

```text
**Proposed: <action> <N recommendations> <until date with timezone / shared dismissal reason>.**
**Scope:** <scope> | **Pricing basis:** <basis> | **Currency:** <currency>

|Resource|Subscription / Resource group|Change|Yearly potential savings|Cost|
|---|---|---|---:|---:|
|<exact name>|<ownership>|<source state -> target state>|<yearly savings or Unavailable>|<accumulated cost or Unavailable>|

<expandable exact update targets, or reference to the unchanged identifiers already shown>
Recommendation status only changes; resource charges continue. No resources will be deleted.
```

Show the shared date/reason once, not on every row. The exact-target disclosure contains
`Resource | Affected-resource ID | Recommendation ID`, full unshortened IDs, and the exact
ISO 8601 return date with timezone or dismissal-reason value. All targets must be available
before the single server destructive-operation [batch confirmation](state-updates.md).
The postpone date question comes before this proposal; do not add another assistant
confirmation question between the proposal and the one batch update call.
Explicitly identify excluded rows when selecting a prevalidation bucket. Show both measures,
savings first: use `properties.savings.retail.yearlyPotentialSavings` and `.cost` from the
selected list rows, or `yearlyPotentialSavings` and `cost` from prevalidation.
Reuse previously returned values; do not query Azure merely to fill the columns.
Apply the [shared rules](../SKILL.md#shared-rules); read
[Output and savings](output-and-savings.md) when interpreting totals or pricing sources.

After updates, use one result summary and table, not a second proposal or a name-only list:

```text
**<action>: <success count> succeeded; <failure count> failed.**
**Scope:** <scope> | <shared confirmed return date or dismissal reason>
**Pricing basis:** <basis> | **Currency:** <currency>

|Resource|Outcome|Recommendation status|Yearly potential savings|Cost|Details|
|---|---|---|---:|---:|---|
|<exact name>|Succeeded / Failed / Unverified / Not attempted|<returned status or Unavailable>|<yearly savings or Unavailable>|<accumulated cost or Unavailable>|<failure or relevant returned detail>|

Monetary values are previously returned estimates, not savings achieved by this state change.
Resource charges continue; no resources were deleted.
```

Retain ownership for cross-subscription name collisions. Report per-record tool outcomes,
not intended outcomes; a failed/unknown response must not be called successful. Use the existing
update response as the source of truth: show Succeeded with its returned recommendation
status and date/reason. Do not downgrade it because a later list is stale or no longer
contains the row. Do not issue an extra list query to decide whether that update succeeded.
Never replace a returned status with the requested status.
Carry both monetary columns forward by the selected recommendation ID, not response order;
missing update-response savings do not erase the previously returned estimates. Summarize
safe failure details, preserve successful updates, and do not silently retry or reconfirm
the unchanged completed batch.
