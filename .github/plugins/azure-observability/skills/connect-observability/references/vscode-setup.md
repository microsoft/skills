# Documented VS Code Azure tool setup

Sources reviewed November 5, 2026. This route is documented by Microsoft;
fresh-client installation, authentication and telemetry reads remain unverified
for this package. Use it for missing operations after checking the intended
client/version, harness and organization policy. Copilot CLI has a [separate setup route](cli-setup.md) and acceptance test.

## 1. Check what the developer already has

Copilot identifies the task's required metadata and telemetry operations from
[the tool-prerequisite guide](tools.md). The developer checks enabled integrations
and their organization's approved setup path.

Microsoft documents the standalone **Azure MCP Server** VS Code extension:
[`ms-azuretools.vscode-azure-mcp-server`](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azure-mcp-server).
The [official quickstart](https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/get-started/tools/visual-studio-code)
also states that GitHub Copilot for Azure includes this extension. Reuse an
existing integration that supplies the required operations; avoid duplicate
installation. A denied source query calls for access review, not another tool
installation.

The quickstart lists VS Code, GitHub Copilot and an Azure account with an active
subscription. Our live path also needs an existing deployed application and
appropriate telemetry. Python and azd are not prerequisites for this extension
route. Do not invent additional runtime/setup requirements; expose actual
startup errors and consult the selected publisher's requirements.

## 2. Review and approve installation

Copilot explains the extension's publisher, requirements and side effects, then
requests installation approval. If the host exposes an extension-installation
operation, inspect its real schema and use it only after that approval. Otherwise
guide the developer to the published extension and **Install** in VS Code's
Extensions view. Do not invent an installation tool or claim that providing a
link installed the server. The quickstart says the extension uses the latest
preview and automatic updates; record the actual extension version when testing.

The developer opens Copilot in Agent mode and checks Azure MCP tools. Current
[VS Code tool documentation](https://code.visualstudio.com/docs/agents/run/tools)
distinguishes these controls:

| Intended harness | Documented tool control |
|---|---|
| Copilot | Chat: Open Customizations -> Tools; selection persists in the active user profile |
| Local | Configure Tools in the chat input; selection applies to the current request |

Verify the labels in the actual host/version. Do not copy a configuration
between harnesses or treat one harness's UI as universal. Review server trust,
startup and authentication prompts. Local MCP servers can execute code using
the developer's permissions; see [MCP setup and trust](https://code.visualstudio.com/docs/agent-customization/mcp-servers).

Limit enabled operations to the approved task and retain host approval controls.
Tool availability is separate from tool approval. This extension route does not
establish an enforced read-only server configuration. Do not select blanket
Always Allow or enable unrelated write operations. Creating MCP configuration
or changing tool/profile settings requires applicable reviewed configuration
approval. Prefer the extension route; do not silently fall back to terminal
installation or workspace configuration if it fails.

VS Code also supports plugins containing MCP server definitions; see the
[plugin authoring reference](https://code.visualstudio.com/docs/agents/reference/agent-plugin-reference).
This package does not currently include an Azure MCP definition. Do not claim
the plugin installed Azure MCP or add a duplicate definition during preflight.

## 3. Reuse supported identity

The quickstart documents credential reuse from supported local development
tools, including VS Code, Azure CLI, Visual Studio and Azure Developer CLI.
Reuse the developer's approved identity without reading credential files.
If authentication is missing, ask for separate consent to complete the
integration's supported sign-in flow; the quickstart also describes a browser
sign-in prompt when a tool operation requires authentication.

Confirm ambiguous tenant/subscription choices before target reads. Do not
switch identity or require installation of CLI/azd merely to reuse credentials.
Never paste credentials into chat or project files. Sign-in establishes
authentication; the selected source operation still needs authorization.

## 4. Check permissions for the chosen scope and source

Use existing permissions or the developer's normal access-review process.
Never grant roles or change workspace access settings as an onboarding step.

| Required evidence | Permission check |
|---|---|
| Resource metadata | Appropriate read permissions on the confirmed resource scope |
| Metrics and monitoring context | Appropriate monitoring read permissions on that scope; Monitoring Reader is a documented built-in option |
| Resource-context logs | Resource read permissions can apply when the workspace permits resource-based access and records are associated with the selected resource |
| Workspace-context logs | Query permissions on the workspace and relevant tables; Log Analytics Reader is a documented option, not a universal minimum |

Reader on an application does not automatically authorize workspace-wide
queries. Access depends on the workspace access-control mode, query context
and table/row permissions. Resource-context Application Insights access requires
a workspace-based component; Basic/Auxiliary tables require workspace context.
Do not broaden the query or request subscription-wide Contributor/Owner to
work around these constraints.

See [Azure Monitor permissions](https://learn.microsoft.com/en-us/azure/azure-monitor/fundamentals/roles-permissions-security)
and [Log Analytics access modes](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/manage-access).
Denied access remains a source-specific blocker, not an instrumentation gap.

## 5. Prove the first scoped read, only after approval

Copilot checks actual callable schemas, carries the confirmed application/
environment/source association and agrees core signals, UTC window, expected
activity, freshness and query budget. Then it requests separate approval for
bounded metadata/telemetry reads.

Inspect the actual tool call and returned evidence: selected source, scope,
count semantics, timestamps, completeness and errors. Retain missing, denied,
empty, stale, throttled, failed and partial outcomes separately. Installation
and sign-in alone cannot establish usable telemetry or application health.

Under prerequisite-only consent, stop after the proposed next step. Do not
start the server, sign in, query, execute helpers or save mappings to demonstrate
setup. Report readiness classification not computed when no helper ran, and
INCONCLUSIVE health when evidence is insufficient.

Record host/harness and extension versions, actual tool loads/calls and
sanitized results in a separately approved acceptance test. Documented setup
does not certify installed-plugin behavior or a fresh developer's live access.
