# Web API Base Template — REFERENCE ONLY

Default template for REST API workloads on Azure App Service. Use when no specific integration is detected or as the base for recipe composition.

## Templates by Runtime

| Runtime | AZD Template | Framework |
|---------|-------------|-----------|
| C# (.NET) | `azd init -t todo-csharp` | ASP.NET Core Minimal API |
| Node.js (JS) | `azd init -t todo-nodejs-mongo` | Express.js |
| Node.js (TS) | `azd init -t todo-nodejs-mongo` | Express.js (TypeScript) |
| Python | `azd init -t todo-python-mongo` | FastAPI / Flask |
| Java | `azd init -t todo-java-mongo` | Spring Boot |

**Browse all:** [Awesome AZD App Service](https://azure.github.io/awesome-azd/?tags=appservice)

> ⚠️ The AZD templates above include Mongo/Cosmos by default. When using as a pure Web API base, strip the database layer before applying a recipe:
> - Remove `infra/app/db.bicep` (or equivalent database module)
> - Remove Cosmos/Mongo module references from `infra/main.bicep`
> - Remove Cosmos/Mongo packages from the application source
>
> Then apply the appropriate [recipe](recipes/README.md) for your data store.

## Project Structure

```
project-root/
├── azure.yaml              # AZD service config
├── infra/
│   ├── main.bicep           # Main orchestrator
│   ├── main.parameters.json
│   └── app/
│       ├── web.bicep         # App Service + Plan
│       └── web-network.bicep # VNet integration (conditional)
└── src/
    └── api/                  # Application source
```

## App Service Plan Configuration

```bicep
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${name}-plan'
  location: location
  tags: tags
  sku: {
    name: 'B1'              // Dev/test — use P1v3+ for production
  }
  properties: {
    reserved: true           // Required for Linux
  }
}
```

| Environment | Recommended SKU | Notes |
|-------------|----------------|-------|
| Dev/Test | B1 | Basic tier, no autoscale |
| Production | P1v3 | Premium v3, autoscale, VNet integration |
| High-scale | P2v3 / P3v3 | Higher CPU/memory |

## Health Check Endpoint

> **CRITICAL**: Always include a health check endpoint. App Service uses it for instance monitoring.

Configure in App Service:
```bicep
properties: {
  siteConfig: {
    healthCheckPath: '/health'
  }
}
```

### Health check by language

**C# (ASP.NET Core)**
```csharp
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
```

**Node.js (Express)**
```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});
```

**Python (FastAPI)**
```python
@app.get("/health")
async def health():
    return {"status": "healthy"}
```

**Java (Spring Boot)**
```java
@GetMapping("/health")
public Map<String, String> health() {
    return Map.of("status", "healthy");
}
```

## Dockerfile Reference

All App Service deployments can use container deployment. Each runtime should include a Dockerfile:

**Python (FastAPI)**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Node.js**
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

## App Settings (Managed Identity)

> 💡 Call `mcp_bicep_get_az_resource_type_schema` with resource type `Microsoft.Web/sites` to validate properties before generating this resource.

```bicep
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  properties: {
    siteConfig: {
      appSettings: [
        { name: 'WEBSITE_HEALTHCHECK_MAXPINGFAILURES', value: '3' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
      ]
    }
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  tags: {
    'azd-service-name': 'api'
  }
}
```

> ⚠️ **Without `azd-service-name` tag, `azd deploy` fails with:**
> `resource not found: unable to find a resource tagged with 'azd-service-name: api'`
>
> The tag value must match the `services.<name>` key in `azure.yaml`. Use `api` for Web API services.

## Deployment

```bash
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"
azd init -t <template> -e "$ENV_NAME" --no-prompt
azd env set AZURE_LOCATION eastus2
azd up --no-prompt
```

**PowerShell:**
```powershell
$ENV_NAME = "$(Split-Path -Leaf (Get-Location) | ForEach-Object { $_.ToLower() -replace '[ _]','-' })-dev"
azd init -t <template> -e $ENV_NAME --no-prompt
azd env set AZURE_LOCATION eastus2
azd up --no-prompt
```

## References

- [App Service overview](https://learn.microsoft.com/en-us/azure/app-service/overview)
- [App Service best practices](https://learn.microsoft.com/en-us/azure/app-service/app-service-best-practices)
- [Health check](https://learn.microsoft.com/en-us/azure/app-service/monitor-instances-health-check)
