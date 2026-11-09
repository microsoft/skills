# Code Migration Phase

Migrate source platform web application code to Azure App Service.

## Prerequisites

- Assessment report completed
- Best practices loaded via `mcp_azure_mcp_get_azure_bestpractices` tool

## Rules

- Create all output in `<source-folder>-azure/` — never modify the source directory
- Use latest GA runtime stack for the target language
- Prefer managed identity over connection strings or API keys
- Use App Configuration for shared settings, Key Vault for secrets
- Always configure health check endpoint

## Steps

1. **Load Best Practices** — Use `mcp_azure_mcp_get_azure_bestpractices` tool for App Service guidance
2. **Create Project Structure** — Set up the project inside the output directory
3. **Migrate Application Code** — Adapt source code for App Service runtime
4. **Update Dependencies** — Replace platform-specific SDKs with Azure equivalents
5. **Configure Startup** — Set startup command or create Dockerfile
6. **Migrate Environment Variables** — Map to App Settings / App Configuration / Key Vault
7. **Configure Database Connections** — Switch to Azure database services with managed identity
8. **Add Health Check** — Implement `/healthz` endpoint for App Service health monitoring
9. **Set Up Logging** — Integrate Application Insights SDK

## Key Configuration Files

### Startup Command

For non-Docker deployments, configure the startup command in App Service:

| Runtime | Default Start | Custom Start |
|---------|--------------|--------------|
| Node.js | `npm start` | Set in Configuration → General Settings |
| Python | `gunicorn app:app` | `gunicorn --bind=0.0.0.0 --timeout 600 app:app` |
| Java | Auto-detected | `-Dserver.port=80` |
| .NET | Auto-detected | `dotnet myapp.dll` |

### Dockerfile (When Needed)

Use a Dockerfile when the app requires custom system dependencies or multi-process setups:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
```

> ⚠️ **Port**: App Service injects `PORT` env var. Always bind to `process.env.PORT || 8080`.

### Application Insights Integration

```javascript
// Add as FIRST import in entry point
const appInsights = require('applicationinsights');
appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setAutoCollectRequests(true)
  .setAutoCollectExceptions(true)
  .start();
```

## Database Migration Patterns

| Source | Azure Target | Connection Pattern |
|--------|--------------|--------------------|
| RDS PostgreSQL | Azure Database for PostgreSQL Flexible Server | Managed identity + `@azure/identity` |
| RDS MySQL | Azure Database for MySQL Flexible Server | Managed identity + `@azure/identity` |
| RDS SQL Server | Azure SQL Database | Managed identity + `@azure/identity` |
| Heroku Postgres | Azure Database for PostgreSQL Flexible Server | Managed identity |
| Cloud SQL | Azure SQL / PostgreSQL Flexible Server | Managed identity |
| MongoDB Atlas | Azure Cosmos DB for MongoDB | Connection string → managed identity |

### Managed Identity Database Connection (Node.js)

```javascript
const { DefaultAzureCredential } = require('@azure/identity');
const { Client } = require('pg');

async function main() {
  const credential = new DefaultAzureCredential({
    managedIdentityClientId: process.env.AZURE_CLIENT_ID
  });
  const token = await credential.getToken('https://ossrdbms-aad.database.windows.net/.default');

  const client = new Client({
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: token.token,
    ssl: { rejectUnauthorized: true },
    port: 5432
  });
  await client.connect();
  // ... use client
}

main().catch(console.error);
```

> ⚠️ Wrap in `async function main()` — top-level `await` is not supported in CommonJS or many Node.js entrypoints. For ESM, top-level await works only with `"type": "module"` in `package.json`.

## Static Assets & CDN

If the source app serves static assets, consider:
1. **Azure Blob Storage + CDN** for static files
2. **Azure Front Door** for global distribution
3. **App Service built-in static file serving** for simple cases

## Background Workers

| Source Pattern | Azure Equivalent |
|---------------|------------------|
| Heroku Worker dyno | WebJobs (continuous) or separate Container App |
| Beanstalk Worker tier | WebJobs or Azure Functions |
| App Engine service (worker) | WebJobs or Azure Functions |
| Cron jobs | WebJobs (triggered) or Azure Functions Timer trigger |

## Handoff to azure-prepare

After code migration is complete:

1. Update `migration-status.md` — mark Code Migration as ✅ Complete
2. Invoke **azure-prepare** — pass the assessment report context so it can:
   - Use the service mapping as requirements input
   - Generate IaC (Bicep/Terraform) for the mapped Azure services
   - Create `azure.yaml` and `.azure/preparation-manifest.md`
   - Apply security hardening
3. azure-prepare will then chain to **azure-validate** → **azure-deploy**
