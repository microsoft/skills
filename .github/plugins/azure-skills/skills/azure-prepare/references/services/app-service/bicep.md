# App Service Bicep Patterns

## Linux vs Windows

> ⚠️ **Warning:** `linuxFxVersion` and `reserved: true` are **Linux-only** properties. Setting `linuxFxVersion` on a Windows App Service Plan causes a deployment error: `LinuxFxVersion cannot be set for non-Linux App Service plans`. Omit both for Windows plans.

| Property | Linux | Windows |
|----------|-------|---------|
| Plan `reserved` | `true` | omit (defaults to `false`) |
| Site `kind` | `'app,linux'` | `'app'` |
| Site `linuxFxVersion` | e.g. `'NODE\|20-lts'` | omit |
| Site `WEBSITE_NODE_DEFAULT_VERSION` | omit | e.g. `'~20'` |

> 💡 **Tip:** When both frontend and API use Node.js, prefer a **single Linux App Service Plan** for both. This avoids mixed-platform complexity and keeps all services on one plan.

## Linux App Service (Recommended for Node.js)

> ⚠️ **REQUIRED: `azd-service-name` tag** — The `tags` property MUST include `union(tags, { 'azd-service-name': serviceName })` so that `azd deploy` can locate the resource. Without this tag, `azd deploy` fails with `resource not found: unable to find a resource tagged with 'azd-service-name: web'`.

```bicep
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${resourcePrefix}-plan-${uniqueHash}'
  location: location
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true  // Required for Linux
  }
}

resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  kind: 'app,linux'
  tags: union(tags, { 'azd-service-name': serviceName })  // REQUIRED for azd deploy
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts'
      alwaysOn: true
      healthCheckPath: '/health'
      appSettings: [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'  // Required for source-based Node.js deploys (azd deploy)
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
      ]
    }
    httpsOnly: true
  }
  identity: {
    type: 'SystemAssigned'
  }
}
```

## Windows App Service

Use when the runtime requires Windows (e.g. .NET Framework) or when explicitly requested.

```bicep
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${resourcePrefix}-plan-${uniqueHash}'
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  // Do NOT set reserved: true for Windows
}

resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  kind: 'app'
  tags: union(tags, { 'azd-service-name': serviceName })  // REQUIRED for azd deploy
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      // Do NOT set linuxFxVersion for Windows plans
      alwaysOn: true
      healthCheckPath: '/health'
      appSettings: [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'  // Required for source-based Node.js deploys (azd deploy)
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
      ]
    }
    httpsOnly: true
  }
  identity: {
    type: 'SystemAssigned'
  }
}
```

## Node.js Build Configuration

> ⚠️ **Warning:** For source-based Node.js deployments to App Service (e.g. `azd deploy`), you **must** set `SCM_DO_BUILD_DURING_DEPLOYMENT=true` so App Service runs `npm install` during deployment. Without this, the app fails at runtime with `Cannot find module` errors.

This setting is already included in both the Linux and Windows examples above.

## Key Vault Integration

Reference secrets from Key Vault:

```bicep
appSettings: [
  {
    name: 'DATABASE_URL'
    value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=database-url)'
  }
]
```
