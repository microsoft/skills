# OAuth2 Token Flow

Source: the Agent ID Setup Instructions page was retired from Learn (the URL now redirects to this repository's `entra-agent-id` skill). The token-flow model — Managed Identity + Workload Identity Federation for production, client secret for local dev — is re-verified against the [Agent ID FAQ](https://learn.microsoft.com/en-us/entra/agent-id/faq) and [best-practices guide](https://learn.microsoft.com/en-us/entra/agent-id/best-practices-agent-id).

Agent Identities authenticate at runtime using credentials configured on the **Blueprint** (not the Agent Identity itself). Two options are available:

| Option | Use case | Credential type |
|--------|----------|-----------------|
| **Managed Identity + WIF** | Production (Azure-hosted) | Federated Identity Credential |
| **Client secret** | Local development / testing | Password credential on Blueprint |

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

## Option B: Client Secret (Local Development / Testing Only)

For local development where no Managed Identity is available.

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

### 2. Acquire Token Locally

```python
from azure.identity import ClientSecretCredential

credential = ClientSecretCredential(
    tenant_id=TENANT_ID,
    client_id=BLUEPRINT_APP_ID,       # Blueprint's appId
    client_secret=SECRET_TEXT,         # From step 1
)
token = credential.get_token(f"api://{BLUEPRINT_APP_ID}/.default")
```

### Key Rules (Client Secret)

- **Save `secretText` immediately** — it cannot be retrieved after creation.
- **Secrets belong on the Blueprint only** — agent identities cannot have password credentials (`PropertyNotCompatibleWithAgentIdentity`).
- **NOT for production** — use Managed Identity + WIF in production.
- **Respect org policy** — if `endDateTime` exceeds your tenant's credential lifetime policy, reduce it.
- **Use `ClientSecretCredential`**, not `DefaultAzureCredential`. Azure CLI tokens contain `Directory.AccessAsUser.All` which is rejected by Agent ID APIs.
