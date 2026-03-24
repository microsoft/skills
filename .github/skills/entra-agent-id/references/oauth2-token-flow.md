# OAuth2 Token Flow

Source: [Agent ID Setup Instructions](https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/agent-id-setup-instructions)

Agent Identities authenticate at runtime using credentials configured on the
**Blueprint** (not the Agent Identity itself). Three options are available:

| Option | Use case | Credential type |
|--------|----------|-----------------|
| **Managed Identity + WIF** | Production (Azure-hosted) | Federated Identity Credential |
| **Client secret** | Local development / testing | Password credential on Blueprint |
| **OBO (On-Behalf-Of)** | Delegated user access | Client secret or WIF + user token |

All three options produce a **parent token** in step 1 and then exchange it for a
**Graph-scoped Agent Identity token** in step 2 via the `fmi_path` exchange pattern.

---

## Option A: Managed Identity + Workload Identity Federation (Production)

### Architecture

```
Container App (user-assigned MI)
  -> ManagedIdentityCredential.get_token("api://{blueprint-app-id}/.default")
    -> Azure AD token exchange (MI token -> Agent ID token)
      -> JWT with oid = MI principal, aud = api://{blueprint-app-id}
        -> Backend validates JWT signature + claims
```

### 1. Set Application ID URI on Blueprint

Required for OAuth2 scope resolution:

```python
requests.patch(
    f"{GRAPH}/applications/{blueprint_obj_id}",
    headers=headers,
    json={"identifierUris": [f"api://{app_id}"]},
)
```

### 2. Create Federated Identity Credential

Create on the Blueprint (not the Agent Identity):

```python
fic_body = {
    "name": "my-fic-name",
    "issuer": f"https://login.microsoftonline.com/{tenant_id}/v2.0",
    "subject": "{mi-principal-id}",  # The MI's object ID (principalId), NOT client ID
    "audiences": ["api://AzureADTokenExchange"],
}
requests.post(
    f"{GRAPH}/applications/{blueprint_obj_id}/microsoft.graph.agentIdentityBlueprint/federatedIdentityCredentials",
    headers=headers,
    json=fic_body,
)
```

### 3. Acquire Token (Caller Side)

```python
from azure.identity import ManagedIdentityCredential

cred = ManagedIdentityCredential(client_id=mi_client_id)
token = cred.get_token(f"api://{blueprint_app_id}/.default")
# Include in requests: Authorization: Bearer {token.token}
```

### 4. Validate Token (Backend)

```python
import jwt
from jwt import PyJWKClient

jwks_uri = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
jwks_client = PyJWKClient(jwks_uri)
signing_key = jwks_client.get_signing_key_from_jwt(token_str)

claims = jwt.decode(
    token_str,
    signing_key.key,
    algorithms=["RS256"],
    audience=f"api://{blueprint_app_id}",
    issuer=f"https://sts.windows.net/{tenant_id}/",
)
```

### Key Rules (WIF)

- **Federated credentials go on the Blueprint**, not the Agent Identity SP. Use the `.../microsoft.graph.agentIdentityBlueprint/federatedIdentityCredentials` path.
- **`subject` is the MI's principalId (object ID)**, not its client ID.
- **`audiences` must be `["api://AzureADTokenExchange"]`**, not your API audience.
- **Issuer format**: `https://login.microsoftonline.com/{tenant}/v2.0`
- **Token issuer** (for validation): `https://sts.windows.net/{tenant}/` (note the trailing slash and different domain)

---

## Option B: Client Secret (Local Development / Testing)

For local development where no Managed Identity is available. This option uses
a client secret on the Blueprint to complete the full two-step `fmi_path` exchange.

### 1. Add a Password Credential to the Blueprint

Via PowerShell:

```powershell
$secretBody = @{
    "passwordCredential" = @{
        "displayName" = "Dev Secret"
        "endDateTime" = "2027-01-01T00:00:00Z"
    }
}

$credential = Invoke-MgGraphRequest -Method POST `
    -Uri "https://graph.microsoft.com/beta/applications/<BLUEPRINT_OBJECT_ID>/addPassword" `
    -Headers @{"OData-Version"="4.0"; "Content-Type"="application/json"} `
    -Body ($secretBody | ConvertTo-Json -Depth 5) -OutputType PSObject

