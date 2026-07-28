---
name: azure-cost
description: "Azure cost management: query costs, forecast spending, optimize to reduce waste. WHEN: \"Azure costs\", \"Azure bill\", \"cost breakdown\", \"how much am I spending\", \"forecast spending\", \"optimize costs\", \"reduce spending\", \"orphaned resources\", \"rightsize VMs\", \"cost spike\", \"reduce storage costs\", \"AKS cost\". DO NOT USE FOR: deploying resources, provisioning, diagnostics, or security audits."
license: MIT
metadata:
  author: Microsoft
  version: "1.2.1"
---

# Azure Cost Management Skill

Query historical costs, forecast future spending, optimize to reduce waste.

## Routing

| User Intent | Workflow |
|-------------|----------|
| Understand current costs | [Cost Query](cost-query/workflow.md) |
| Reduce costs / find waste | [Cost Optimization](cost-optimization/workflow.md) |
| Project future costs | [Cost Forecast](cost-forecast/workflow.md) |

## Quick Reference

| Property | Value |
|----------|-------|
| **Query API** | `POST {scope}/providers/Microsoft.CostManagement/query?api-version=2023-11-01` |
| **Forecast API** | `POST {scope}/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01` |
| **Required Role** | Cost Management Reader + Monitoring Reader + Reader (on target scope) |

## Scope Patterns

- Subscription: `/subscriptions/<id>`
- Resource Group: `/subscriptions/<id>/resourceGroups/<name>`
- Management Group: `/providers/Microsoft.Management/managementGroups/<id>`
- Billing Account: `/providers/Microsoft.Billing/billingAccounts/<id>`

## Service-Specific Optimization

- [Redis](cost-optimization/services/redis/azure-cache-for-redis.md)
- [Storage](cost-optimization/services/storage/azure-storage.md)

## References

- [MCP Tools, Best Practices, Safety](references/tools-and-best-practices.md)
- [SDK: Redis .NET](cost-optimization/sdk/azure-resource-manager-redis-dotnet.md)
