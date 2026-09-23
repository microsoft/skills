# Azure Kubernetes Service (AKS) Cost and Utilization Anomalies

This workflow supports both cluster-level and namespace-level cost analysis.

1. Confirm the anomaly window and affected cluster or namespace.
2. `query_aks_costs` supports daily or monthly cost granularity, not hourly
   attribution. Query the affected day and comparable baseline days with the
   same grouping, and report each currency separately.
3. If the available Azure Resource Manager MCP surface exposes node-count, CPU,
   memory, autoscaler,
   or Kubernetes event evidence, correlate it with the cost change. Otherwise
   state that hourly utilization evidence is unavailable; do not infer an
   hour-level cause from daily cost data.
4. Compare namespace allocation and idle categories before and during the
   anomaly. Check new workloads, missing requests or limits, batch schedules,
   PodDisruptionBudgets, and blocked scale-down.
5. Correlate the result with Resource Graph change history. Run generated
   queries through `validate_query` before `execute_query`; empty history is
   inconclusive because retention and permissions are limited.
6. Present the cost delta, utilization evidence, likely cause, confidence, and
   next action. Hand rightsizing or autoscaler remediation to
   `cost-optimization`.

Do not create budgets, resize node pools, enable add-ons, or change autoscaling
without explicit confirmation.
