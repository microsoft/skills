# Foundry application/dependency evidence routing

Foundry agents are commonly data-plane objects. Do not pass an agent name directly
to Azure Resource Graph and assume it is an ARM resource.

## Resolution flow

These are only necessary approved existing reads, not a mandatory checklist.
Retain Foundry's existing AI-specific evidence and hand off only the unresolved
application/dependency question to this workflow; never bounce between specialists.
Discover actual operations and schemas first; names below are source examples,
not host tool bindings. No new evaluation, monitor, invocation or connection is
authorized. Supplied-evidence mode does not execute this resolution flow.

1. Reuse the confirmed project/agent and source association. If unresolved,
   request minimal sanitized identifiers or propose one approved metadata read.
   Never retrieve secret connection objects to project them away afterward.
2. Reuse supplied existing evaluation/Insights summaries. Retrieve only a
   necessary missing sanitized summary through a discovered approved operation;
   never require all connections, evaluation definitions or runs.
3. Query `gen_ai.evaluation.result` and agent/model/tool spans in the linked
   Application Insights component.
4. Correlate evaluations and the developer-selected tool path by trace ID.
5. When a Foundry conversation ID is available, use it to resolve one
   representative Application Insights event. Capture the event `itemId`,
   `operation_Id`, timestamp, and source table, then run
   the shared health transaction-link helper described in
   [portal links](portal-links.md) to create the end-to-end
   transaction link. Do not put the conversation ID directly into a guessed
   portal route.
6. Expand into Azure Monitor dependency and infrastructure evidence only for
   the selected path.
7. Retain agent/project identifiers, existing evaluation context and separate
   correlation IDs so investigation remains scoped to the requested agent.

If AI-specific expertise is needed, discover canonical `microsoft-foundry`
through the host under [the dependency contract](../../canonical-dependencies.md).
No hardcoded package path or instruction link establishes installation/loading.
Do not copy its lifecycle workflows or let automatic setup, cache migration,
evaluation creation or scripts override the retained approval ceiling.
Existing authorized Monitor logs/metrics or supplied evidence remain sufficient
for an application/dependency question when the external skill is absent.

## Triage evidence

Inspect failed and slow runs, exceptions, downstream dependencies, model and tool
calls, correlated traces, latency, token signals, throttling, content-safety
outcomes, and recent project/agent configuration changes. Use telemetry timestamps
or the user's described incident time.

If no linked Application Insights component or other Azure Monitor telemetry can
be resolved, continue with supplied Foundry-specific and generic Azure
Diagnostics evidence and report the telemetry gap. Do not create a connection.

An existing Insights read can report that no Agent Insights monitor exists. Treat that
as a non-fatal **Insights** coverage gap and continue with scheduled evaluation
runs and linked Application Insights result events. Do not misclassify it as
missing evaluation coverage. Never use broad Function/App Service app-settings
enumeration as a configuration shortcut because it can return secrets; prefer
deployment source, runtime evidence, or a targeted redacted read.

Some Function surfaces require resource-group read permission before accepting a
known site name. If that prerequisite is denied, do not repeat the lookup:
preserve the exact Function ARM ID, report the permission gap, and use correlated
workspace telemetry for the runtime investigation.
