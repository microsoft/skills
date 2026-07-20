# Foundry Tool Catalog — Project Connections for Remote Tools

Reference for wiring a **remote tool** (catalog tile or generic MCP server) into a Foundry project as a `RemoteTool` project connection, so a toolbox can attach to it.

> 🚦 **Toolbox creation gate:** before creating a toolbox/connection, you MUST read the boundary rules in [create-hosted.md → Toolbox creation boundary](../create-hosted.md#toolbox-creation-boundary) and follow them, then continue with the rest of this file.

Three catalog backends cooperate: the **asset-gallery** index discovers connectors, the Logic Apps **managedApis** GET supplies OAuth metadata, and the Logic Apps **apiOperations** GET supplies the operation list and input schemas. Skip these calls only for fully BYO `generic_mcp` servers — every catalog-MCP or connector-namespace flow needs all three.

> 📘 For the toolbox MCP endpoint, protocol, and testing, see [toolbox-reference.md](toolbox-reference.md).
> 📘 For prompt-agent MCP wiring (without a toolbox), see [tool-mcp.md](tools/prompt-agent/tool-mcp.md).

## When to use this reference

Use when the user mentions any of:

- *Build → Tools → Connect a tool* (any subtab — Configured, Catalog, Custom)
- "Tool connection", "Remote MCP", "Catalog tile", "Custom · Preview"
- A specific catalog tile (GitHub, Box, Pipedrive, monday.com, Microsoft Learn, …)
- `RemoteTool` connection, `gateway_connector`, `catalog_MCP`, `generic_mcp`
- **Connector Namespace** / managed MCP server (powered by the Connector Namespace)
- "Bring my own OAuth App" (BYO `client_id` + `client_secret`) for a catalog connector
- Discovering connector operations (`x-ms-operations` / Logic Apps `apiOperations`) or trigger support (`x-ms-trigger`) via the catalog APIs

Do **not** use for: non-tool connections (Azure OpenAI, AI Search account, Storage), or general toolbox CRUD beyond the attach-and-verify recipe below.

## Inputs to gather upfront

Before generating any PUT body, ask the user in one batched question for:

1. **Subscription id**
2. **Resource group**
3. **Cognitive Services account name** (the Foundry account)
4. **Project name** (under the account)
5. **Connection name** — lowercase, `[a-z0-9-]`, ≤ 24 chars (e.g. `box-1`, `gh-byo`)
6. **Tool scenario in plain language** — e.g. "list my files in Box", "create issues on GitHub". Map this onto operations from the connector's `apiOperations` catalog for `gateway_connector`, or onto the catalog MCP server's `tools/list` for `catalog_MCP` / BYO.
7. **Toolbox name** to attach into for verification (defaults to `default-tb`)
8. **Secrets** (BYO `clientId` / `clientSecret`, `CustomKeys` header value, …) — ask the user to **type these directly into the terminal**, never via tooling that echoes them

The caller's AAD `oid` / `tid` (needed only for the consent-link step) are auto-discovered via `az ad signed-in-user show --query id -o tsv` and `az account show --query tenantId -o tsv`. For a service-principal caller, use `az ad sp show --id <appId>` instead. These values can also be read from the `oid` / `tid` claims on the ARM bearer token; the gateway validates the caller principal owns them.

## ARM endpoint (shared by every variant)

```
PUT https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}
    /providers/Microsoft.CognitiveServices/accounts/{acct}
    /projects/{proj}/connections/{name}?api-version=2025-04-01-preview
```

### Preflight RBAC

Caller needs **Azure AI Developer** or **Cognitive Services Contributor** on the project scope. Run this before the first PUT to surface 403s early:

```pwsh
$oid = az ad signed-in-user show --query id -o tsv
$projId = "/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.CognitiveServices/accounts/$acct/projects/$proj"
az role assignment list --assignee $oid --scope $projId --all `
  --query "[?roleDefinitionName=='Azure AI Developer' || roleDefinitionName=='Cognitive Services Contributor'].roleDefinitionName" -o tsv
```

Empty output → caller lacks the required role; expect `403 AuthorizationFailed` on PUT until granted.

### Common request template

```pwsh
$tok = az account get-access-token --resource "https://management.azure.com" --query accessToken -o tsv
$h   = @{ Authorization = "Bearer $tok"; "Content-Type" = "application/json" }
$uri = "https://management.azure.com/subscriptions/$sub/resourceGroups/$rg/providers/Microsoft.CognitiveServices/accounts/$acct/projects/$proj/connections/${connName}?api-version=2025-04-01-preview"
Invoke-WebRequest -Method PUT -Headers $h -UseBasicParsing -Body $body -Uri $uri
```

### Body invariants

- `properties.target` is **required** for every `authType` (validation rejects empty). The exact value depends on the variant — see each body shape. For `gateway_connector` specifically, the literal string `"https://placeholder"` is the correct value on PUT #1 and is **rewritten by the platform on PUT #2** to the real gateway URL.
- `properties.group` is server-filled (`GenericProtocol` for `RemoteTool`).
- `properties.credentials` is scrubbed to `null` on GET.
- `properties.peRequirement` defaults to `"NotRequired"`.

Allowed `authType` for `category=RemoteTool` (per `api-version=2025-04-01-preview`):
`None, CustomKeys, OAuth2, ProjectManagedIdentity, DeveloperConnection, UserEntraToken, AgentUserImpersonation, AgenticIdentityToken, AgenticUser, UserTokenAndProjectManagedIdentity`. `ApiKey` is **rejected** for `RemoteTool`. The authoritative list is whatever the [Cognitive Services projects API reference](https://learn.microsoft.com/rest/api/aiservices/) returns for the current API version — if you hit `invalid_payload: unsupported authType`, re-check against the schema for the version you're calling.

## Decision tree

| User scenario | `authType` | `metadata.type` | Notes |
|---|---|---|---|
| Catalog tile tagged "Custom · Preview" (Box, Pipedrive, GitHub, Salesforce, Outlook, …) | `OAuth2` | `gateway_connector` | **Connector-namespace managed MCP.** Powered by the Connector Namespace in your Foundry account; the namespace handles OAuth, token storage, and per-user passthrough. Needs **two** PUTs plus `listConsentLinks` per caller (see [Gateway connector full flow](#gateway-connector-full-flow)). |
| Catalog MCP tile with Microsoft-managed OAuth (no `client_id` needed) | `OAuth2` | `catalog_MCP` | Foundry brokers the OAuth app for you. The Catalog API tile **prepopulates** `target` (server URL); `listConsentLinks` flow same as gateway. |
| Catalog MCP tile with **your own** OAuth App | `OAuth2` | (omit) | Supply your own `client_id` + `client_secret` + raw `authorizationUrl` / `tokenUrl` / `scopes`. Do **not** mix BYO `credentials` with `metadata.type=catalog_MCP`. See [BYO OAuth caveats](#byo-oauth-app-against-a-catalog-mcp-server). |
| Remote MCP, Azure-side identity (project MI calls the server) | `ProjectManagedIdentity` | `catalog_MCP` *(when listed)* or `generic_mcp` | For catalog-listed MCP servers, prefer `catalog_MCP` so `target` is prepopulated. Requires `audience` in `metadata`. See [PMI limitations](#projectmanagedidentity-limitations). |
| Remote MCP, static shared secret / header key | `CustomKeys` | `catalog_MCP` *(when listed)* or `generic_mcp` | Header **name and format** are NOT always `Authorization: Bearer ...`. Read the required header name from the Catalog API entry's `x-ms-connection-parameters` and use that exact name in `credentials.keys`. |
| Remote MCP, user's Entra token forwarded | `UserEntraToken` | `generic_mcp` | Per-user identity passthrough. Not supported when the agent is published to Teams. Pair with `metadata.audience` for the upstream resource URI. |
| Custom OpenAPI / A2A tool (no MCP) | varies | n/a | Use the Custom subtab shapes; outside the MCP toolbox path. See [Custom subtab — OpenAPI / A2A](#custom-subtab--openapi--a2a). |

## Catalog APIs — three backends, three calls

There are **three** read endpoints the portal hits to populate a connection form. Programmatic callers should use the same three.

### 1. Asset-gallery (Foundry's index)

```
POST https://eastus.api.azureml.ms/asset-gallery/v1.0/tools
Headers:
  Authorization: Bearer <token for https://management.azure.com>
  Content-Type: application/json
Body:
{
  "freeTextSearch": "*",
  "filters": [
    { "field": "entityContainerId", "operator": "eq",       "values": ["connectors-registry-prod-bl"] },
    { "field": "type",              "operator": "eq",       "values": ["tools"] },
    { "field": "annotations/name",  "operator": "contains", "values": ["<name>"] }
  ],
  "pageSize": 20
}
```

- **Catalog lives only in `eastus`.** `westus2.api.azureml.ms` returns `totalCount=0` for the same body. `entityId`s are portable across project regions.
- Use this **only to discover the connector's `entityId`** — pull `objectId` out of the returned `entityId` (e.g. `…/objectId/github`). That `objectId` is the `connectorName` you pass to PUTs and the next two catalog calls.
- The response is a **thin index**. `properties.remotes[]`, `xMsSecuritySchemes`, OAuth endpoints, scopes, and operation schemas are **not** included. Direct `GET /asset-gallery/v1.0/tools/{entityId}` returns 404. There is no expand/projection flag that surfaces these fields — fetch them from calls 2 and 3 below.

Two registries are indexed here — distinguished by `entityContainerId`:

| Registry | `entityContainerId` | Contents | Pair with |
|---|---|---|---|
| Public catalog | `connectors-registry-prod-bl` | Catalog connector definitions (GitHub, Box, Salesforce, …). | `metadata.type=catalog_MCP` or `gateway_connector` |
| Private MCP entries | `registry-prod-bl` | MCP-server entries used by the portal Connections UI (e.g. `github-mcp-server`). Sometimes carries a canonical MCP URL when the public-catalog row lacks `remotes[]`. | `metadata.type=catalog_MCP` |

Always query both when surfacing "available tools" to a user — the private MCP entries can fill gaps in the public catalog row.

### 2. Logic Apps **managedApis** — OAuth source-of-truth

```
GET https://management.azure.com/subscriptions/{sub}
    /providers/Microsoft.Web/locations/{region}/managedApis/{connectorName}
    ?api-version=2016-06-01
```

`connectorName` is the `objectId` from the asset-gallery `entityId`. Verified response shape for `github` (2026-05-21):

```jsonc
{
  "properties": {
    "displayName": "GitHub",
    "runtimeUrls": ["https://logic-apis-eastus.azure-apim.net/apim/github"],
    "connectionParameters": {
      "token": {
        "type": "oauthSetting",
        "oAuthSettings": {
          "identityProvider": "GitHub",
          "clientId": "faa5f56b825cbc649ae1",          // Microsoft's default OAuth-App id
          "scopes": ["repo","workflow","read:org","admin:org"],
          "redirectMode": "Direct",
          "redirectUrl": "https://logic-apis-eastus.consent.azure-apim.net/redirect"
        }
      }
    }
  }
}
```

**Raw `authorizationUrl` / `tokenUrl` are NOT in this response.** Logic Apps abstracts them via the `identityProvider` string and resolves them inside the gateway. For BYO you must map `identityProvider → endpoints` yourself. Known mappings:

| `identityProvider` | `authorizationUrl` | `tokenUrl` |
|---|---|---|
| `GitHub` | `https://github.com/login/oauth/authorize` | `https://github.com/login/oauth/access_token` |
| `Google` | `https://accounts.google.com/o/oauth2/v2/auth` | `https://oauth2.googleapis.com/token` |
| `Box` | `https://account.box.com/api/oauth2/authorize` | `https://api.box.com/oauth2/token` |
| `AzureActiveDirectory` / `aad3rdPartySNI` | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` | `https://login.microsoftonline.com/common/oauth2/v2.0/token` |

For `identityProvider` values not in this table (`dynamicscrmonlinecertificate`, `salesforce`, `dropbox`, `oauth2generic`, …), look the provider's well-known OAuth endpoints up in its developer docs — the catalog API does not surface them.

Use the `scopes` array from this response as the default scopes list. The catalog `clientId` is Microsoft's default OAuth App; replace it with your own only when going BYO.

Derive `authType` from `connectionParameters`:

- Any parameter with `type: oauthSetting` → `authType = OAuth2`.
- Else any parameter with `type: securestring` → `authType = CustomKeys`.
- Else → `authType = None` (anonymous) or `ProjectManagedIdentity` if the connector explicitly supports MI.

### 3. Logic Apps **apiOperations** — operation catalog (`gateway_connector` only)

For `gateway_connector` you need the list of operations the connector exposes plus each operation's parameter schema, because that's what gets serialized into `metadata.mcpserverConfigProperties` on PUT #2. Asset-gallery does not carry this.

```
GET https://management.azure.com/subscriptions/{sub}
    /providers/Microsoft.Web/locations/{region}/managedApis/{connectorName}
    /apiOperations?api-version=2016-06-01
```

Returns `value[]` of operations with `name`, `properties.summary` (display name), `properties.description`, `properties.annotation.family`, and `properties.visibility` (`important` / `advanced` / `internal`). Verified 2026-05-21: Box returns 14 operations including `ListRootFolder`, `ListFolder`, `GetFileMetadata`, `GetFileContent`, `DeleteFile`, `CreateFile`, plus several `On*` triggers (not agent-callable).

To get parameter schemas, fetch a single operation with `$expand=properties/inputsDefinition`:

```
GET .../managedApis/{connectorName}/apiOperations/{operationName}
    ?api-version=2016-06-01&$expand=properties/inputsDefinition
```

`properties.inputsDefinition` is a JSON-Schema-shaped object with `type:"object"`, `properties:{...}`, and `required:[...]`. Map each entry to one `agentParameters` entry:

| `inputsDefinition.properties[name]` field | → `agentParameters[].schema` field |
|---|---|
| `type` | `type` |
| `description` | `description` |
| `title` | `x-ms-summary` |
| `default` | `default` (omit if absent) |

If `inputsDefinition.properties` is empty / missing, the operation takes no arguments and `agentParameters` is `[]` (e.g. Box `ListRootFolder`).

Skip any operation whose `properties.isWebhook` or `isNotification` is `true` — these are Logic Apps triggers, not agent-callable actions.

**Picking ops from a plain-language scenario.** Match the user's words against `properties.summary` and `properties.description`, then prefer the simplest variant (fewest required parameters) and the one whose `annotation.family` aligns with the user intent. For Box "list my files", `ListRootFolder` (zero params) wins over `ListFolder` (requires `id`); if the user asks to list a specific folder, register both.

## Gateway connector full flow

For Catalog tiles tagged `Custom · Preview` (Box, Pipedrive, GitHub, Salesforce, Outlook, iManage Work, PDF4me, Qdrant, Medallia, Fulcrum, monday.com, SuperMCP, IA-Connect JML, iMIS, Huddo Boards, The Events Calendar, PUG Gamified Engagement, Nitro Sign Enterprise Verified, Soft1, Elfsquad Product Configurator, MintNFT, …).

### Step 1 — Discover

Query the asset-gallery (call #1) for the connector. Extract:

- `objectId` from `entityId` → `connectorName`
- Full `entityId` → `metadata.toolEntityId`

Then call managedApis (call #2) and apiOperations (call #3) for OAuth and operation metadata.

### Step 2 — PUT #1 (create connection)

Verbatim PUT body (captured from the portal's Box wizard, 2026-05-21):

```json
{
  "properties": {
    "authType": "OAuth2",
    "category": "RemoteTool",
    "target": "https://placeholder",
    "credentials": {},
    "connectorName": "box",
    "metadata": {
      "type": "gateway_connector",
      "toolEntityId": "azureml://location/eastus/apiCenter/connectors-registry-prod-bl/type/tools/objectId/box/version/1",
      "connectionproperties": "{\"connectorName\":\"box\"}"
    }
  }
}
```

Spelling traps (case-sensitive):

- `toolEntityId` — NOT `entityId`.
- `connectionproperties` — **lowercase**, value is a **stringified JSON object**, not a nested object. `"{\"connectorName\":\"box\"}"` is correct; `{"connectorName":"box"}` is rejected.
- `connectorName` appears at top-level under `properties` **and** inside `metadata` and inside `connectionproperties`.

`target = "https://placeholder"` is the **persisted value on PUT #1**, not a stub. There is no follow-up call that rewrites it before PUT #2. Runtime dispatch keys off `metadata.toolEntityId` + `metadata.connectionproperties.connectorName` + OAuth consent state. PUT #2 (register-actions) rewrites `target` to the real gateway URL `https://app-XX.<region>.logic.azure.com/api/connectorGateways/{envId}/mcpServerConfigs/{connectionName}/mcp`.

### Step 3 — Per-caller consent

For every distinct end-user (or service principal), call `listConsentLinks`:

```
POST .../connections/{name}/listConsentLinks?api-version=2025-04-01-preview
```

Verbatim portal body:

```json
{
  "parameters": [{
    "objectId":      "<caller AAD oid>",
    "parameterName": "token",
    "redirectUrl":   "https://ai.azure.com/nextgen/authConsentPopup",
    "tenantId":      "<caller AAD tid>"
  }]
}
```

Notes:

- The portal sends `redirectUrl=https://int.ai.azure.com/...` from the INT environment; for production (`ai.azure.com`) use `https://ai.azure.com/nextgen/authConsentPopup`. The redirect URL only gates which Foundry origin the OAuth popup closes back into — it does not affect what tokens are minted.
- Returns a per-user OAuth authorization URL (e.g. a `box.com/api/oauth2/authorize?...` link). User navigates → consents → gateway stores the token.
- Cross-tenant calls return `InvalidConsentLinkParameter` (`objectId` + `tenantId` must match the caller principal).

#### Consent link expiry (~1 hour)

Each `listConsentLinks` response mints a short-lived signed token (≈ 1 hour TTL based on `ExpirationTime` in the base64 payload). A `500` from the consent host when clicking the link is most often caused by an **expired or stale link**, not a server outage. Fix: call `listConsentLinks` again to get a fresh link and use it immediately. Do not reuse a link from a previous step or previous session.

#### Portal popup lifecycle (pending-true happy path)

The portal pre-opens a blank popup (`about:blank`) before calling `listConsentLinks`, then drives the flow as follows once the consent URL is in hand. Code-first callers should replicate this:

1. Register listeners on `window.postMessage` **and** `BroadcastChannel('connector-oauth-callback')` to receive completion signals.
2. Navigate the popup to the consent URL.
3. Poll `popup.closed` every 1 second to detect finish / dismiss.
4. When the popup closes, wait **500 ms** grace for any in-flight postMessage / BroadcastChannel messages.
5. If a `{ pending: true }` signal arrives (consent completed server-side but no authorization code returned to the opener):
   - Issue a **PUT** to the connection (same body as the original create PUT) to prompt the backend to finalise auth state.
   - If `overallStatus` is `Connected` in the response, done ✅.
   - Otherwise **poll `GET .../connections/{name}`** every 2 seconds, up to **15 attempts**, until `overallStatus` flips to `Connected`.
6. If **no signal** before popup close, treat as user-cancelled and surface an error.
7. **Cleanup:** remove listeners, clear polling, force-close the popup if still open.

The `{ pending: true }` path is the normal happy-path because the provider closes the popup by redirecting to `ai.azure.com/nextgen/authConsentPopup`, which has no JavaScript opener to post back to. **Don't assume consent is done just because the popup closed.** The "blank Foundry page" seen after authorising in a detached tab is this same redirect arriving without an opener — the gateway token is still stored; retry PUT #2 to confirm.

#### Consent-host hosts

Links served from `logic-apis-df.consent.azure-apim.net` are the **dogfood / INT** consent host (DF = dogfood). Production region traffic goes through `logic-apis-{region}.consent.azure-apim.net` (e.g. `logic-apis-eastus.consent.azure-apim.net`). Either host can return DF links depending on which Logic Apps environment the connector is deployed in; the caller cannot force the host.

#### Dogfood OAuth-app runtime allowlist trap

Some connectors (Spotify `spotifyip` confirmed) are backed by a **dogfood-env Microsoft OAuth app** registered in provider "development mode" with a hard-coded test-user allowlist. Consent + `Connected` status work fine code-first for any caller, but `tools/call` at runtime returns:

```json
{ "error": { "code": 403, "source": "...logic-df.azure-apihub.net",
  "innerError": "Check settings on https://developer.spotify.com/dashboard, the user may not be registered." } }
```

Detect by inspecting the consent URL's first 302: if the `redirect_uri` is `https://global-test.consent.azure-apim.net/redirect` (rather than `global.consent...`), the connector is on the dogfood OAuth app. **The connection will still go Connected and `tools/list` will work**; only the actual API invocation fails. Not fixable client-side; requires Microsoft to promote the app or add the caller's email to the provider-side allowlist.

```pwsh
$consentUrl = ($r.Content | ConvertFrom-Json).value[0].link
try { Invoke-WebRequest -Uri $consentUrl -MaximumRedirection 0 -ErrorAction Stop | Out-Null }
catch { $loc = $_.Exception.Response.Headers.Location.ToString() }
if ($loc -match 'global-test\.consent\.azure-apim\.net') {
  Write-Warning "Connector uses dogfood OAuth app; tools/call may 403 with 'user may not be registered' even after Connected."
}
```

### Step 4 — PUT #2 (register actions)

After OAuth, the portal issues a **second PUT** against the **same connection name** to register which connector operations the agent can invoke. **Without this PUT the runtime has no actions to dispatch even though `overallStatus` shows `Authenticated`.**

The body is identical to PUT #1 plus an additional `metadata.mcpserverConfigProperties` field (stringified JSON). Verbatim example for Box connection `box-5`:

```jsonc
{
  "properties": {
    "authType": "OAuth2",
    "category": "RemoteTool",
    "target": "https://placeholder",
    "credentials": {},
    "connectorName": "box",
    "metadata": {
      "type": "gateway_connector",
      "toolEntityId": "azureml://location/eastus/apiCenter/connectors-registry-prod-bl/type/tools/objectId/box/version/1",
      "connectionproperties": "{\"connectorName\":\"box\"}",
      "mcpserverConfigProperties": "{\"description\":\"\",\"state\":\"Enabled\",\"connectors\":[{\"name\":\"box\",\"connectionName\":\"box-5\",\"displayName\":\"box\",\"description\":\"\",\"operations\":[{\"name\":\"GetFileMetadata\",\"displayName\":\"Get file metadata using id\",\"description\":\"\",\"userParameters\":[],\"agentParameters\":[{\"name\":\"id\",\"schema\":{\"type\":\"string\",\"description\":\"The unique identifier of the file in Box.\",\"x-ms-summary\":\"File Id\"}}]}]}]}"
    }
  }
}
```

Decoded `mcpserverConfigProperties` schema:

```jsonc
{
  "description": "",
  "state": "Enabled",
  "connectors": [
    {
      "name":           "<connectorName>",       // same as properties.connectorName
      "connectionName": "<this connection name>",
      "displayName":    "<connectorName>",
      "description":    "",
      "operations": [
        {
          "name":            "<OperationId>",    // operation id from apiOperations
          "displayName":     "<friendly>",
          "description":     "",
          "userParameters":  [],                   // bound at connection time (rare for Custom·Preview)
          "agentParameters": [                     // parameters the agent fills at call time
            {
              "name": "<paramName>",
              "schema": {
                "type":         "string|number|boolean",
                "description":  "...",
                "x-ms-summary": "...",
                "default":      "..."              // optional
              }
            }
          ]
        }
      ]
    }
  ]
}
```

Each operation in `operations[]` corresponds 1:1 to one `apiOperations` entry; `agentParameters[].schema` is translated from `inputsDefinition.properties` per the mapping in [Catalog APIs §3](#3-logic-apps-apioperations--operation-catalog-gateway_connector-only).

The portal lets the user multi-select via checkboxes in the wizard's "Configure actions" page; the selection is serialized into this string. When the selection changes later, the portal **replaces `mcpserverConfigProperties` wholesale** — no merge. Your code must do the same: any time the agent-callable op list changes, re-run PUT #2 with the full new list.

### Step 5 — `overallStatus` flip semantics

Two independent conditions must BOTH be true for `overallStatus` to flip `Unauthenticated` → `Connected`:

1. **PUT #2 issued with non-empty `metadata.mcpserverConfigProperties`** (rewrites `target` to the real gateway URL; target rewrite is visible immediately on PUT #2 regardless of consent state).
2. **OAuth consent completed** (user followed the `listConsentLinks` URL and clicked Authorize). Gateway then stores the token.

Order-independent observations:

- PUT #2 before consent → `target` rewrites, status stays `Unauthenticated`.
- Consent before PUT #2 → status stays `Unauthenticated` until PUT #2 fires; PUT #2 then flips to `Connected` in the same response.

## Body shape — `OAuth2` + `catalog_MCP` (Microsoft-managed OAuth)

Use when the catalog entry is an MCP server and you accept Microsoft's managed OAuth App + consent flow (no BYO secret):

```json
{
  "properties": {
    "authType": "OAuth2",
    "category": "RemoteTool",
    "target": "https://api.githubcopilot.com/mcp",
    "credentials": {},
    "metadata": {
      "type": "catalog_MCP",
      "toolEntityId": "azureml://location/eastus/apiCenter/connectors-registry-prod-bl/type/tools/objectId/github/version/1"
    },
    "peRequirement": "NotRequired"
  }
}
```

For MCP URL discovery when `connectors-registry-prod-bl` lacks `remotes[]`, look up the peer entry in `registry-prod-bl` (e.g. `github-mcp-server`) — its asset-gallery row sometimes carries the canonical MCP URL. Consent uses the same `listConsentLinks` flow as gateway_connector.

## BYO OAuth App against a catalog MCP server

When the user has their own OAuth App (e.g. GitHub `https://github.com/organizations/<org>/settings/applications/<app-id>`) and wants the connection to mint tokens via *their* app instead of Microsoft's managed one. Verified shape, 2026-05-21:

```json
{
  "properties": {
    "authType": "OAuth2",
    "category": "RemoteTool",
    "target": "<MCP server URL>",
    "credentials": { "clientId": "<your client id>", "clientSecret": "<your client secret>" },
    "authorizationUrl": "https://github.com/login/oauth/authorize",
    "tokenUrl":         "https://github.com/login/oauth/access_token",
    "scopes":           ["repo","workflow","read:org","admin:org"],
    "peRequirement":    "NotRequired"
  }
}
```

### Filling the OAuth fields from the catalog APIs

1. **Find the connector `entityId`** — asset-gallery POST with `annotations/name contains <name>`. Pull `objectId` out of the returned `entityId`.
2. **Look up OAuth metadata** — `GET .../managedApis/<objectId>?api-version=2016-06-01`. From `properties.connectionParameters.token.oAuthSettings`:
   - `identityProvider` → look up `authorizationUrl` / `tokenUrl` in the mapping table in [Catalog APIs §2](#2-logic-apps-managedapis--oauth-source-of-truth).
   - `scopes` → use as the default scopes array (override only if the user explicitly needs different scopes).
3. **Supply your own `clientId` / `clientSecret`** in `credentials`. Do not reuse the catalog `clientId` from step 2 — that's Microsoft's managed OAuth App and you cannot mint with it.
4. **PUT** the body above.

### Hard rules verified by probe (2026-05-21)

- **`scopes` MUST be a JSON array.** A space-separated string returns `400 "Error when parsing request; unable to deserialize request body"`.
- **DO NOT send `useCustomConnector`.** It is ignored on input; server fills `false`.
- **DO NOT send `metadata.{type=catalog_MCP, toolEntityId, ...}`** for BYO. Those fields anchor the connection to the catalog's managed OAuth App and conflict with your supplied `credentials`.
- **DO NOT call `listConsentLinks`** for BYO — the gateway handles consent via the standard authorization_code flow using the server-filled `redirectUrl`. Calling `listConsentLinks` against a fresh BYO connection returns `404 AIGatewayConnectionNotFound`.

### Server-filled response fields

- `credentials` → `null` (scrubbed).
- `connectorName` → `<gatewayId>-<connectionName>` (your input ignored).
- `redirectUrl` → `https://global.consent.azure-apim.net/redirect/<32-hex>` — **the OAuth callback URL the provider (e.g. GitHub OAuth App) must allow-list**. Generated per-connection on first PUT. Two-pass flow:
  1. PUT with placeholder client_secret.
  2. Read `properties.redirectUrl` from the response.
  3. Register it as the "Authorization callback URL" on the OAuth App.
  4. PUT again with the real client_secret.

### Caveat: `api.githubcopilot.com/mcp` rejects BYO OAuth-App tokens

The GitHub Copilot MCP server requires GitHub-App-minted Copilot tokens (the `microsoft-foundry-agent-service` GitHub App). A token from a user OAuth App will be rejected at runtime even if the connection PUT is 200. For real BYO testing point `target` at a self-hosted GitHub MCP server, or use an OpenAPI tool against `api.github.com` instead.

## `ProjectManagedIdentity` Remote MCP

For MCP servers that accept Azure-side identity (the project's system MI calls the MCP server's bearer endpoint):

```json
{
  "properties": {
    "authType": "ProjectManagedIdentity",
    "category": "RemoteTool",
    "target": "<MCP server URL with required query string>",
    "metadata": { "type": "generic_mcp", "audience": "<upstream resource URI>" }
  }
}
```

For catalog-listed MCP servers, prefer `metadata.type = catalog_MCP` with `toolEntityId` so `target` is prepopulated. `audience` is **required for MI auth** — it tells Foundry which resource URI to request a token for. Read the required `audience` from the connector's catalog entry or its documentation (typical values: an app ID URI like `api://contoso-mcp`, or an Azure service resource ID like `https://cognitiveservices.azure.com`). If you omit `audience`, the MCP server rejects the call with 401.

### `ProjectManagedIdentity` limitations

Verified end-to-end against Azure Language `/language/mcp`, 2026-05-21:

1. **Forwarder drops the query string.** The connection `target`'s `?api-version=...` is **not** preserved on the upstream call. If the upstream MCP requires a query parameter, PMI fails with 401/404 even when RBAC is correct.
2. **Forwarder mints the wrong audience.** The MI token Foundry sends does not have `aud=https://cognitiveservices.azure.com` or `https://ai.azure.com`. Setting `properties.audience` on the connection is accepted but **does not** change what is minted.
3. Endpoints not on the trust list reject the forwarded MI token with `-32007 PERMISSION_DENIED "Cannot pass Microsoft token to untrusted MCP endpoint"` (e.g. `api.githubcopilot.com/mcp`). This is the expected security gate.

## `CustomKeys` Remote MCP

Static header(s) injected on every upstream call. Minimum body:

```json
{
  "properties": {
    "authType": "CustomKeys",
    "category": "RemoteTool",
    "target": "<MCP server URL>",
    "credentials": { "keys": { "Ocp-Apim-Subscription-Key": "<value>" } },
    "metadata": { "type": "generic_mcp" }
  }
}
```

Verified PUT 200 / GET 200 / DELETE 200 round-trip. The header name is **arbitrary** — it is forwarded as-is to the MCP server. Different connectors require different header shapes:

- GitHub PAT: `Authorization: Bearer <pat>` or `Authorization: token <pat>` — catalog dictates.
- API-key services: `x-api-key: <key>` or `Ocp-Apim-Subscription-Key: <key>`.
- Multi-header schemes: e.g. `X-Account-Id: <id>` + `X-Account-Secret: <secret>`.

Always read the canonical header set from the connector's `connectionParameters` (each `securestring` parameter names the header it maps to) before writing the `keys` block. **Do not default to `Authorization: Bearer`** — it's wrong for many connectors.

For catalog-listed servers, swap `metadata.type` to `catalog_MCP` and add `toolEntityId`.

## `UserEntraToken` Remote MCP

For MCP servers that consume the *caller's* Entra token directly. Body includes `metadata.audience` so the platform mints the correct token for the upstream:

```json
{
  "properties": {
    "authType": "UserEntraToken",
    "category": "RemoteTool",
    "target": "<MCP server URL>",
    "metadata": { "type": "generic_mcp", "audience": "<upstream resource URI>" }
  }
}
```

Not available when the agent is published to Teams (Teams agents use the project MI).

## Custom subtab — OpenAPI / A2A

Not catalog-driven — the user provides the spec themselves. Each Save in this subtab maps to a single PUT against the same connections endpoint:

| Tile | `authType` options | `target` | Notes |
|---|---|---|---|
| OpenAPI | `None`, `CustomKeys`, `ApiKey`, `OAuth2` | OpenAPI spec URL or upstream API base | Agent gets `tools[].openapi.auth.security_scheme.connection_id`. |
| A2A (Preview) | `None` / `CustomKeys` / `UserEntraToken` / `AAD` (mapped from UI) | A2A endpoint | `metadata.agentCardPath` default `/.well-known/agent-card.json`; agent gets `tools=[A2APreviewTool(project_connection_id=...)]`; runtime emits `a2a_preview_call` / `a2a_preview_call_output` events. |
| MCP | covered above | — | This tile is just a router to the catalog / BYO flows. |

## Toolbox attach — `gateway_connector` tool naming

Attach the same as `generic_mcp` — the tool block uses `type:"mcp"` and `project_connection_id` set to the **full ARM resource id** of the connection (NOT just the name):

```jsonc
{
  "tools": [{
    "type": "mcp",
    "server_label": "box5",
    "project_connection_id":
      "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{acct}/projects/{proj}/connections/{connName}"
  }]
}
```

`tools/list` returns one MCP tool per registered operation. Tool names follow the verified pattern (probed 2026-05-22 against Box):

```
<server_label>___<connectorName>_<OperationName>
```

Note `___` (**three** underscores) between `server_label` and the rest, then a **single** `_` between `connectorName` and operation name. Example for Box attached with `server_label="box5"`:

| `mcpserverConfigProperties` op | `tools/list` `name` | `description` |
|---|---|---|
| `ListRootFolder` | `box5___box_ListRootFolder` | `box - List files and folders in root folder` |
| `GetFileMetadata` | `box5___box_GetFileMetadata` | `box - Get file metadata using id` |

The MCP tool's `inputSchema` is exactly the JSON schema derived from `apiOperations/{op}?$expand=properties/inputsDefinition` (the `agentParameters[].schema` values, re-keyed by parameter name). For an operation with no agent parameters, `inputSchema` is `{"type":"object"}`.

Worked `tools/call` for "list my files in Box" — verified end-to-end:

```jsonc
POST {dp}/toolboxes/{tb}/mcp?api-version=v1
{
  "jsonrpc": "2.0", "id": 2, "method": "tools/call",
  "params": { "name": "box5___box_ListRootFolder", "arguments": {} }
}
→ 200
{
  "jsonrpc": "2.0", "id": 2,
  "result": {
    "content": [{ "type": "text", "text": "[]" }],
    "isError": false
  }
}
```

(`text` carries a JSON-stringified array of Box file/folder objects; empty `[]` means the root folder is empty.)

### `outlook` connector — verified end-to-end (2026-05-22)

Uses `identityProvider: oauth2generic` (MSA / consumers tenant). `connectorName = "outlook"`, `toolEntityId` objectId = `outlook`. `tools/call` response wraps in `{ "value": [...] }` (not a bare array like Box):

```jsonc
POST {dp}/toolboxes/{tb}/mcp?api-version=v1
{
  "jsonrpc": "2.0", "id": 2, "method": "tools/call",
  "params": { "name": "outlook-1___outlook_GetEmailsV2",
              "arguments": { "folderPath": "Inbox", "top": 3 } }
}
→ 200
{
  "jsonrpc": "2.0", "id": 2,
  "result": {
    "content": [{ "type": "text",
      "text": "{\n  \"value\": [\n    { \"Subject\": \"...\", \"From\": \"...\", ... }\n  ]\n}" }],
    "isError": false
  }
}
```

Operations registered for the test: `GetEmailsV2` (read emails with `folderPath` / `top` / `fetchOnlyUnread` agent parameters) and `SendEmailV2` (send with `emailMessage` object param containing required `To`, `Subject`, `Body`). `SendEmailV2`'s top-level schema is `object` — pass it as a single nested `agentParameters` entry; the gateway flattens into the Logic Apps `emailMessage` envelope internally. The follow-up PUT after popup close (pending-true path) immediately returned `overallStatus: Connected` without needing the GET poll loop — outlook's MSA consent round-trips are fast.

## Minimum attach + verify recipe

Verifying a fresh connection is the only toolbox operation in scope of this reference. Toolboxes are upserted implicitly by `POST /versions`; no separate container create is needed.

The `$dp` value below is the project's data-plane endpoint, in the same `{project_endpoint}` form used elsewhere in these references — `https://<account>.services.ai.azure.com/api/projects/<project>`. The host segment varies by Foundry account/region; read it from a non-`FOUNDRY_`-prefixed env var (see [toolbox-reference.md § Agent env contract](toolbox-reference.md#agent-env-contract)) rather than hardcoding. The bearer-token resource is `https://ai.azure.com`, NOT ARM.

```pwsh
# 0. Constants.
$dp   = $env:PROJECT_ENDPOINT   # https://<account>.services.ai.azure.com/api/projects/<project>
$tb   = "default-tb"
$lbl  = "box5"                  # becomes the "<label>___" prefix on tool names
$connId = "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<acct>/projects/<proj>/connections/<connName>"
$tok  = az account get-access-token --resource "https://ai.azure.com" --query accessToken -o tsv
$hdr  = @{ Authorization      = "Bearer $tok"
           "Content-Type"     = "application/json"
           Accept             = "application/json, text/event-stream" }

# 1. Create a toolbox version with the connection attached.
$body = @{ tools = @(@{
   type = "mcp"
   server_label = $lbl
   project_connection_id = $connId
}) } | ConvertTo-Json -Depth 6 -Compress
$v = Invoke-WebRequest -Method POST -Headers $hdr -UseBasicParsing -Body $body `
        -Uri "$dp/toolboxes/$tb/versions?api-version=v1"
$ver = ($v.Content | ConvertFrom-Json).version

# 2. Promote the new version to default. default_version MUST be a JSON STRING, not a number.
#    Use ${tb} to terminate the variable name unambiguously before the literal '?'.
Invoke-WebRequest -Method PATCH -Headers $hdr -UseBasicParsing `
   -Body (@{ default_version = "$ver" } | ConvertTo-Json) `
   -Uri "$dp/toolboxes/${tb}?api-version=v1" | Out-Null

# 3. tools/list → expect one entry per registered op, named "<server_label>___<connectorName>_<OpName>".
$req = '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
Invoke-WebRequest -Method POST -Headers $hdr -UseBasicParsing -Body $req `
   -Uri "$dp/toolboxes/$tb/mcp?api-version=v1"

# 4. tools/call → the prefixed name and arguments per inputSchema.
$call = @{ jsonrpc="2.0"; id=2; method="tools/call"; params=@{
   name="$lbl`___box_ListRootFolder"; arguments=@{} } } | ConvertTo-Json -Depth 5 -Compress
Invoke-WebRequest -Method POST -Headers $hdr -UseBasicParsing -Body $call `
   -Uri "$dp/toolboxes/$tb/mcp?api-version=v1"
```

The response body for `/mcp` is plain JSON (no SSE `data:` framing) despite the `text/event-stream` Accept.

## Required RBAC summary

| Operation | Role |
|---|---|
| PUT any connection above | **Azure AI Developer** on the project (or **Cognitive Services Contributor** on the account) |
| Drive OAuth consent (`gateway_connector`, `catalog_MCP` managed-OAuth) | The end-user themselves, signed in to the subscription's tenant |
| `ProjectManagedIdentity` against a Cognitive Services upstream | Project MI needs the upstream's data-plane role (e.g. `Cognitive Services Language Owner` for `/language/mcp`) |

## Pitfalls / common mistakes

- **Do not forget PUT #2 for `gateway_connector`** ([Step 4](#step-4--put-2-register-actions)). The first PUT + OAuth flips status to `Authenticated` but the runtime has no actions to dispatch until you PUT again with `metadata.mcpserverConfigProperties`.
- **Do not invent a "real" target URL** for the `gateway_connector` flow on PUT #1. `"https://placeholder"` is correct on PUT #1; PUT #2 rewrites it.
- **Do not mix BYO `credentials` with `metadata.type=catalog_MCP`** in the BYO body. They conflict; the server accepts the PUT but the runtime uses the catalog's managed app and ignores your secret — or fails with consent confusion.
- **Do not send `scopes` as a space-separated string** anywhere. Always an array.
- **Do not call `listConsentLinks` for BYO OAuth.** Use only for `gateway_connector` and managed-OAuth `catalog_MCP`.
- **Do not assume the asset-gallery search response contains OAuth metadata** — it does not. Always pair it with the Logic Apps `managedApis` GET (or hardcode the identityProvider mapping) to get `scopes` and to derive `authorizationUrl` / `tokenUrl`.
- **Use exact field spelling** for `gateway_connector`: `toolEntityId` (NOT `entityId`), `connectionproperties` (lowercase, stringified JSON).
- **Sign in to the subscription's tenant** before calling `listConsentLinks` — it validates the caller principal owns the supplied `objectId` + `tenantId`.
- **Toolbox PATCH `default_version` must be a JSON STRING**, not a number. Sending `{"default_version": 1}` returns `400 invalid_payload "requires an element of type 'String', but the target element has type 'Number'"`. Use `{"default_version": "1"}`.
- **`metadata.audience` is required for `ProjectManagedIdentity`.** Without it the MCP server returns 401.
- **Header names for `CustomKeys` come from the catalog**, not from a default `Authorization: Bearer` template.
- **`ApiKey` is rejected** for `category=RemoteTool`. Use `CustomKeys` for static secrets.
- **OAuth consent is per-user, per-connection, per-project.** Each new caller hits `CONSENT_REQUIRED` once (returned as a nested string code inside an outer `-32006` error) and must open the URL the toolbox returns.
- **`api.githubcopilot.com/mcp` rejects user OAuth-App tokens.** Use a self-hosted MCP or fall back to OpenAPI.
- **PMI forwarder drops `target` query strings and mints a fixed audience.** Setting `properties.audience` is accepted but does not change what is sent.
- **Network-secured Foundry** projects cannot use private-endpoint-only MCP servers — only public endpoints reachable from the Foundry data plane and the Connector Namespace.

## References

- [Tool Catalog](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog)
- [Toolbox (preview)](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox)
- [Private tools catalog](https://learn.microsoft.com/azure/foundry/agents/concepts/tool-catalog#private-tools-catalog)
- [Cognitive Services projects REST API](https://learn.microsoft.com/rest/api/aiservices/)
- [tool-mcp.md](tools/prompt-agent/tool-mcp.md) — prompt-agent MCP wiring (no toolbox)
- [toolbox-reference.md](toolbox-reference.md) — MCP endpoint, auth, testing, troubleshooting
- [agent-tools.md](tools/prompt-agent/agent-tools.md) — the agent-tools index
- [use-toolbox-in-hosted-agent.md](use-toolbox-in-hosted-agent.md) — wiring a toolbox into a hosted agent
