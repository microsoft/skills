# Routing examples

These patterns apply only to Advisor `Cost` / `IdleResources`. Generic Cost, other
subcategories, cross-category, and non-Cost requests stay on `azure-advisor`.

| Request | Route |
|---|---|
| Find unused resources | Resolve scope; existing prioritized summary; visibly show results, then one expansion question |
| Which unused-resource recommendation types occur most often? | Normal summary by recommendation type; preserve record-count order and show complete Cost totals |
| Find unused resources across all subscriptions | Enumerate subscriptions; query explicit same-tenant arrays; show tenant-specific coverage |
| Show idle resources in Commerce SG | Pass Commerce directly as scalar service-group; the tool resolves its name or ID, no separate SG lookup |
| Show all my Service Groups | Explain scope limitation and request one SG identifier; no substitute inventory query |
| Show the highest-priority idle opportunities | Prioritized summary; preserve backend priority order and full Cost totals |
| Show unused App Service plans | Resolve product family or metadata type; list the exact selected type; no resource-selection question for ordinary reading |
| List all active idle findings | List directly with both filters and New; disclose the result cap |
| Estimate savings if I delete it after several rows | Ask which row; use returned retail savings without treating the estimate as deletion approval |
| Create a script to remove these | List active candidates, select exact type/resources, then hand off to actionability |
| Is this safe to delete? | Reuse exact type/resources/scope; call read-only prevalidation; compact bucket tables plus one shared checks summary; detailed evidence only on request; never delete or change state |
| Prevalidate these selected disks using a 45-day minimum unused age | Preserve selected IDs and type, pass minimum-unused-days=45 to prevalidation; incomplete history still requires review |
| Prevalidation says this resource is already deleted | Preserve its blocked bucket; show the confirmed date and no-action/72-hour explanation, with no lifecycle action or further deletion investigation |
| What did we save last quarter? | Resolve period; Completed summary with from/to; use full realized-savings totals, not a capped list |
| Summarize idle findings as of a supplied date | Completed summary unless another state is explicit; preserve that effective state in list expansion |
| Summarize active/New idle findings as of a supplied date | Explicit New summary overrides the historical default |
| Show completed resources | Completed list details; show lastUpdated as State last changed, separately from deletion dates |
| Prevalidate all 125 resources of this type | Reuse scope/type; omit resources and top for complete paged discovery and bounded processing; disclose incomplete coverage |
| Show postponed/dismissed resources | Requested-status list; keep states, reasons, dates and savings measures separate |
| Postpone this one | Select exact record; ask the return date unless supplied; show the proposal, then let the server request destructive approval |
| Postpone those requiring more work after prevalidation | Reuse only the exact needsReview rows and stable IDs; offer one week, one month, a custom date/time, or cancel; one recommendation-ids batch call and one server approval, no per-record calls |
| Dismiss all of these | Limit to selected type/scope and eligible shown targets, reuse/ask reason, show the proposal, then one batch call with server approval |
| Show my bill's increase | Billing workflow, not Advisor idle-resource analysis |

Preserve unknowns, exact identities, scope/tenant coverage, and truncation in every route.
Never claim runtime inactivity for an arbitrary duration solely from an Advisor idle signal.
