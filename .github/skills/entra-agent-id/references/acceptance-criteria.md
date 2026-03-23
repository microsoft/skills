# Entra Agent ID Acceptance Criteria

**Skill**: `entra-agent-id`
**Purpose**: Create and manage OAuth2-capable AI agent identities via Microsoft Graph beta API
**Focus**: Agent Identity Blueprints, BlueprintPrincipals, Agent Identities, authentication, permissions, runtime token exchange

---

## 1. Authentication

### 1.1 ✅ CORRECT: ClientSecretCredential for Python

```python
from azure.identity import ClientSecretCredential

credential = ClientSecretCredential(
    tenant_id=os.environ["AZURE_TENANT_ID"],
    client_id=os.environ["AZURE_CLIENT_ID"],
    client_secret=os.environ["AZURE_CLIENT_SECRET"],
)
token = credential.get_token("https://graph.microsoft.com/.default")
```

### 1.2 ✅ CORRECT: Connect-MgGraph for PowerShell

```powershell
Connect-MgGraph -Scopes @(
    "AgentIdentityBlueprint.Create",
    "AgentIdentityBlueprint.ReadWrite.All",
    "AgentIdentityBlueprintPrincipal.Create",
    "User.Read"
)
Set-MgRequestContext -ApiVersion beta
```

### 1.3 ❌ INCORRECT: DefaultAzureCredential

```python
# WRONG — Azure CLI tokens contain Directory.AccessAsUser.All which is hard-rejected (403)
from azure.identity import DefaultAzureCredential
credential = DefaultAzureCredential()
```

### 1.4 ❌ INCORRECT: Missing explicit scopes in PowerShell

```powershell
# WRONG — no scopes specified, may not get Agent Identity permissions
Connect-MgGraph
```

---

## 2. Required Headers

### 2.1 ✅ CORRECT: OData-Version header included

```python
headers = {
    "Authorization": f"Bearer {token.token}",
    "Content-Type": "application/json",
    "OData-Version": "4.0",
}
```

### 2.2 ❌ INCORRECT: Missing OData-Version header

```python
# WRONG — Agent Identity API calls may fail without OData-Version
headers = {
    "Authorization": f"Bearer {token.token}",
    "Content-Type": "application/json",
}
```

---

## 3. API Base URL

### 3.1 ✅ CORRECT: Beta endpoint

```python
GRAPH = "https://graph.microsoft.com/beta"
resp = requests.post(f"{GRAPH}/applications", headers=headers, json=body)
```

### 3.2 ❌ INCORRECT: v1.0 endpoint

```python
# WRONG — Agent Identity APIs only exist in /beta, not /v1.0
GRAPH = "https://graph.microsoft.com/v1.0"
```

---

## 4. Blueprint Creation

### 4.1 ✅ CORRECT: OData type and User sponsor

```python
blueprint_body = {
    "@odata.type": "Microsoft.Graph.AgentIdentityBlueprint",
    "displayName": "My Agent Blueprint",
    "sponsors@odata.bind": [
        f"https://graph.microsoft.com/beta/users/{user_id}"
    ],
}
resp = requests.post(f"{GRAPH}/applications", headers=headers, json=blueprint_body)
```

### 4.2 ❌ INCORRECT: Missing @odata.type

```python
# WRONG — creates a regular application, not an Agent Identity Blueprint
blueprint_body = {
    "displayName": "My Agent Blueprint",
}
```

### 4.3 ❌ INCORRECT: ServicePrincipal as sponsor

```python
# WRONG — sponsors must be User objects, not ServicePrincipals or Groups
"sponsors@odata.bind": [
    f"https://graph.microsoft.com/beta/servicePrincipals/{sp_id}"
]
```

---

## 5. BlueprintPrincipal Creation

### 5.1 ✅ CORRECT: Explicit BlueprintPrincipal creation after Blueprint

```python
sp_body = {
    "@odata.type": "Microsoft.Graph.AgentIdentityBlueprintPrincipal",
    "appId": app_id,
}
resp = requests.post(f"{GRAPH}/servicePrincipals", headers=headers, json=sp_body)
```

