# Normalized output contract

Return route/operation IDs, plane, resolved API version and selection source, compatibility evidence and preview warnings, subscription/resource group, redacted endpoint and resource IDs, discovered versus supplied inputs, approval decision, status/request IDs/ETags, changed resources, deterministic validation evidence, elapsed stages, warnings, ongoing cost drivers, rollback/cleanup, and remaining customer-owned actions. Distinguish documentation-based compatibility checks from live validation; do not claim an override was tested merely because a version parameter was substituted.

## Customer handoff

Finish every scenario with a concise customer/developer handoff:

- **Use:** endpoint, authentication, required configuration and one redacted usage example.
- **State:** verified outcomes, limitations, created/reused inventory and owners.
- **Operate:** estimated ongoing costs and assumptions, freshness/schedule, rollback and cleanup.
- **Next:** remaining owner actions and any incomplete verification.
- **Web:** if a Web KS was created, include the [Web compliance note](source-security.md#public-web) in the final status update.
