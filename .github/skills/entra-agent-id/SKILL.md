---
name: entra-agent-id
description: |
  Microsoft Entra Agent ID (preview) for creating OAuth2-capable AI agent identities via Microsoft Graph beta API.
  Covers Agent Identity Blueprints, BlueprintPrincipals, Agent Identities, required permissions, sponsors, and Workload Identity Federation.
  Triggers: "agent identity", "agent id", "Agent Identity Blueprint", "BlueprintPrincipal", "entra agent", "agent identity provisioning", "Graph agent identity".
---

# Microsoft Entra Agent ID

Create and manage OAuth2-capable identities for AI agents using Microsoft Graph beta API.

> **Preview API** — All Agent Identity endpoints are under `/beta` only. Not available in `/v1.0`.

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

One of: **Agent Identity Developer**, **Agent Identity Administrator**, or **Application Administrator**.

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

Sponsors are required and **must be User objects** — ServicePrincipals and Groups are rejected.

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

## Runtime Token Exchange

Agent Identities authenticate at runtime using a **two-step token exchange** through
the Entra `/oauth2/v2.0/token` endpoint. This is a standard Entra feature — it works
anywhere (Azure, on-premises, local dev), not just inside Azure AI Foundry.

### How It Works

```
Step 1: Blueprint credentials + fmi_path → Parent token (aud: api://AzureADTokenExchange)
Step 2: Parent token as client_assertion → Graph token (aud: https://graph.microsoft.com)
```

The `fmi_path` parameter targets a specific Agent Identity, so the resulting Graph token
has `sub` = that Agent Identity's appId — giving each agent instance a distinct audit trail.

### Step 1: Get Parent Token

```python
import json
import urllib.parse
import urllib.request

TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"

def get_parent_token(tenant_id: str, blueprint_app_id: str,
                     blueprint_secret: str, agent_identity_id: str) -> str:
    """Get a parent token scoped to a specific Agent Identity.

    Args:
        tenant_id: The Agent Identity's home tenant (NOT the Blueprint's
                   home tenant if cross-tenant).
        blueprint_app_id: The Blueprint's appId.
        blueprint_secret: A client secret on the Blueprint.
        agent_identity_id: The Agent Identity's appId.
    """
    params = {
        "grant_type": "client_credentials",
        "client_id": blueprint_app_id,
        "client_secret": blueprint_secret,
        "scope": "api://AzureADTokenExchange/.default",
        "fmi_path": agent_identity_id,
    }
    data = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(
        TOKEN_URL.format(tenant=tenant_id), data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())["access_token"]
```

The parent token has `aud: api://AzureADTokenExchange` and **cannot** call Graph
directly — it's an intermediate used as `client_assertion` in step 2.

### Step 2a: Autonomous Exchange (App-Only Permissions)

```python
def exchange_autonomous(tenant_id: str, agent_identity_id: str,
                        parent_token: str) -> dict:
    """Exchange parent token for an app-only Graph token."""
    params = {
        "grant_type": "client_credentials",
        "client_id": agent_identity_id,
        "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "client_assertion": parent_token,
        "scope": "https://graph.microsoft.com/.default",
    }
    data = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(
        TOKEN_URL.format(tenant=tenant_id), data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())
```

The resulting token contains `roles` with application permissions granted to the
Agent Identity SP (via `appRoleAssignments`).

### Step 2b: OBO Exchange (Delegated Permissions)

Exchanges the parent token **plus** a user token for a delegated Graph token.
The agent acts on behalf of the user, respecting per-agent delegated permission grants.

```python
def exchange_obo(tenant_id: str, agent_identity_id: str,
                 parent_token: str, user_token: str) -> dict:
    """Exchange parent + user token for delegated Graph token."""
    params = {
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "client_id": agent_identity_id,
        "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "client_assertion": parent_token,
        "assertion": user_token,
        "requested_token_use": "on_behalf_of",
        "scope": "https://graph.microsoft.com/.default",
    }
    data = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(
        TOKEN_URL.format(tenant=tenant_id), data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())
```