### 5.2 ❌ INCORRECT: Skipping BlueprintPrincipal

```python
# WRONG — Blueprint does NOT auto-create its service principal
# Agent Identity creation will fail with:
# "The Agent Blueprint Principal for the Agent Blueprint does not exist."
blueprint = create_blueprint(...)
agent = create_agent_identity(blueprint_app_id=blueprint["appId"])  # 400 error
```

---

## 6. Agent Identity Creation

### 6.1 ✅ CORRECT: Full Agent Identity with blueprint reference

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
```

### 6.2 ❌ INCORRECT: Missing agentIdentityBlueprintId

```python
# WRONG — agent identity must reference its blueprint
agent_body = {
    "@odata.type": "Microsoft.Graph.AgentIdentity",
    "displayName": "my-agent-instance-1",
}
```

---

## 7. Cleanup

### 7.1 ✅ CORRECT: Delete in order (agents first, then blueprint)

```python
# Delete agent identities first
requests.delete(f"{GRAPH}/servicePrincipals/{agent_sp_id}", headers=headers)

# Then delete the blueprint (application)
requests.delete(f"{GRAPH}/applications/{blueprint_obj_id}", headers=headers)
```

### 7.2 ❌ INCORRECT: Delete blueprint without cleaning up agents

```python
# WRONG — orphaned agent identities remain as unmanaged service principals
requests.delete(f"{GRAPH}/applications/{blueprint_obj_id}", headers=headers)
```

---

## 8. Idempotent Provisioning

### 8.1 ✅ CORRECT: Check before create

```python
# Check if blueprint already exists
resp = requests.get(
    f"{GRAPH}/applications?$filter=displayName eq 'My Agent Blueprint'",
    headers=headers,
)
existing = resp.json().get("value", [])
if existing:
    blueprint = existing[0]
else:
    blueprint = create_blueprint(...)

# Always ensure BlueprintPrincipal exists (previous run may have crashed)
ensure_blueprint_principal(blueprint["appId"])
```

### 8.2 ❌ INCORRECT: No existence check

```python
# WRONG — fails on rerun if blueprint already exists with same identifierUris
blueprint = create_blueprint(...)  # May conflict
```

---

## 9. Runtime Token Exchange (fmi_path)

### 9.1 ✅ CORRECT: Two-step exchange with fmi_path and client_assertion

```python
# Step 1: Parent token via fmi_path
params = {
    "grant_type": "client_credentials",
    "client_id": BLUEPRINT_APP_ID,
    "client_secret": SECRET,
    "scope": "api://AzureADTokenExchange/.default",
    "fmi_path": AGENT_IDENTITY_APP_ID,
}
# POST to https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token

# Step 2: Exchange parent for Graph token
params = {
    "grant_type": "client_credentials",
    "client_id": AGENT_IDENTITY_APP_ID,
    "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    "client_assertion": parent_token,
    "scope": "https://graph.microsoft.com/.default",
}
```

### 9.2 ❌ INCORRECT: RFC 8693 token-exchange grant type

```python
# WRONG — returns AADSTS82001; fmi_path is NOT RFC 8693 token exchange
params = {
    "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
    "subject_token": some_token,
    "subject_token_type": "urn:ietf:params:oauth:token-type:jwt",
}
```

### 9.3 ❌ INCORRECT: Individual scopes instead of .default

```python
# WRONG — individual scopes fail; must use /.default
params = {
    "scope": "User.Read Mail.Send",  # Fails
}
# CORRECT:
params = {
    "scope": "https://graph.microsoft.com/.default",
}
```

### 9.4 ❌ INCORRECT: Using parent token directly as Graph token

```python
# WRONG — parent token has aud: api://AzureADTokenExchange, not Graph
# It CANNOT call Graph directly; step 2 exchange is required
requests.get(
    "https://graph.microsoft.com/v1.0/users",
    headers={"Authorization": f"Bearer {parent_token}"},
)  # 401
```

---

## 10. OBO (On-Behalf-Of) Exchange

### 10.1 ✅ CORRECT: User token targets Blueprint audience

```python
from azure.identity import InteractiveBrowserCredential

