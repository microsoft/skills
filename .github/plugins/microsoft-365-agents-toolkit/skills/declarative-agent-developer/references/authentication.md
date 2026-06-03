# OAuth Authentication for M365 Agent Plugins

This guide explains how to configure OAuth authentication for MCP server plugins and API plugins in your M365 Copilot agent. It covers endpoint discovery, credential acquisition, PKCE, and the `oauth/register` lifecycle step in `m365agents.yml`.

> **When to use this guide:**
> - Your MCP server requires OAuth authentication (most third-party MCP servers do)
> - Your API plugin requires OAuth (not just API key auth)
> - You need to register OAuth credentials in the Teams Developer Portal via ATK

> **When NOT to use this guide:**
> - The MCP server or API is unauthenticated → use `"auth": {"type": "None"}` directly
> - You're using API key authentication → handle via environment variables in the OpenAPI spec

---

## Overview

Authenticated plugins use a three-part setup:

1. **Discover** OAuth endpoints from the server's well-known metadata
2. **Obtain** client credentials (via Dynamic Client Registration or manual entry)
3. **Register** the OAuth configuration in `m365agents.yml` so ATK provisions it in the Teams Developer Portal

The result is a `<PREFIX>_MCP_AUTH_ID` environment variable that the plugin manifest references via `OAuthPluginVault`.

---

## Step 1: OAuth Endpoint Discovery

Attempt to auto-discover OAuth endpoints from the server's well-known metadata. Try **both** URLs in parallel:

```
GET <SERVER_ROOT>/.well-known/oauth-authorization-server
GET <SERVER_ROOT>/.well-known/openid-configuration
```

Where `<SERVER_ROOT>` is the scheme + host of the server URL (e.g., `https://mcp.example.com`).

### Field Mapping

| Plugin field | Well-known field |
|---|---|
| `authorizationUrl` | `authorization_endpoint` |
| `tokenUrl` | `token_endpoint` |
| `refreshUrl` | `token_endpoint` (same endpoint handles refresh grants) |
| `scope` | `scopes_supported` → join with comma (e.g., `"openid,email,profile"`). If no scopes are discovered or provided, default to `"openid"`. **If `scope` has no value, it MUST be quoted as `""`** — a bare `scope:` with no value is YAML null, not an empty string, and will fail schema validation. |

### If discovered

Show the values to the user and confirm:

> "I found the following OAuth endpoints for [name]. Shall I use these?
> - Authorization URL: ...
> - Token URL: ...
> - Refresh URL: ...
> - Scopes: ..."

### If not discovered

Ask the user to provide the four values. If the user doesn't have them, offer:

> "I can search for these values online — shall I proceed?"

Only search if the user confirms. Show results and confirm before using.

---

## Step 2: Client Credentials

### Dynamic Client Registration (DCR)

First, check if `registration_endpoint` is present in the well-known metadata from Step 1.

**If `registration_endpoint` is present → attempt DCR automatically:**

```bash
curl -s -X POST <registration_endpoint> \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "<display name> M365 Connector",
    "redirect_uris": ["https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "client_secret_basic",
    "scope": "<discovered scopes>"
  }'
```

- If the response contains `client_id` and `client_secret` → use them directly. Tell the user credentials were obtained via dynamic registration. **Do NOT ask the user for credentials.**
- If DCR returns an error or no `client_secret` → fall through to manual entry below.

### Manual Credential Entry

**If `registration_endpoint` is absent OR DCR fails → ask the user:**

> "Please provide your OAuth client credentials for [name]:
> - Client ID:
> - Client Secret:"

### PKCE

After obtaining credentials (whether via DCR or manual entry), ask the user:

> "Would you like to enable PKCE (Proof Key for Code Exchange) for this connector? (yes/no)"

- If the user says yes → `isPKCEEnabled: true`
- If the user says no, or asks you to decide → `isPKCEEnabled: false`

### ⛔ Security Rules

- **NEVER** print, display, or reveal access tokens, bearer tokens, or client secrets in your output
- **NEVER** write secrets to any file — they are passed as OS environment variables at provision time only
- Treat `client_secret` as sensitive — store it only in `.env.*.user` files (which are gitignored)

---

## Step 3: Register in `m365agents.yml` and `m365agents.local.yml`

**⛔ CRITICAL:** You MUST add the `oauth/register` step to BOTH `m365agents.yml` AND `m365agents.local.yml`. Both files need identical `oauth/register` blocks — if you only update one, authentication will fail in that environment.

Add the `oauth/register` step to the `provision` lifecycle in both files, after `teamsApp/create` and before `teamsApp/zipAppPackage`:

