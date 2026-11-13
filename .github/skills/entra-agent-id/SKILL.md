---
name: entra-agent-id
description: |
  Microsoft Entra Agent ID for creating OAuth2-capable AI agent identities via Microsoft Graph API.
  Covers Agent Identity Blueprints, BlueprintPrincipals, Agent Identities, required permissions, sponsors, and Workload Identity Federation.
  Includes Microsoft Entra SDK for AgentID (containerized sidecar) for polyglot agent authentication (Docker/Kubernetes), 3P agent integration, autonomous and interactive agent patterns.
  Triggers: "agent identity", "agent id", "Agent Identity Blueprint", "BlueprintPrincipal", "entra agent", "agent identity provisioning", "Graph agent identity", "entra sidecar", "agent id sidecar", "auth sidecar", "3P agent", "third-party agent identity", "polyglot agent auth".
---

# Microsoft Entra Agent ID

Create and manage OAuth2-capable identities for AI agents using Microsoft Graph.

> **API surface** — Agent ID resources are published in both Graph `/beta` and `/v1.0` ([agentIdentity v1.0](https://learn.microsoft.com/en-us/graph/api/resources/agentidentity?view=graph-rest-1.0), [agentIdentityBlueprint v1.0](https://learn.microsoft.com/en-us/graph/api/resources/agentidentityblueprint?view=graph-rest-1.0)). The samples in this skill use `/beta`, which remains supported.

## Before You Start

Search `microsoft-docs` MCP for the latest Agent ID documentation:
- Query: "Microsoft Entra agent identity setup"
- Verify: API parameters match current preview behavior

## Conceptual Model

```
Agent Identity Blueprint (application)        ← one per agent type/project
  └── BlueprintPrincipal (service principal)   ← MUST be created explicitly
        ├── Agent Identity (SP): agent-1       ← one per agent instance
        ├── Agent Identity (SP): agent-2
        └── Agent Identity (SP): agent-3
```

## Prerequisites

### PowerShell (recommended for interactive setup)

```powershell
# Requires PowerShell 7+
Install-Module Microsoft.Graph.Beta.Applications -Scope CurrentUser -Force
```

### Python (for programmatic provisioning)

```bash
pip install azure-identity requests
```

### Required Entra Roles

One of: **Agent ID Developer**, **Agent ID Administrator**, or **AI Administrator** (AI Administrator for agent identity creation only). Owners of a blueprint or blueprint principal can create agent identities from it with delegated permissions and no Agent ID role.

## Environment Variables

```bash
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<app-registration-client-id>
AZURE_CLIENT_SECRET=<app-registration-secret>
```

## Authentication

> **⚠️ `DefaultAzureCredential` is NOT supported.** Azure CLI tokens contain
> `Directory.AccessAsUser.All`, which Agent Identity APIs explicitly reject (403).
> You MUST use a dedicated app registration with `client_credentials` flow or
> connect via `Connect-MgGraph` with explicit delegated scopes.

### PowerShell (delegated permissions)

```powershell
Connect-MgGraph -Scopes @(
    "AgentIdentityBlueprint.Create",
    "AgentIdentityBlueprint.ReadWrite.All",
    "AgentIdentityBlueprintPrincipal.Create",
    "User.Read"
)
Set-MgRequestContext -ApiVersion beta

$currentUser = (Get-MgContext).Account
$userId = (Get-MgUser -UserId $currentUser).Id
```

### Python (application permissions)

```python
import os
import requests
from azure.identity import ClientSecretCredential

credential = ClientSecretCredential(
    tenant_id=os.environ["AZURE_TENANT_ID"],
    client_id=os.environ["AZURE_CLIENT_ID"],
    client_secret=os.environ["AZURE_CLIENT_SECRET"],
)
token = credential.get_token("https://graph.microsoft.com/.default")

GRAPH = "https://graph.microsoft.com/beta"
headers = {
    "Authorization": f"Bearer {token.token}",
    "Content-Type": "application/json",
    "OData-Version": "4.0",  # Required for all Agent Identity API calls
}
```

## Core Workflow

### Step 1: Create Agent Identity Blueprint

A sponsor is **required at creation** and can be a user (guests allowed) or a **supported group** — dynamic membership groups (security or Microsoft 365) and assigned Microsoft 365 groups. Role-assignable groups, assigned security groups, and service principals are rejected as sponsors (service principals can be owners). With delegated permissions the calling user becomes sponsor automatically when none is specified; app-only requests must set sponsors explicitly.

```python
import subprocess

# Get sponsor user ID (client_credentials has no user context, so use az CLI)
result = subprocess.run(
    ["az", "ad", "signed-in-user", "show", "--query", "id", "-o", "tsv"],
    capture_output=True, text=True, check=True,
)
user_id = result.stdout.strip()

blueprint_body = {
    "@odata.type": "Microsoft.Graph.AgentIdentityBlueprint",
    "displayName": "My Agent Blueprint",
    "sponsors@odata.bind": [
        f"https://graph.microsoft.com/beta/users/{user_id}"
    ],
}
resp = requests.post(f"{GRAPH}/applications", headers=headers, json=blueprint_body)
resp.raise_for_status()

blueprint = resp.json()
app_id = blueprint["appId"]
blueprint_obj_id = blueprint["id"]
```

### Step 2: Create BlueprintPrincipal

> **This step is mandatory.** Creating a Blueprint does NOT auto-create its
> service principal. Without this, Agent Identity creation fails with:
> `400: The Agent Blueprint Principal for the Agent Blueprint does not exist.`

```python
sp_body = {
    "@odata.type": "Microsoft.Graph.AgentIdentityBlueprintPrincipal",
    "appId": app_id,
}
resp = requests.post(f"{GRAPH}/servicePrincipals", headers=headers, json=sp_body)
resp.raise_for_status()
```

If implementing idempotent scripts, check for and create the BlueprintPrincipal
even when the Blueprint already exists (a previous run may have created the Blueprint
but crashed before creating the SP).

### Step 3: Create Agent Identities

```python
agent_body = {
    "@odata.type": "Microsoft.Graph.AgentIdentity",
    "displayName": "my-agent-instance-1",
    "agentIdentityBlueprintId": app_id,
    "sponsors@odata.bind": [
        f"https://graph.microsoft.com/beta/users/{user_id}"
    ],
}
resp = requests.post(f"{GRAPH}/servicePrincipals", headers=headers, json=agent_body)
resp.raise_for_status()
agent = resp.json()
```

## API Reference

| Operation | Method | Endpoint | OData Type |
|-----------|--------|----------|------------|
| Create Blueprint | `POST` | `/applications` | `Microsoft.Graph.AgentIdentityBlueprint` |
| Create BlueprintPrincipal | `POST` | `/servicePrincipals` | `Microsoft.Graph.AgentIdentityBlueprintPrincipal` |
| Create Agent Identity | `POST` | `/servicePrincipals` | `Microsoft.Graph.AgentIdentity` |
| List Agent Identities | `GET` | `/servicePrincipals?$filter=...` | — |
| Delete Agent Identity | `DELETE` | `/servicePrincipals/{id}` | — |
| Delete Blueprint | `DELETE` | `/applications/{id}` | — |

All endpoints use base URL: `https://graph.microsoft.com/beta`

## Required Permissions

| Permission | Purpose |
|-----------|---------|
| `Application.ReadWrite.All` | Blueprint CRUD (application objects) |
| `AgentIdentityBlueprint.Create` | Create new Blueprints |
| `AgentIdentityBlueprint.ReadWrite.All` | Read/update Blueprints |
| `AgentIdentityBlueprintPrincipal.Create` | Create BlueprintPrincipals |
| `AgentIdentity.Create.All` | Create Agent Identities |
| `AgentIdentity.ReadWrite.All` | Read/update Agent Identities |

There are **18 Agent Identity-specific** Graph application permissions. Discover all:
```bash
az ad sp show --id 00000003-0000-0000-c000-000000000000 \
  --query "appRoles[?contains(value, 'AgentIdentity')].{id:id, value:value}" -o json
```

Grant admin consent (required for application permissions):
```bash
az ad app permission admin-consent --id <client-id>
```

> Admin consent may fail with 404 if the service principal hasn't replicated. Retry with 10–40s backoff.

## Cleanup

```python
# Delete Agent Identity
requests.delete(f"{GRAPH}/servicePrincipals/{agent['id']}", headers=headers)

# Delete BlueprintPrincipal (get SP ID first)
sps = requests.get(
    f"{GRAPH}/servicePrincipals?$filter=appId eq '{app_id}'",
    headers=headers,
).json()
for sp in sps.get("value", []):
    requests.delete(f"{GRAPH}/servicePrincipals/{sp['id']}", headers=headers)

# Delete Blueprint
requests.delete(f"{GRAPH}/applications/{blueprint_obj_id}", headers=headers)
```

## Best Practices

1. **Always create BlueprintPrincipal after Blueprint** — not auto-created; implement idempotent checks on both
2. **Set sponsors correctly — users or supported groups** — a sponsor is required at create for agent identities and blueprints; users (including guests), dynamic membership groups (security or Microsoft 365), and assigned Microsoft 365 groups are accepted. Role-assignable groups, assigned security groups, and service principals are rejected (service principals can be owners)
3. **Handle permission propagation delays** — after admin consent, wait 30–120s; retry with backoff on 403
4. **Include `OData-Version: 4.0` header** on every Graph request
5. **Use Workload Identity Federation for production auth** — for local dev, use a client secret on the Blueprint (see [references/oauth2-token-flow.md](references/oauth2-token-flow.md))
6. **Set `identifierUris` on Blueprint** before using OAuth2 scoping (`api://{app-id}`)
7. **Never use Azure CLI tokens** for API calls — they contain `Directory.AccessAsUser.All` which is hard-rejected
8. **Check for existing resources** before creating — implement idempotent provisioning

## References

| File | Contents |
|------|----------|
| [references/oauth2-token-flow.md](references/oauth2-token-flow.md) | Production (Managed Identity + WIF) and local dev (client secret) token flows |
| [references/known-limitations.md](references/known-limitations.md) | 29 known issues organized by category (from official preview known-issues page) |
| [references/sdk-sidecar.md](references/sdk-sidecar.md) | Microsoft Entra SDK for AgentID — endpoints, 3P agent patterns, Docker/K8s deployment, security |

### External Links

| Resource | URL |
|----------|-----|
| Best practices for Microsoft Entra Agent ID | https://learn.microsoft.com/en-us/entra/agent-id/best-practices-agent-id |
| Agent ID FAQ (limits, blocked permissions, monitoring) | https://learn.microsoft.com/en-us/entra/agent-id/faq |
| Owners, sponsors, and managers | https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/agent-owners-sponsors-managers |
| AI-Guided Setup | https://learn.microsoft.com/en-us/entra/agent-id/agent-id-ai-guided-setup |
| Microsoft Entra SDK for AgentID — Overview | https://learn.microsoft.com/en-us/entra/msidweb/agent-id-sdk/overview |
| Microsoft Entra SDK for AgentID — Endpoints | https://learn.microsoft.com/en-us/entra/msidweb/agent-id-sdk/endpoints |
