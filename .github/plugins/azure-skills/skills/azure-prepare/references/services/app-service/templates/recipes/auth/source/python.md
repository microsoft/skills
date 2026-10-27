# Auth Recipe — Python (FastAPI) — REFERENCE ONLY

## JWT Validation with PyJWT

### Requirements

Add to `requirements.txt`:

```
PyJWT[crypto]>=2.14.0
cryptography
fastapi
uvicorn
```

### Token Validation Middleware

Add `auth.py`:

```python
import os
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient

security = HTTPBearer()
TENANT_ID = os.environ["AZURE_TENANT_ID"]
CLIENT_ID = os.environ["AZURE_CLIENT_ID"]
# Use APP_ID_URI if set (e.g., "api://<client-id>"); fall back to CLIENT_ID
AUDIENCE = os.environ.get("AZURE_APP_ID_URI", CLIENT_ID)
JWKS_URL = f"https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"

jwks_client = PyJWKClient(JWKS_URL)

async def validate_token(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(creds.credentials)
        payload = jwt.decode(
            creds.credentials,
            signing_key.key,
            algorithms=["RS256"],
            audience=AUDIENCE,
            issuer=f"https://login.microsoftonline.com/{TENANT_ID}/v2.0",
        )
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

> ⚠️ The `aud` claim in Entra ID tokens is often the Application ID URI (`api://<client-id>`), not the raw client ID. Set `AZURE_APP_ID_URI` in app settings to match your app registration's exposed API URI.

### Protected Endpoint

Add to `main.py`:

```python
from auth import validate_token

@app.get("/api/me")
async def me(user=Depends(validate_token)):
    return {"name": user.get("name"), "oid": user.get("oid")}
```

## App Settings Required

| Setting | Value |
|---------|-------|
| `AZURE_TENANT_ID` | Entra tenant ID |
| `AZURE_CLIENT_ID` | App registration client ID |
| `AZURE_APP_ID_URI` | Application ID URI (e.g., `api://<client-id>`) — optional, defaults to CLIENT_ID |

## Files to Modify

| File | Action |
|------|--------|
| `auth.py` | Create — JWT validation middleware |
| `main.py` | Modify — add protected endpoints |
| `requirements.txt` | Modify — add PyJWT, cryptography |