credential = InteractiveBrowserCredential(
    tenant_id=TENANT_ID,
    client_id=CLIENT_APP_ID,
    redirect_uri="http://localhost:8400",
)
# Scope targets the Blueprint:
user_token = credential.get_token(f"api://{BLUEPRINT_APP_ID}/access_as_user")
```

### 10.2 ❌ INCORRECT: User token targets Graph directly

```python
# WRONG — OBO exchange fails with AADSTS50013: Assertion failed signature validation
user_token = credential.get_token("https://graph.microsoft.com/.default")
```

### 10.3 ✅ CORRECT: Blueprint API fully configured for OBO

```python
patch = {
    "identifierUris": [f"api://{blueprint_app_id}"],
    "api": {
        "requestedAccessTokenVersion": 2,
        "oauth2PermissionScopes": [{ ... }],          # access_as_user scope
        "preAuthorizedApplications": [{ ... }],        # client app authorized
    },
    "optionalClaims": {
        "accessToken": [{"name": "idtyp", ...}],      # idtyp with include_user_token
    },
}
```

### 10.4 ❌ INCORRECT: Missing Blueprint API configuration

```python
# WRONG — without identifierUris, oauth2PermissionScopes, preAuthorizedApplications,
# and optionalClaims, OBO exchange fails
# All four elements are required
```

### 10.5 ✅ CORRECT: Delegated permissions via oauth2PermissionGrants

```python
requests.post(
    f"{GRAPH}/oauth2PermissionGrants",
    headers=headers,
    json={
        "clientId": agent_sp_id,
        "consentType": "AllPrincipals",
        "resourceId": graph_sp_id,
        "scope": "User.Read Tasks.ReadWrite",
        "expiryTime": "2036-01-01T00:00:00Z",  # Required by beta API
    },
)
```

### 10.6 ❌ INCORRECT: Browser-based admin consent for agent identities

```python
# WRONG — browser admin consent URLs do not work for agent identities
# Use the oauth2PermissionGrants API for programmatic consent instead
webbrowser.open(
    f"https://login.microsoftonline.com/{tenant}/adminconsent?client_id={agent_id}"
)
```

---

## 11. Cross-Tenant Exchange

### 11.1 ✅ CORRECT: Step 1 targets Agent Identity's home tenant

```python
# Blueprint in Tenant A, Agent Identity in Tenant B
parent = get_parent_token(
    tenant_id=TENANT_B,          # Agent Identity's home tenant
    blueprint_app_id=BLUEPRINT_APP_ID,
    blueprint_secret=SECRET,
    agent_identity_id=AGENT_ID,
)
```

### 11.2 ❌ INCORRECT: Step 1 targets Blueprint's home tenant

```python
# WRONG — parent token issuer won't match Agent Identity's federation config
# Fails with AADSTS700211: No matching federated identity record found
parent = get_parent_token(
    tenant_id=TENANT_A,          # Blueprint's tenant — WRONG for cross-tenant!
    blueprint_app_id=BLUEPRINT_APP_ID,
    blueprint_secret=SECRET,
    agent_identity_id=AGENT_ID,
)
```

---

## 12. Permission Grants

### 12.1 ✅ CORRECT: Grant app permissions to Agent Identity SP

```python
requests.post(
    f"{GRAPH}/servicePrincipals/{agent_sp_id}/appRoleAssignments",
    headers=headers,
    json={
        "principalId": agent_sp_id,
        "resourceId": graph_sp_id,
        "appRoleId": user_read_all_role_id,
    },
)
```

### 12.2 ❌ INCORRECT: Grant app permissions to BlueprintPrincipal

```python
# WRONG — grant to individual agent identities, not the blueprint principal
# Known limitation #21: Cannot grant app permissions to blueprint principals
requests.post(
    f"{GRAPH}/servicePrincipals/{blueprint_sp_id}/appRoleAssignments",
    ...
)
```
