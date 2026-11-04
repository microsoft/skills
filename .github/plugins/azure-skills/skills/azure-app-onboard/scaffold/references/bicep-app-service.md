# Bicep — App Service Patterns

App Service-specific Bicep patterns. For shared patterns (skeleton, naming, tags, security defaults, data modules), see [bicep-patterns.md](bicep-patterns.md).

## Module Template

Standard App Service module with managed identity and SCM/FTP auth disabled. Use this as the base for ALL App Service resources.

```bicep
param location string
param tags object
param appServicePlanId string
param appServiceName string

resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: appServiceName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
    }
  }
}

// SCM basic auth — enabled in IaC for deploy convenience. Deploy phase re-disables via REST API after code upload.
resource scmAuth 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2023-12-01' = {
  parent: appService
  name: 'scm'
  properties: {
    allow: true
  }
}

// ⛔ MANDATORY — disable FTP basic auth
resource ftpAuth 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2023-12-01' = {
  parent: appService
  name: 'ftp'
  properties: {
    allow: false
  }
}

output appServiceId string = appService.id
output principalId string = appService.identity.principalId
```

> ⛔ **Every App Service module MUST include:** (1) `identity: { type: 'SystemAssigned' }`, (2) `scm` basicPublishingCredentialsPolicies with `allow: true` (IaC sets enabled for deploy convenience — deploy phase re-disables via REST API after code upload), (3) `ftp` basicPublishingCredentialsPolicies with `allow: false`. Missing any of these → self-review L1 `FLAGGED`.

> ⛔ **PHP runtime:** set `linuxFxVersion` by the PHP security row in [dockerfile-generation.md](dockerfile-generation.md) (e.g. `PHP|8.3` when the app's constraints allow 8.3). Branches 8.1 and older no longer receive the PHP2Shell security fixes.

## Native Module Deploy Strategy

When `prepare-plan.json.deployStrategy` exists with `codeDeployPattern: "startup-install"`, apply these patterns to the App Service Bicep:

```bicep
resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: appServiceName
  location: location
  tags: tags
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|${nodeVersion}' // ⛔ Use exact version tag (18-lts, 20-lts) — NEVER tilde (~18). Tilde works for WEBSITE_NODE_DEFAULT_VERSION but NOT linuxFxVersion.
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      // Startup command: Oryx build is primary, this is the safety-net fallback.
      // Runs npm install only if node_modules doesn't exist (Oryx missed it).
      // MUST be inline — never a .sh file (Windows CRLF → bash exit code 2).
      appCommandLine: '${deployStrategy.startupCommand}'
      appSettings: [
        // Primary: tell Oryx to run npm install during zip deploy
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        { name: 'ENABLE_ORYX_BUILD', value: 'true' }
        // Extended timeout for native module compilation (max 1800, default 230)
        { name: 'WEBSITES_CONTAINER_START_TIME_LIMIT', value: '1800' }
        // App-specific settings
        { name: 'NODE_ENV', value: 'production' }
      ]
    }
  }
}
```

**Rules:**
- ⛔ **Inline `appCommandLine` only** — never generate a `.sh` startup script file. Files created on Windows have CRLF line endings → bash exit code 2 on Linux
- ⛔ **Entry point from manifest** — read `package.json.scripts.start` or `.main`, never hardcode `index.js`
- ⛔ **`WEBSITES_CONTAINER_START_TIME_LIMIT` = 1800** (the maximum). Native compilation takes 2-5 min; Python with scipy can take longer
- When `deployStrategy` is absent (no native modules), do NOT set `appCommandLine` — let Oryx use its default startup
- ⛔ **Never prefix startup with `cd /home/site/wwwroot`** — Oryx extracts build output to a temp directory and sets the working directory automatically. Hardcoding `cd /home/site/wwwroot` causes `MODULE_NOT_FOUND` / `Could not import` because the app files aren't there

**Self-review check (L2 Pattern):** If `hasNativeModules == true`, verify Bicep has BOTH `appCommandLine` and `WEBSITES_CONTAINER_START_TIME_LIMIT`. If `prereq-output.json.initCommands[]` has `required: true` entries, verify `appCommandLine` includes them before the app start command. **FLAGGED** if either check fails.

## F1/D1 Free Tier — No Managed Identity

> ⛔ **F1/D1 does NOT support managed identity** (causes OOM / deployment failure). When the plan SKU is F1 or D1:
> - **Omit** `identity: { type: 'SystemAssigned' }` from the App Service resource
> - **Do NOT use** `@Microsoft.KeyVault()` in app settings — KV references require managed identity
> - **Instead:** Pass secrets as `@secure()` params from the KV module's `@secure()` output. The KV module generates the secret value and outputs it securely; main.bicep passes it to the App Service module as a `@secure() param`
> - **Do NOT output** `principalId` — it doesn't exist without identity

## Identity Output — SystemAssigned vs UserAssigned

> ⛔ **`appService.identity.principalId` only exists for `SystemAssigned` identity.** When using `UserAssigned`, output the managed identity MODULE's `principalId` instead — `identity.principalId` is undefined and causes `DeploymentOutputEvaluationFailed`. F1/D1 App Service: no identity (OOM), so no principalId output.