$credential.secretText  # Save NOW — cannot be retrieved later
```

Or via Python (with an existing token):

```python
secret_body = {
    "passwordCredential": {
        "displayName": "Dev Secret",
        "endDateTime": "2027-01-01T00:00:00Z",
    }
}
resp = requests.post(
    f"{GRAPH}/applications/{blueprint_obj_id}/addPassword",
    headers=headers,
    json=secret_body,
)
secret_text = resp.json()["secretText"]  # Save NOW
```

### 2. Get Parent Token (Step 1 of Exchange)

The parent token uses `client_credentials` with the `fmi_path` parameter to target
a specific Agent Identity:

```python
import json
import urllib.parse
import urllib.request

TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"

params = {
    "grant_type": "client_credentials",
    "client_id": BLUEPRINT_APP_ID,
    "client_secret": SECRET_TEXT,
    "scope": "api://AzureADTokenExchange/.default",
    "fmi_path": AGENT_IDENTITY_APP_ID,  # Target this specific Agent Identity
}
data = urllib.parse.urlencode(params).encode("utf-8")
req = urllib.request.Request(
    TOKEN_URL.format(tenant=TENANT_ID), data=data,
    headers={"Content-Type": "application/x-www-form-urlencoded"},
)
with urllib.request.urlopen(req) as resp:
    parent_token = json.loads(resp.read())["access_token"]
```

The parent token has these claims:

| Claim | Value |
|-------|-------|
| `aud` | `api://AzureADTokenExchange` |
| `iss` | `https://login.microsoftonline.com/{tenant}/v2.0` |
| `sub` | Blueprint's SP object ID |
| `appid` | Blueprint's appId |
| `idtyp` | `app` |

This token **cannot** call Graph directly — it's an intermediate token.

### 3. Exchange for Graph Token (Step 2 of Exchange)

Use the parent token as a `client_assertion` to get a Graph-scoped token:

```python
params = {
    "grant_type": "client_credentials",
    "client_id": AGENT_IDENTITY_APP_ID,
    "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    "client_assertion": parent_token,
    "scope": "https://graph.microsoft.com/.default",
}
data = urllib.parse.urlencode(params).encode("utf-8")
req = urllib.request.Request(
    TOKEN_URL.format(tenant=TENANT_ID), data=data,
    headers={"Content-Type": "application/x-www-form-urlencoded"},
)
with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())

graph_token = result["access_token"]
# This token has sub = Agent Identity's appId
# roles = application permissions granted via appRoleAssignments
```

### 4. Use the Graph Token

```python
import requests

resp = requests.get(
    "https://graph.microsoft.com/v1.0/users?$top=5&$select=displayName,mail",
    headers={"Authorization": f"Bearer {graph_token}"},
)
for user in resp.json()["value"]:
    print(f"{user['displayName']} — {user.get('mail', 'N/A')}")
```

### Key Rules (Client Secret)

- **Save `secretText` immediately** — it cannot be retrieved after creation.
- **Secrets belong on the Blueprint only** — agent identities cannot have password credentials (`PropertyNotCompatibleWithAgentIdentity`).
- **NOT for production** — use Managed Identity + WIF in production.
- **Respect org policy** — if `endDateTime` exceeds your tenant's credential lifetime policy, reduce it.
- **Use `fmi_path` parameter** — do NOT use RFC 8693 `urn:ietf:params:oauth:grant-type:token-exchange` (returns `AADSTS82001`).
- **Always use `/.default` scope** in both steps — individual scopes will fail.

---

## Option C: OBO (On-Behalf-Of) — Delegated User Access

For agents that need to act **on behalf of a user** with delegated permissions.
Combines the parent token exchange with a user assertion to produce a delegated
Graph token scoped to what that specific Agent Identity is allowed to do.

### Prerequisites

The Blueprint must be configured as an API (see "Blueprint API Configuration" below).
The Agent Identity must have `oauth2PermissionGrants` for the desired delegated scopes.

### 1. Get Parent Token (Same as Option B, Step 2)

```python
parent_token = get_parent_token(TENANT_ID, BLUEPRINT_APP_ID,
                                 SECRET_TEXT, AGENT_IDENTITY_APP_ID)
```

### 2. Get User Token (Targets Blueprint, NOT Graph)

```python
from azure.identity import InteractiveBrowserCredential

credential = InteractiveBrowserCredential(
    tenant_id=TENANT_ID,
    client_id=CLIENT_APP_ID,  # Your front-end or CLI app, NOT the Blueprint
    redirect_uri="http://localhost:8400",
)
# Scope MUST target the Blueprint as audience:
user_token = credential.get_token(f"api://{BLUEPRINT_APP_ID}/access_as_user")
```

