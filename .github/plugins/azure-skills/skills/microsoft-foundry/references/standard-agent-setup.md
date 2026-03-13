# Standard Agent Setup

> **MANDATORY:** Read [Standard Agent Setup docs](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/standard-agent-setup?view=foundry) before proceeding with standard setup.

## Overview

Azure AI Foundry supports two agent setup configurations:

| Setup | Capability Host | Description |
|-------|----------------|-------------|
| **Basic** | None | Default setup. All resources are Microsoft-managed. No additional connections required. |
| **Standard** | Azure AI Services | Advanced setup. Bring-your-own storage and search connections for full control over data residency and scaling. |

## Standard Setup Connections

| Connection | Service | Required | Purpose |
|------------|---------|----------|---------|
| Thread storage | Azure Cosmos DB | ✅ Yes | Store conversation threads in your own Cosmos DB instance |
| File storage | Azure Storage | ✅ Yes | Store uploaded files in your own Azure Storage account |
| Vector store | Azure AI Search | ✅ Yes | Use your own Azure AI Search instance for vector/knowledge retrieval |
| Azure AI Services | Azure AI Services | ❌ Optional | Use OpenAI models from a different AI Services resource |

> 💡 **Tip:** Standard setup is recommended for production workloads that require control over data storage, custom vector search, or integration with models from a separate AI Services resource.

## Prerequisites

Before starting deployment, confirm the following with the user:

1. **RBAC role on the resource group:** The user must have **Owner** or **User Access Administrator** role on the target resource group. The Bicep template assigns RBAC roles (Storage Blob Data Contributor, Cosmos DB Operator, AI Search roles) to the project's managed identity — this will fail without `Microsoft.Authorization/roleAssignments/write` permission.
2. **Subscription quota:** Verify the target region has available quota for AI Services. If quota is exhausted, try an alternate region (e.g., `swedencentral`, `eastus`, `westus3`).
3. **Azure Policy compliance:** Some subscriptions enforce policies (e.g., storage accounts must disable public network access). If the Bicep template fails due to policy violations, patch the template to comply (e.g., set `publicNetworkAccess: 'Disabled'` and `defaultAction: 'Deny'` on the storage account).

## Deployment

- Standard setup always creates a **new Foundry resource and a new project**. Do not ask the user for a project endpoint — one will be provisioned as part of the deployment.
- **Always use the official Bicep template:**
  [Standard Agent Setup Bicep Template](https://github.com/azure-ai-foundry/foundry-samples/blob/main/infrastructure/infrastructure-setup-bicep/43-standard-agent-setup-with-customization/main.bicep)

> ⚠️ **Warning:** Capability host provisioning is **asynchronous** and can take 10–20 minutes. After deploying the Bicep template, you **must poll** the deployment status until it succeeds. Do not assume the setup is complete immediately.

## Post-Deployment: Model & Agent

After infrastructure provisioning succeeds:

1. **Deploy a model** to the new AI Services account (e.g., `gpt-4o`). If `GlobalStandard` SKU quota is exhausted, fall back to `Standard` SKU.
2. **Create the agent** using MCP tools (`agent_update`) or the Python SDK (`client.agents.create_version`). See [SDK Operations](../agent/create/references/sdk-operations.md) for details.

## References

- [Capability Hosts — Agent Setup Types](https://learn.microsoft.com/en-us/azure/ai-foundry/agents/concepts/capability-hosts?view=foundry)
- [Standard Agent Setup](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/standard-agent-setup?view=foundry)