The resulting token contains `scp` with delegated permissions consented for this
specific Agent Identity (via `oauth2PermissionGrants`).

### Key Rules

- **Both exchanges MUST use `/.default` scope** — individual scopes like `User.Read Mail.Send` will fail
- **`fmi_path` is NOT the same as RFC 8693 token exchange** — do not use `urn:ietf:params:oauth:grant-type:token-exchange` grant type (returns `AADSTS82001`)
- For option A (WIF/MI), step 1 uses the MI token as a federated credential; for option B (client secret), step 1 uses the secret directly. Both arrive at the same parent token + step 2 exchange pattern.

## OBO: Blueprint API Configuration

OBO mode requires the Blueprint application to be configured as an API that users
can acquire tokens for. Without this configuration, the user token can't correctly
target the Blueprint as its audience.

### Configure the Blueprint

```python
import uuid

scope_id = str(uuid.uuid4())
patch = {
    "identifierUris": [f"api://{blueprint_app_id}"],
    "api": {
        "requestedAccessTokenVersion": 2,
        "oauth2PermissionScopes": [{
            "id": scope_id,
            "adminConsentDescription": "Allow the app to access the agent API on behalf of the user.",
            "adminConsentDisplayName": "Access agent API",
            "userConsentDescription": "Allow the app to access the agent API on your behalf.",
            "userConsentDisplayName": "Access agent API",
            "value": "access_as_user",
            "type": "User",
            "isEnabled": True,
        }],
        "preAuthorizedApplications": [{
            "appId": client_app_id,  # Your front-end or CLI app's appId
            "permissionIds": [scope_id],
        }],
    },
    "optionalClaims": {
        "accessToken": [{
            "name": "idtyp",
            "source": None,
            "essential": False,
            "additionalProperties": ["include_user_token"],
        }]
    },
}
resp = requests.patch(
    f"{GRAPH}/applications/{blueprint_obj_id}",
    headers=headers,
    json=patch,
)
resp.raise_for_status()
```

All four elements are required:
1. **`identifierUris`** — enables `api://{appId}` audience
2. **`oauth2PermissionScopes`** — defines the `access_as_user` scope
3. **`preAuthorizedApplications`** — authorizes your client app (skips consent prompt)
4. **`optionalClaims`** — emits `idtyp` claim for token validation

### Acquire the User Token

The user token must target the **Blueprint** as its audience, NOT Graph:

```python
from azure.identity import InteractiveBrowserCredential

credential = InteractiveBrowserCredential(
    tenant_id=tenant_id,
    client_id=client_app_id,  # Your client app, NOT the Blueprint
    redirect_uri="http://localhost:8400",
)
# Scope targets Blueprint, not Graph:
user_token = credential.get_token(f"api://{blueprint_app_id}/access_as_user")
```

If the user token targets `https://graph.microsoft.com` instead, step 2b fails
with `AADSTS50013: Assertion failed signature validation`.

## Granting Permissions to Agent Identities

Agent Identities support both application permissions (for autonomous mode) and
delegated permissions (for OBO mode). Permissions are granted per Agent Identity,
enabling fine-grained scoping.

### Application Permissions (appRoleAssignments)

For autonomous mode — grants the Agent Identity permission to call Graph as itself:

```python
# Find the Microsoft Graph SP in your tenant
graph_sp = requests.get(
    f"{GRAPH}/servicePrincipals?$filter=appId eq '00000003-0000-0000-c000-000000000000'",
    headers=headers,
).json()["value"][0]
graph_sp_id = graph_sp["id"]

# Find the appRole ID for User.Read.All
user_read_all_role = next(
    r for r in graph_sp["appRoles"]
    if r["value"] == "User.Read.All"
)

# Grant to Agent Identity SP
resp = requests.post(
    f"{GRAPH}/servicePrincipals/{agent_sp_id}/appRoleAssignments",
    headers=headers,
    json={
        "principalId": agent_sp_id,
        "resourceId": graph_sp_id,
        "appRoleId": user_read_all_role["id"],
    },
)
resp.raise_for_status()
```

### Delegated Permissions (oauth2PermissionGrants)

