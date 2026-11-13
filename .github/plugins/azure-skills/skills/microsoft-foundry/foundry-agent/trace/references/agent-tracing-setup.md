# Best-Effort Agent Tracing Setup

Use when the user declines default monitoring, uses custom or BYO monitoring, or asks to set up or repair tracing. For a new project, azd enables App Insights by default during `azd provision`, so the standard create, deploy and invoke workflows need no tracing steps. Excludes Voice and Managed Harness.

## Resolve and Preserve

Use [Common Project Context Resolution](../../../SKILL.md#agent-common-project-context-resolution). Align environment, project ARM ID, endpoint and agent. Nonsecret azd outputs:

| Output | Meaning |
|---|---|
| `AZURE_APPLICATION_INSIGHTS_RESOURCE_ID` | Component ARM ID |
| `AZURE_APPLICATION_INSIGHTS_APP_ID` | Query application ID |
| `AZURE_LOG_ANALYTICS_WORKSPACE_RESOURCE_ID` | Linked workspace |
| `AZURE_AI_PROJECT_APPINSIGHTS_CONNECTION_NAME` | Project `AppInsights` connection name |
| `AZD_FOUNDRY_MONITORING_MODE` | `none`, `create`, `reuse-connect` or `already-connected` |

These describe provisioning configuration, not stored-trace evidence. Inspect with `project_connection_list`. Preserve equivalent AppInsights connections, including inherited/shared connections and authentication. Do not overwrite or fetch credentials for discovery.

## Preflight Before Provisioning

Run before any `azd provision` that could create a new project, and before a redeploy that skips provisioning. Provisioning is the step that creates monitoring, so approval cannot wait until afterward.

A missing `monitoring` setting on a new project means monitoring is on by default, not "open to configure". With a `network:` block it is set up privately (see Private networking below).

1. Check capability and path (below). Older tooling and custom IaC create no monitoring.
2. Check for an existing opt-out (`monitoring.enabled: false`) and respect it.
3. For a new project, including one with a `network:` block, get approval covering monitoring charges and privacy before provisioning. A `network:` block also creates private-link resources (see Private networking below).
4. For an existing project, do nothing unless the user supplies `applicationInsightsResourceId` and approves the connection write.

Effective-connection discovery and human access checks happen after provisioning (and on redeploys that skip it).

## Select the Actual Provisioning Path

- **Native azd:** requires the `azure.ai.projects` extension 1.1.0 or later (automatic monitoring and private monitoring) with a matching agents extension; confirm with `azd extension list`. Confirm after provisioning that `azd env get-values` contains `AZD_FOUNDRY_MONITORING_MODE`. Do not install development builds automatically.
- In supporting builds, a **new** project gets a workspace-backed App Insights component and an `AppInsights` connection by default, with no flag or authoring change. Monitoring is part of the main provisioning graph, not a best-effort second step: a policy or conflict failure (for example a conflicting connection or restricted ingestion) fails `azd provision` and its message names the cause. Report it, then fix it or set `monitoring.enabled: false`.
- Existing projects are unchanged unless `monitoring.applicationInsightsResourceId` is set, including an existing project with a `network:` block. azd never creates a new component for an existing project.
- **Private networking:** for a new project with a `network:` block (customer VNet or managed VNet), azd 1.1.0+ provisions private monitoring: an App Insights component with public ingestion and query disabled, an Azure Monitor Private Link Scope, an `azuremonitor` private endpoint with its private DNS zones, and the project `AppInsights` connection.
  - Traces are only reachable from inside the network (or a network peered to it). Reading them needs Log Analytics Reader on the component; run queries from a host in the VNet.
  - Do not enable public ingestion or query access to work around a failure.
  - An existing project whose account is private is rejected unless it already has an `AppInsights` connection (preserved) or `monitoring.enabled: false` is set.
  - A conflict (for example an existing Azure Monitor private endpoint or Private Link Scope on the VNet) fails `azd provision` with a message naming the cause. Report it, then resolve it or set `monitoring.enabled: false`.
- **Ejected IaC:** azd-ejected Bicep and Terraform include monitoring (`modules/monitoring.bicep`, `monitoring.tf`). After ejection, those files are authoritative, not `azure.yaml`.
- **Starter Bicep:** `azd-ai-starter-basic` has monitoring and a connection and exports `APPLICATIONINSIGHTS_RESOURCE_ID`. Inspect actual outputs/connections; do not duplicate.
- **Older tooling and custom IaC:** do not assume automatic monitoring. Reuse an existing working connection or warn that setup is unavailable and continue the agent workflow.

Native settings:

```yaml
services:
  ai-project:
    host: azure.ai.project
    monitoring:
      # New project: omit this block to get the default.
      # Bring your own component (required for an existing project):
      applicationInsightsResourceId: ${EXISTING_APPLICATION_INSIGHTS_RESOURCE_ID}
      # Skip monitoring entirely:
      # enabled: false
```

`enabled: false` skips new setup; it does not delete resources or disable an existing exporter. Respect an existing opt-out. For an existing project, `enabled: true` or an empty block without a resource ID is an error.

New-project approval must cover monitoring charges and privacy. Connecting a BYO component to an existing project writes a project connection and needs approval naming the project and component. azd adds no monitoring role assignments. Preserve local-auth, network, retention, sampling and content-capture policy. Never persist plaintext connection strings in YAML, metadata, logs or new environment values; legacy values may be read without copying.

## Human Access and Hosted Instrumentation

Resolve the human/group viewer separately from ingestion/evaluation identities. Reuse inherited access. Confirm component/workspace query permission with a metadata-only query; visibility is insufficient. Missing access requires approval for the minimum scoped grant: Log Analytics Reader for that user on the Application Insights resource (azd does not grant it). Protected tables/content may require Privileged Monitoring Data Reader only when explicitly needed and approved. Contributor does not establish role-assignment authority. Query denial warns; no broad grants.

For hosted code, inspect the selected framework/scaffold's supported instrumentation and export path. A project connection does not instrument arbitrary code. Do not add a competing exporter or enable content capture merely to get evidence.

## Failure Boundary

Optional tracing failures during deployment, invocation, access checks and verification warn with phase/remediation and preserve core success. Retain partial resources. Core errors, required connection errors and cancellation still fail. A monitoring failure inside `azd provision` is the exception: azd fails that provision, so report it as a provisioning failure with the cause. Follow [Fresh Trace Verification](agent-tracing-verification.md) after the requested smoke invocation.
