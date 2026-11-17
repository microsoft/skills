## 2. Establish scope and permissions once

Load only when scope/access is missing or a live-read plan is needed.

Make this a guided conversation, not a prompt-writing task. An ordinary symptom
or "end to end observability" request should be sufficient to begin once the
intent gate passes; neither is a guaranteed
host trigger. The developer supplies missing facts, meaningful choices and
approvals, not skill names, query recipes or repeated safety paragraphs.
Keep the current task, confirmed identifiers, association provenance, schema,
UTC window, consumed/remaining budgets and approval exclusions in conversation
across specialist handoffs. A short "continue" reuses only the existing unexpired
permission; it never grants new operations or expands scope.

When a lab/application workspace is open, inspect permitted nonsecret deployment
context before asking the developer to copy identifiers. Load available
`connect-observability` instructions for scope resolution and query routing;
do not assume its resources exist relative to this independently usable skill.
With no workspace or retained context, ask one plain-language target question.
Do not require the developer to paste a deployment manifest or a large prompt.

Propose one concise approval covering the next useful bounded read pass:
exact target/source, window, question, metadata/query/row limits, any allowed
single schema correction and exclusions. Count schema reads and failed queries
inside the query budget. Distinguish a corrected query from automatic transport
retries, but do not perform either when explicitly prohibited. If a stricter
approval disallows correction, ask only for that one missing permission.
Do not ask again for already approved in-scope operations, nor make the
developer restate the complete plan. Host tool approvals remain in force.

For a lab setup followed by investigation, retain the approved deployment
outputs and actual version in conversation so that the next stage does not
restart discovery. New provisioning, traffic, edits, deployment and cleanup
still need separate operation-specific approval. After identifying an affected
path, reuse known change context; if it is missing, ask whether a relevant
change occurred before proposing more telemetry reads. Local configuration is
an explanatory candidate, never proof of effective deployed settings or recovery.

Use plain language in developer questions: say "existing evidence with sensitive
details removed", not unexplained "sanitized evidence". Ask for the smallest
missing decision or fact, not a bundle of telemetry-engineering inputs.
When a live investigation is requested with approval before access, propose
the bounded read-plan path rather than ask the developer to choose it again.
Offer supplied evidence as an alternative when relevant; never treat that
default proposal as permission to discover schemas or execute reads.

Reuse confirmed application/environment, deployment/resource/source identifiers,
association provenance, approved identity, and unexpired evidence. Ask before
choosing between plausible targets. Names and repository hints are not deployment
proof. Revalidate changed resources or expired access without restarting all
onboarding.

Agree the observation window, expected activity, freshness, original symptom and
acceptance criteria where a verdict requires them. Unknown SLOs permit reporting
measurements, not invented pass/fail thresholds. Preserve tools-only mode when no
approved helper interpreter exists.

Separate consent for:

- bounded reads of the confirmed sources;
- sensitive trace/profile/snapshot or prompt content;
- new integrations, authentication changes or dependency installation;
- local edits and local persistence;
- evaluation jobs, agent/tool invocation or synthetic traffic;
- deployment, capacity, infrastructure, alert or collection changes;
- external-service investigation creation and server-side persistence.

Permission for one item is not permission for the others. If the user prohibits
Azure queries, use only permitted retained/user-supplied evidence. A resource ID
or "build this plugin" does not authorize reading that resource. Do not retry
denied access under another identity.