For OBO mode — programmatic admin consent granting delegated scopes per Agent Identity:

```python
from datetime import datetime, timedelta, timezone

expiry = (datetime.now(timezone.utc) + timedelta(days=3650)).strftime(
    "%Y-%m-%dT%H:%M:%SZ"
)

resp = requests.post(
    f"{GRAPH}/oauth2PermissionGrants",
    headers=headers,
    json={
        "clientId": agent_sp_id,        # Agent Identity SP object ID
        "consentType": "AllPrincipals",
        "resourceId": graph_sp_id,       # Microsoft Graph SP object ID
        "scope": "User.Read Tasks.ReadWrite Mail.Send",  # Space-separated
        "expiryTime": expiry,            # Required by beta API
    },
)
resp.raise_for_status()
```

### Per-Agent Scoping Example

Different agents can have different permission boundaries:

```python
AGENT_SCOPES = {
    "it-helpdesk":   "User.Read Tasks.ReadWrite",
    "comms-agent":   "User.Read Mail.Send Calendars.ReadWrite",
    "hr-onboarding": "User.Read User.ReadBasic.All",
}

for agent_name, scopes in AGENT_SCOPES.items():
    agent_sp_id = agent_identities[agent_name]
    grant_delegated_permissions(agent_sp_id, scopes)
```

### Permission Notes

- **`Group.ReadWrite.All` cannot be granted** as a delegated permission to agent identities
- `Tasks.ReadWrite` alone covers Planner task operations (no Group scope needed)
- `expiryTime` is **required** on the beta API for `oauth2PermissionGrants` (not required on v1.0)
- Browser-based admin consent URLs **do not work** for agent identities — use `oauth2PermissionGrants` API for programmatic consent
- Not all Graph scopes are allowed for agent identities — test each scope if you hit errors

## Cross-Tenant Agent Identity

Agent Identities can be created and used across tenants. The Blueprint must be
multi-tenant (`signInAudience: AzureADMultipleOrgs`).

### Setup Requirements

1. **Blueprint must be multi-tenant:**
   ```python
   requests.patch(
       f"{GRAPH}/applications/{blueprint_obj_id}",
       headers=headers,
       json={"signInAudience": "AzureADMultipleOrgs"},
   )
   ```

2. **BlueprintPrincipal must exist in the target tenant** — provision via admin
   consent or API in the foreign tenant.

3. **Agent Identity is created in the target tenant** — the `POST /servicePrincipals`
   call authenticates to the target tenant using the Blueprint's multi-tenant credentials.

### Critical Tenant Targeting Rule

When performing the two-step token exchange cross-tenant:

- **Step 1 (parent token) MUST target the Agent Identity's home tenant**, not the Blueprint's home tenant
- If step 1 targets the Blueprint's home tenant, the parent token has the wrong issuer, and step 2 fails with `AADSTS700211: No matching federated identity record found`

```python
# CORRECT: Step 1 targets Agent Identity's tenant
parent = get_parent_token(
    tenant_id=AGENT_IDENTITY_TENANT,  # Where the Agent Identity lives
    blueprint_app_id=BLUEPRINT_APP_ID,
    blueprint_secret=BLUEPRINT_SECRET,
    agent_identity_id=AGENT_IDENTITY_APP_ID,
)

# WRONG: Step 1 targets Blueprint's tenant — fails with AADSTS700211
parent = get_parent_token(
    tenant_id=BLUEPRINT_TENANT,  # Wrong! Parent token issuer won't match
    ...
)
```

This works because the Blueprint is multi-tenant, so its client_credentials
authenticate successfully against any tenant where its SP exists. The resulting
parent token has the correct issuer (`login.microsoftonline.com/{agent-tenant}/v2.0`)
to match the Agent Identity's federation configuration.

## API Reference