> **Critical**: The user token audience must be `api://{blueprint_app_id}`, NOT
> `https://graph.microsoft.com`. If it targets Graph, the OBO exchange fails with
> `AADSTS50013: Assertion failed signature validation`.

### 3. OBO Exchange (Combines Parent + User Tokens)

```python
params = {
    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
    "client_id": AGENT_IDENTITY_APP_ID,
    "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    "client_assertion": parent_token,
    "assertion": user_token.token,
    "requested_token_use": "on_behalf_of",
    "scope": "https://graph.microsoft.com/.default",
}
data = urllib.parse.urlencode(params).encode("utf-8")
req = urllib.request.Request(
    TOKEN_URL.format(tenant=TENANT_ID), data=data,
    headers={"Content-Type": "application/x-www-form-urlencoded"},
)
with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())

obo_token = result["access_token"]
# This token has:
#   sub = Agent Identity's appId
#   scp = delegated permissions from oauth2PermissionGrants
```

### Blueprint API Configuration

The Blueprint must be configured as an OAuth2 API for the user token to
correctly target it. Apply this configuration once via `PATCH /applications/{id}`:

```python
import uuid

scope_id = str(uuid.uuid4())
patch = {
    "identifierUris": [f"api://{BLUEPRINT_APP_ID}"],
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
            "appId": CLIENT_APP_ID,
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
requests.patch(
    f"{GRAPH}/applications/{blueprint_obj_id}",
    headers=headers,
    json=patch,
)
```

All four elements are required:
1. **`identifierUris`** — enables `api://{appId}` audience
2. **`oauth2PermissionScopes`** — defines a scope users can consent to
3. **`preAuthorizedApplications`** — authorizes your client app (skips consent prompt)
4. **`optionalClaims`** — emits `idtyp` claim for token type validation

### Delegated Permission Grants

Each Agent Identity needs `oauth2PermissionGrants` specifying which Graph delegated
permissions it may exercise on behalf of users:

```python
from datetime import datetime, timedelta, timezone

expiry = (datetime.now(timezone.utc) + timedelta(days=3650)).strftime(
    "%Y-%m-%dT%H:%M:%SZ"
)

requests.post(
    f"{GRAPH}/oauth2PermissionGrants",
    headers=headers,
    json={
        "clientId": agent_sp_id,        # Agent Identity SP object ID
        "consentType": "AllPrincipals",
        "resourceId": graph_sp_id,       # Microsoft Graph SP object ID
        "scope": "User.Read Tasks.ReadWrite",  # Space-separated scopes
        "expiryTime": expiry,            # Required by beta API
    },
)
```

### Key Rules (OBO)

- **User token MUST target the Blueprint** (`api://{blueprint_app_id}/access_as_user`), NOT Graph
- **Use `/.default` scope** in the OBO exchange step — individual scopes fail
- **`expiryTime` is required** on beta API `oauth2PermissionGrants` (not required on v1.0)
- **Browser-based admin consent URLs do not work** for agent identities — use `oauth2PermissionGrants` API
- **`Group.ReadWrite.All`** cannot be granted as delegated permission to agent identities

---

## Cross-Tenant Token Exchange

The `fmi_path` exchange works cross-tenant when the Blueprint is multi-tenant
(`signInAudience: AzureADMultipleOrgs`). The critical rule is:

> **Step 1 (parent token) MUST target the Agent Identity's home tenant.**

```python
# Blueprint in Tenant A, Agent Identity in Tenant B

# CORRECT: Step 1 targets Agent Identity's tenant (Tenant B)
parent = get_parent_token(
    tenant_id=TENANT_B,
    blueprint_app_id=BLUEPRINT_APP_ID,
    blueprint_secret=SECRET,
    agent_identity_id=AGENT_ID,
)

# WRONG: Step 1 targets Blueprint's tenant (Tenant A) — AADSTS700211
parent = get_parent_token(
    tenant_id=TENANT_A,  # Wrong tenant!
    ...
)
```

This works because the Blueprint's multi-tenant SP authenticates to Tenant B,
producing a parent token with issuer `login.microsoftonline.com/{Tenant_B}/v2.0`,
which matches the Agent Identity's federation configuration. If step 1 targets
Tenant A instead, the issuer is wrong and step 2 fails.

Step 2 also targets the Agent Identity's tenant (Tenant B), using the correctly-issued parent token.
