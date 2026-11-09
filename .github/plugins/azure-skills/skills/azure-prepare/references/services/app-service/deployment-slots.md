# App Service Deployment Slots

Zero-downtime deployments using staging slots.

## Basic Staging Slot

```bicep
resource stagingSlot 'Microsoft.Web/sites/slots@2022-09-01' = {
  parent: webApp
  name: 'staging'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
  }
}
```

## Slot Requirements — App Service

| SKU Tier | Slots Supported |
|----------|-----------------|
| Free/Shared | 0 |
| Basic | 0 |
| Standard | 5 |
| Premium | 20 |

## Slot Requirements — Azure Functions

> ⚠️ Slot support for Azure Functions varies by OS and hosting plan.

| Hosting Plan | OS | Slots Supported |
|---|---|---|
| Flex Consumption (FC1) | Linux | ❌ 0 |
| Consumption (Y1) | **Windows** | ✅ 1 staging slot |
| Consumption (Y1) | Linux | ❌ 0 |
| Elastic Premium (EP1-EP3) | Windows or Linux | ✅ 20 slots |
| Dedicated (Standard+) | Windows or Linux | ✅ 5–20 slots |

> 💡 **For Azure Functions requiring deployment slots:**
> - **Windows Consumption (Y1) supports 1 staging slot** — this is a supported platform capability.
>   If you need it, use it. See the Bicep example below.
> - Recommendation for new projects: prefer **Elastic Premium (EP1+)** (no cold starts, VNet integration)
>   or a **Dedicated plan (Standard+)**. Y1 cold starts can affect slot swap warm-up reliability.
> - **Linux Consumption and Flex Consumption do not support deployment slots.**

### Windows Consumption Function App with Staging Slot (Bicep)

```bicep
resource functionAppPlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${resourcePrefix}-funcplan-${uniqueHash}'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  // No 'reserved: true' — Windows Consumption
}

resource functionApp 'Microsoft.Web/sites@2022-09-01' = {
  name: '${resourcePrefix}-${serviceName}-${uniqueHash}'
  location: location
  kind: 'functionapp'  // Windows (no 'linux' suffix)
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: functionAppPlan.id
    httpsOnly: true
    siteConfig: {
      appSettings: [
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value}' }
        { name: 'WEBSITE_CONTENTSHARE', value: '${toLower(serviceName)}-prod' }
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value}' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: applicationInsights.properties.ConnectionString }
      ]
    }
  }
}

// Staging slot — only 1 staging slot supported on Consumption
resource stagingSlot 'Microsoft.Web/sites/slots@2022-09-01' = {
  parent: functionApp
  name: 'staging'
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: functionAppPlan.id
    siteConfig: {
      appSettings: [
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value}' }
        { name: 'WEBSITE_CONTENTSHARE', value: '${toLower(serviceName)}-staging' }  // MUST differ from production
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value}' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: applicationInsights.properties.ConnectionString }
      ]
    }
  }
}
```

> ⚠️ `WEBSITE_CONTENTSHARE` **must be unique per slot** on Windows Consumption — each slot needs its own file share.
> Use slot-sticky settings (via `slotConfigNames`) for `WEBSITE_CONTENTSHARE` and `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING`
> so these values do not swap with production.

## Deployment Flow

1. Deploy to staging slot
2. Warm up and test staging
3. Swap staging with production
4. Rollback by swapping again if needed

## Slot Settings

Configure settings that should not swap:

```bicep
resource slotConfigNames 'Microsoft.Web/sites/config@2022-09-01' = {
  parent: webApp
  name: 'slotConfigNames'
  properties: {
    appSettingNames: [
      'APPLICATIONINSIGHTS_CONNECTION_STRING'
    ]
  }
}
```