| Operation | Method | Endpoint | OData Type |
|-----------|--------|----------|------------|
| Create Blueprint | `POST` | `/applications` | `Microsoft.Graph.AgentIdentityBlueprint` |
| Create BlueprintPrincipal | `POST` | `/servicePrincipals` | `Microsoft.Graph.AgentIdentityBlueprintPrincipal` |
| Create Agent Identity | `POST` | `/servicePrincipals` | `Microsoft.Graph.AgentIdentity` |
| List Agent Identities | `GET` | `/servicePrincipals?$filter=...` | — |
| Delete Agent Identity | `DELETE` | `/servicePrincipals/{id}` | — |
| Delete Blueprint | `DELETE` | `/applications/{id}` | — |
| Grant App Permission | `POST` | `/servicePrincipals/{id}/appRoleAssignments` | — |
| Grant Delegated Permission | `POST` | `/oauth2PermissionGrants` | — |

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
| `AppRoleAssignment.ReadWrite.All` | Grant application permissions to Agent Identities |
| `DelegatedPermissionGrant.ReadWrite.All` | Grant delegated permissions (oauth2PermissionGrants) |

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
2. **Use User objects as sponsors** — ServicePrincipals and Groups are rejected
3. **Handle permission propagation delays** — after admin consent, wait 30–120s; retry with backoff on 403
4. **Include `OData-Version: 4.0` header** on every Graph request
5. **Use Workload Identity Federation for production auth** — for local dev, use a client secret on the Blueprint (see [references/oauth2-token-flow.md](references/oauth2-token-flow.md))
6. **Set `identifierUris` on Blueprint** before using OAuth2 scoping (`api://{app-id}`)
7. **Never use Azure CLI tokens** for API calls — they contain `Directory.AccessAsUser.All` which is hard-rejected
8. **Check for existing resources** before creating — implement idempotent provisioning
9. **Use `fmi_path` for runtime exchange** — do NOT use RFC 8693 `urn:ietf:params:oauth:grant-type:token-exchange` (returns `AADSTS82001`)
10. **Always use `/.default` scope in token exchanges** — individual scopes like `User.Read` will fail
11. **Target the Agent Identity's home tenant** in step 1 of cross-tenant exchange — the Blueprint's home tenant will produce a mismatched issuer
12. **Grant permissions per Agent Identity** — use `appRoleAssignments` for app permissions and `oauth2PermissionGrants` for delegated; do not grant to the BlueprintPrincipal
13. **Use `oauth2PermissionGrants` API for delegated consent** — browser-based admin consent URLs do not work for agent identities

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `AADSTS82001` | Used RFC 8693 token-exchange grant type | Use `client_credentials` with `fmi_path` parameter |
| `AADSTS700211: No matching federated identity record` | Step 1 parent token targeted wrong tenant | Step 1 must target the Agent Identity's home tenant |
| `AADSTS50013: Assertion failed signature validation` | OBO user token targets Graph instead of Blueprint | Change user token scope to `api://{blueprint_app_id}/access_as_user` |
| `AADSTS65001: consent_required` | Missing oauth2PermissionGrants or used individual scopes | Use `/.default` scope and verify grants exist |
| `403 Authorization_RequestDenied` | Missing permission grant on Agent Identity | Add via `appRoleAssignments` or `oauth2PermissionGrants` |
| `PropertyNotCompatibleWithAgentIdentity` | Tried to add secret/cert to Agent Identity SP | Credentials belong on the Blueprint only |
| `Agent Blueprint Principal does not exist` | BlueprintPrincipal not created | POST to `/servicePrincipals` with `AgentIdentityBlueprintPrincipal` type |
| `AADSTS650051` on admin consent | SP already exists from partial consent | Grant permissions directly via `appRoleAssignments` API |

## References

| File | Contents |
|------|----------|
| [references/oauth2-token-flow.md](references/oauth2-token-flow.md) | Production (MI + WIF), local dev (client secret), and runtime exchange token flows |
| [references/known-limitations.md](references/known-limitations.md) | 29 known issues organized by category (from official preview known-issues page) |
| [references/acceptance-criteria.md](references/acceptance-criteria.md) | Correct/incorrect code patterns for validation |

### External Links

| Resource | URL |
|----------|-----|
| Official Setup Guide | https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/agent-id-setup-instructions |
| AI-Guided Setup | https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/agent-id-ai-guided-setup |