```yaml
provision:
  - uses: teamsApp/create
    with:
      name: <app-name>${{APP_NAME_SUFFIX}}
    writeToEnvironmentFile:
      teamsAppId: TEAMS_APP_ID

  - uses: oauth/register
    with:
      name: <slug>-oauth
      appId: ${{TEAMS_APP_ID}}
      clientId: ${{<PREFIX>_MCP_CLIENT_ID}}
      clientSecret: ${{<PREFIX>_MCP_CLIENT_SECRET}}
      authorizationUrl: <authorizationUrl>
      tokenUrl: <tokenUrl>
      refreshUrl: <refreshUrl>
      scope: <comma-separated-scopes or "openid" if none provided>
      # ⚠️ If scope has no value, use `scope: ""` (quoted empty string).
      # A bare `scope:` is YAML null and will fail schema validation.
      flow: authorizationCode
      identityProvider: Custom
      isPKCEEnabled: <true or false>
      tokenExchangeMethodType: PostRequestBody
      baseUrl: <SERVER_URL>
    writeToEnvironmentFile:
      configurationId: <PREFIX>_MCP_AUTH_ID

  - uses: teamsApp/zipAppPackage
    with:
      manifestPath: ./appPackage/manifest.json
      outputZipPath: ./appPackage/build/appPackage.zip
      outputFolder: ./appPackage/build

  - uses: teamsApp/update
    with:
      appPackagePath: ./appPackage/build/appPackage.zip
```

### Naming Conventions

| Value | Derivation | Example |
|---|---|---|
| `<PREFIX>` | Uppercase slug, hyphens/spaces → underscores | `CANVA_V1`, `HUBSPOT` |
| `<slug>` | Display name lowercased, spaces → hyphens | `canva-v1`, `hubspot` |
| `name` in oauth/register | `<slug>-oauth` | `canva-v1-oauth` |
| `<PREFIX>_MCP_CLIENT_ID` | Client ID env var | `CANVA_V1_MCP_CLIENT_ID` |
| `<PREFIX>_MCP_CLIENT_SECRET` | Client secret env var | `CANVA_V1_MCP_CLIENT_SECRET` |
| `<PREFIX>_MCP_AUTH_ID` | Auth config ID (written by provision) | `CANVA_V1_MCP_AUTH_ID` |

### Environment Files

**`env/.env.dev`** (committed, no secrets):
```
TEAMS_APP_ID=
<PREFIX>_MCP_AUTH_ID=
APP_NAME_SUFFIX=-dev
TEAMSFX_ENV=dev
```

**`env/.env.dev.user`** (gitignored, contains secrets):
```
<PREFIX>_MCP_CLIENT_ID=<client_id>
<PREFIX>_MCP_CLIENT_SECRET=<client_secret>
```

> **Important:** Add `<PREFIX>_MCP_AUTH_ID=` to `.env.dev` as soon as you detect the server requires OAuth — before running provision. The `oauth/register` step will populate its value during provisioning.
>
> **⛔ NEVER set a placeholder value** for `<PREFIX>_MCP_AUTH_ID` (e.g., `PLACEHOLDER`, `TODO`, `temp`). Leave it empty (`<PREFIX>_MCP_AUTH_ID=`). The `oauth/register` automation will write the real value during provisioning. If a placeholder is present, it will be treated as the actual value and will NOT be overwritten.

---

## Step 4: Plugin Manifest Auth Block

In the plugin manifest's `runtimes[]` entry, reference the registered OAuth configuration:

### Authenticated (OAuthPluginVault)

```json
{
  "type": "RemoteMCPServer",
  "auth": {
    "type": "OAuthPluginVault",
    "reference_id": "${{<PREFIX>_MCP_AUTH_ID}}"
  },
  "spec": {
    "url": "<SERVER_URL>",
    "mcp_tool_description": {
      "tools": [ ... ]
    }
  },
  "run_for_functions": [ ... ]
}
```

### Unauthenticated (None)

```json
{
  "type": "RemoteMCPServer",
  "auth": {
    "type": "None"
  },
  "spec": {
    "url": "<SERVER_URL>",
    "mcp_tool_description": {
      "tools": [ ... ]
    }
  },
  "run_for_functions": [ ... ]
}
```

---

## Decision Tree

Use this decision tree to determine the authentication flow:

```
MCP server URL provided
│
├── Probe /.well-known/oauth-authorization-server
│   AND /.well-known/openid-configuration
│
├── OAuth metadata found?
│   ├── YES → Step 1 (map endpoints) → Step 2 (DCR or manual creds) → Step 3 (oauth/register) → Step 4 (OAuthPluginVault)
│   └── NO → Use "auth": {"type": "None"} — skip Steps 1-3
│
└── For API plugins: same flow applies — add oauth/register to m365agents.yml if OAuth is needed
```

---

## Common Issues

| Issue | Solution |
|---|---|
| `registration_endpoint` returns 404 | DCR not supported — ask user for credentials manually |
| Token refresh fails | Verify `refreshUrl` matches `token_endpoint` from well-known metadata |
| `<PREFIX>_MCP_AUTH_ID` empty after provision | Check that `oauth/register` step is in `m365agents.yml` and credentials are correct |
| "Invalid redirect URI" during OAuth | Ensure redirect URI is exactly `https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect` |
| PKCE errors | Some providers don't support PKCE — set `isPKCEEnabled: false` |
