# AKS Structured Input Modes

Use this reference when the troubleshooting request already contains structured inputs.

## Detector-backed Mode

Use when AKS-aware detectors or AppLens-style insights are available.

Decision rules:

- Ignore findings where the detector is `emergingIssues`.
- Prefer critical findings over warnings.
- Prefer findings with more concrete remediation detail when choosing the likely root problem.
- Preserve per-insight output: problem summary, root-problem flag, affected resources, suggested commands.

## Warning Events Mode

Use when the request includes Kubernetes warning events.

Expected output:

- summary of the events and their impact
- likely cause or causes
- next kubectl checks
- monitoring follow-up

## Metrics Scan Mode

Use when the request includes CPU or memory time-series data.

Expected output:

- healthy or unhealthy status
- anomaly timestamps and explanations
- suggestion tied to the observed metric pressure

## Generic Symptoms Mode

Use when the request includes resource symptoms but not detector results, warning events, or time-series metrics.

Expected output:

- symptom summary by resource
- likely failure domain
- next evidence-collection steps

## Control-Plane Resource Logs (Historical Evidence)

Use when the question is about *past* API-server, scheduler, controller-manager,
or cluster-autoscaler behavior. AKS control-plane logs are Azure Monitor
resource logs: they exist only if a diagnostic setting routed the category to a
destination before the incident window. Missing setting or history means the
evidence is **unavailable**, never "no events occurred."

Category → table mapping (resource-specific mode; legacy Azure diagnostics mode
lands everything in `AzureDiagnostics` with a `Category` column):

| Diagnostic category | Resource-specific table | Content |
|---|---|---|
| `kube-audit` | `AKSAudit` | All API-server audit events, including `get`/`list` |
| `kube-audit-admin` | `AKSAuditAdmin` | Audit events excluding `get`/`list` (modifying requests) |
| `kube-apiserver`, `kube-scheduler`, `kube-controller-manager`, `cluster-autoscaler`, `cloud-controller-manager`, `guard`, `csi-*-controller` | `AKSControlPlane` (filter on `Category`) | Component logs |

```bash
az monitor diagnostic-settings list --resource <cluster-resource-id> -o table
az monitor diagnostic-settings show --resource <cluster-resource-id> -n <setting> --query '{logs:logs,workspace:workspaceId,resourceSpecific:logAnalyticsDestinationType}'
```

Decision rules:

- Query `AKSControlPlane | where Category == "kube-scheduler"` (or the matching
  `AzureDiagnostics` filter) only after the setting shows that category enabled
  for the incident window and the workspace is readable to the user.
- If the category is disabled, the setting is absent, or the workspace retention
  does not cover the window, report the evidence as unavailable and name the
  exact category and table that would have answered it.
- Enabling or changing a diagnostic setting is a mutation with ingestion and
  retention cost (`kube-audit` in particular); propose it for owner approval,
  never apply it as part of diagnosis.

Sources: [Monitor AKS — resource logs](https://learn.microsoft.com/azure/aks/monitor-aks#resource-logs),
[AKS monitoring data reference](https://learn.microsoft.com/azure/aks/monitor-aks-reference),
[AKSAudit](https://learn.microsoft.com/azure/azure-monitor/reference/tables/aksaudit),
[AKSControlPlane](https://learn.microsoft.com/azure/azure-monitor/reference/tables/akscontrolplane).

## Learn Grounding Fallback

If the first troubleshooting pass is incomplete, search Microsoft Learn using:

- the user prompt
- the parsed problem names
- the AKS troubleshooting context

Use Learn grounding to refine or validate the root-cause hypothesis, not to replace observed evidence.
