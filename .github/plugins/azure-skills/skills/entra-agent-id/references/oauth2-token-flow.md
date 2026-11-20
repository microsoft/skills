# OAuth2 Token Flow

Source: the Agent ID Setup Instructions page was retired from Learn (the URL now redirects to this repository's `entra-agent-id` skill). The token-flow model — Managed Identity + Workload Identity Federation for production, client secret for local dev — is re-verified against the [Agent ID FAQ](https://learn.microsoft.com/en-us/entra/agent-id/faq) and [best-practices guide](https://learn.microsoft.com/en-us/entra/agent-id/best-practices-agent-id).

Agent Identities authenticate at runtime using credentials configured on the **Blueprint** (not on the Agent Identity — Agent Identities cannot hold credentials).

| Option | Use case | Credential type |
|--------|----------|-----------------|
| **Managed Identity + WIF** | Production (Azure-hosted) | Federated Identity Credential on Blueprint |
| **Client secret** | Local dev / testing | Password credential on Blueprint |

Both options feed the two-step `fmi_path` exchange in [runtime-token-exchange.md](runtime-token-exchange.md).

---

## Option A: Managed Identity + Workload Identity Federation (Production)

### 1. Set the Application ID URI on the Blueprint

```python
requests.patch(
    f"{GRAPH}/applications/{blueprint_obj_id}",
    headers=headers,
    json={"identifierUris": [f"api://{blueprint_app_id}"]},
).raise_for_status()
```

### 2. Create a Federated Identity Credential on the Blueprint

Use the typed path — FICs go on the Blueprint, not on the Agent Identity SP:

```python
fic_body = {
    "name": "my-fic-name",
    "issuer": f"https://login.microsoftonline.com/{tenant_id}/v2.0",
    "subject": mi_principal_id,   # The MI's object ID (principalId), NOT client ID
    "audiences": ["api://AzureADTokenExchange"],
}
requests.post(
    f"{GRAPH}/applications/{blueprint_obj_id}"
    f"/microsoft.graph.agentIdentityBlueprint/federatedIdentityCredentials",
    headers=headers, json=fic_body,
).raise_for_status()
```

### 3. Acquire a token from the caller

```python
from azure.identity import ManagedIdentityCredential

cred = ManagedIdentityCredential(client_id=MI_CLIENT_ID)
token = cred.get_token(f"api://{blueprint_app_id}/.default")
# Authorization: Bearer {token.token}
```

### 4. Validate on the backend

```python
import jwt
from jwt import PyJWKClient

jwks_client = PyJWKClient(
    f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
)
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

- **FICs go on the Blueprint** using the typed path (`.../microsoft.graph.agentIdentityBlueprint/federatedIdentityCredentials`).
- **`subject`** is the MI's `principalId` (object ID), not its client ID.
- **`audiences`** must be `["api://AzureADTokenExchange"]` — not your API audience.
- **FIC `issuer`**: `https://login.microsoftonline.com/{tenant}/v2.0`.
- **Token `issuer`** for validation: `https://sts.windows.net/{tenant}/` (different domain, trailing slash).

---

## Option B: Client Secret (Local Dev)

### 1. Add a password credential to the Blueprint

PowerShell:

```powershell
$body = @{
    "passwordCredential" = @{
        "displayName" = "Dev Secret"
        "endDateTime" = "2027-01-01T00:00:00Z"
    }
}

$credential = Invoke-MgGraphRequest -Method POST `
    -Uri "https://graph.microsoft.com/v1.0/applications/<BLUEPRINT_OBJECT_ID>/addPassword" `
    -Headers @{ "OData-Version" = "4.0"; "Content-Type" = "application/json" } `
    -Body ($body | ConvertTo-Json -Depth 5) -OutputType PSObject

$credential.secretText   # Save NOW — not retrievable later
```

Python:

```python
resp = requests.post(
    f"{GRAPH}/applications/{blueprint_obj_id}/addPassword",
    headers=headers,
    json={"passwordCredential": {
        "displayName": "Dev Secret",
        "endDateTime": "2027-01-01T00:00:00Z",
    }},
)
resp.raise_for_status()
secret_text = resp.json()["secretText"]   # Save NOW
```

### 2. Drive the two-step exchange

Pass `blueprint_secret=secret_text` into `get_parent_token(...)` from
[runtime-token-exchange.md](runtime-token-exchange.md), then call `exchange_autonomous` or `exchange_obo`.

### Key Rules (Client Secret)

- **Save `secretText` immediately** — it can't be retrieved later.
- **Secrets belong on the Blueprint only** — Agent Identities can't have password credentials (`PropertyNotCompatibleWithAgentIdentity`).
- **Not for production** — use MI + WIF.
- **Respect org credential-lifetime policy** when setting `endDateTime`.
- Don't use `DefaultAzureCredential` to acquire Blueprint tokens — Azure CLI tokens carry `Directory.AccessAsUser.All` and are rejected. Use `ClientSecretCredential` or the raw HTTP exchange.
