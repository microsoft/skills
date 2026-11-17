# Establish usable tools before onboarding

Copilot checks the host's visible descriptions and, when permitted, actual
operation schemas. The developer confirms the application and approves setup
or reads. Tools perform those operations; Azure services enforce source access.

For VS Code, use the [documented Azure MCP extension route](vscode-setup.md);
for Copilot CLI, use the [documented CLI route](cli-setup.md).
For both routes, fresh-client execution remains unverified. Do not invent an extension ID,
MCP configuration, package name or installation command.
Prepared-plugin installation makes these instructions available; it does not
provide resource or telemetry tools.

## 1. Identify the missing capability

| Task | Operations to establish | Evidence still required |
|---|---|---|
| Web/API onboarding | Scoped resource metadata and app-to-source association; bounded request/dependency log or metric reads relevant to the question | Confirmed app/environment/source, query scope, UTC window, completeness and freshness |
| Foundry-agent onboarding | Project/agent identity and telemetry linkage; bounded run, model/tool trace or existing evaluation reads relevant to the question | Confirmed project/agent/version and supported sources; request success alone cannot establish agent behavior |

These are operation categories, not tool command names. Resolve names and inputs
from actual schemas. Foundry is optional for web/API tasks. Python is optional
for existing tool-based reads; installing Python cannot supply Azure telemetry
operations.

Keep these prerequisite states distinct:

- **Missing:** the required operation is absent from the supplied environment.
- **Unverified:** a router/integration is visible but its child operation schema,
  callability, identity or source access has not been established.
- **Denied:** a supplied or executed operation returned a permission denial.
- **Usable evidence:** the permitted source read returned the relevant complete,
  fresh, representative signals for the agreed task.

A resource metadata read or successful sign-in does not prove query access.
When a query is denied, explain that source-access gap; do not treat it as proof
of missing instrumentation or require another integration installation.

## 2. Offer and carry out approved setup

When required Azure operations are missing, offer Azure MCP setup in the current
conversation. Do not make the developer diagnose MCP configuration or search for
an installer. For example:

> The Azure query tools needed for this investigation are missing. I can help
> connect Azure MCP. May I set it up using the supported route for this client?
> Setup is separate from permission to read your application data.

If another authorized integration already supplies the required evidence, reuse
it. Azure MCP is the preferred documented setup path for missing Azure operations,
not a mandatory duplicate or a guarantee of diagnostic accuracy.

For missing operations:

1. Ask for the intended client/version and any organization-approved Azure
   integration setup guidance. Do not ask for credentials or secret config.
2. Name the required operations from the table. For VS Code, read
   [the sourced setup route](vscode-setup.md) before explaining the extension,
   harness-specific tools UI, identity and scoped read-permission checks.
   Distinguish documented setup from verified fresh-client execution.
3. Reuse an existing approved integration if it supplies those operations.
   Otherwise review its trusted host-specific setup instructions and policy
   before proposing installation. For an unsupported client or missing approved
   route, explain the prerequisite. Do not fetch or install it automatically.
4. Obtain separate consent for installation/configuration and, if necessary,
   the integration's supported sign-in flow. Do not change identity or grant
   roles to resolve a denied read.
5. After setup approval, use the host's actual supported installation/configuration
   tool if exposed, within the approved destination and scope. Otherwise provide
   the documented developer action; do not invent an installation tool. An
   installation command can download and execute code: explain its publisher,
   runtime and side effects first. Server startup/trust and sign-in retain their
   applicable approvals. Do not enable blanket auto-approval or overwrite existing
   configuration. If setup is declined, blocked by policy or fails, report that
   state and offer supplied-evidence analysis; do not try a different installer
   or identity as a workaround.
6. After setup, check actual operation schemas, confirm deployment/source
   association and request any missing approval for a bounded telemetry read.
   Reuse unexpired approval only within its covered operations, identity,
   source/destination, scope and remaining budget. New connection trust/setup
   is separate from data-read permission. Only its
   actual evidence can establish task-specific access and usable signals.

Report setup as proposed, approved, executed, failed, declined or unverified.
A successful installer response does not prove that the current chat has loaded
the new tools. Refresh/reload using the documented host action if necessary and
preserve the confirmed investigation context.

For a visible router with unresolved operations, explain what remains
unverified and ask for permission to inspect its supported schemas. A no-query
local preflight does not authorize remote discovery calls.

For denied source access, retain any separately confirmed metadata and explain
which operation/source was denied. Request review through the developer's
normal access process; do not suggest that sign-in, a duplicate installation
or a silent role grant has fixed it.

## 3. Stop at the permission ceiling

Under prerequisite-only consent, give the operation gaps and smallest next
action, then stop. Do not query, sign in, install, edit, execute scripts, save a
mapping, generate traffic or start an assessment to work around a blocker.

When no helper ran, report **readiness classification not computed**. Explain
onboarding blockers in plain language without presenting a helper result.
Health remains **INCONCLUSIVE** without sufficient evidence. Do not mark absent,
unverified or denied reads as usable.

Keep facts about the actual host separate from supplied synthetic environments.
Synthetic preflight checks do not remove tools, authenticate a user,
simulate actual permission errors or verify a customer installation route.
