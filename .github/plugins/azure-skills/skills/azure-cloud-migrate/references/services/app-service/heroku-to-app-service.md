# Heroku to Azure App Service Migration

Detailed guidance for migrating Heroku applications to Azure App Service.

## Service Mapping

| Heroku Service | Azure Equivalent |
|---------------|------------------|
| Heroku App | Azure App Service |
| Dynos (Web) | App Service instances |
| Dynos (Worker) | WebJobs (continuous) or Azure Functions |
| Procfile | Startup command / Docker entrypoint |
| Buildpacks | Docker or App Service runtime stacks |
| Config Vars | App Settings / App Configuration / Key Vault |
| Heroku Postgres | Azure Database for PostgreSQL Flexible Server |
| Heroku Redis | Azure Cache for Redis |
| Heroku Kafka | Azure Event Hubs (Kafka-compatible) |
| Add-ons (general) | Azure managed services |
| Heroku Pipelines | GitHub Actions / Azure DevOps |
| Review Apps | Deployment Slots |
| Heroku CI | GitHub Actions |
| Heroku Scheduler | WebJobs (triggered) or Azure Functions Timer |
| Heroku ACM (SSL) | App Service Managed Certificate |
| Custom Domains | App Service Custom Domains |
| Heroku Logs / Logplex | Application Insights / Azure Monitor |
| Heroku Metrics | Azure Monitor Metrics |
| Heroku Connect | Azure Data Factory or Logic Apps |
| Private Spaces | App Service Environment (ASE) |

## Dyno → App Service Plan Mapping

| Heroku Dyno Type | App Service Plan | Notes |
|-------------------|------------------|-------|
| Free / Eco | Free (F1) | Dev/test only — F1 has shared compute with quota limits (CPU minutes), not equivalent to Heroku's 60 min/day cap. See [App Service Free SKU limits](https://learn.microsoft.com/azure/app-service/overview-hosting-plans#how-much-do-i-pay-for-the-free-and-shared-tiers) |
| Basic | Basic (B1) | No auto-scale, no slots |
| Standard-1X (512 MB) | Standard (S1) | Auto-scale, slots, custom domains |
| Standard-2X (1 GB) | Standard (S2) | More memory |
| Performance-M (2.5 GB) | Premium v3 (P1v3) | VNet, more instances |
| Performance-L (14 GB) | Premium v3 (P3v3) | High-memory workloads |
| Private-M / Private-L | App Service Environment (ASE) | Network-isolated |

## Procfile → Startup Configuration

### Web Process

| Procfile Entry | Azure Equivalent |
|---------------|------------------|
| `web: node server.js` | Startup command: `node server.js` |
| `web: gunicorn app:app` | Startup command: `gunicorn --bind=0.0.0.0 --timeout 600 app:app` |
| `web: java -jar target/app.jar` | Startup command: `java -jar app.jar` |
| `web: bundle exec puma -C config/puma.rb` | Custom container with Dockerfile |

### Worker Process

Heroku worker dynos have no direct App Service equivalent. Migration paths:

| Heroku Worker Pattern | Azure Equivalent |
|----------------------|------------------|
| `worker: node worker.js` | WebJob (continuous) |
| `worker: celery -A tasks worker` | Container App or AKS |
| `clock: node scheduler.js` | Azure Functions Timer trigger |
| `release: rake db:migrate` | Deployment slot swap scripts |

## Add-ons → Azure Managed Services

| Heroku Add-on | Azure Equivalent | Migration Notes |
|--------------|------------------|-----------------|
| Heroku Postgres | PostgreSQL Flexible Server | Use Azure DMS for data migration |
| Heroku Redis | Azure Cache for Redis | Export/import RDB or use replication |
| Heroku Kafka | Azure Event Hubs (Kafka API) | Compatible Kafka protocol |
| Papertrail | Application Insights | Structured logging migration |
| New Relic | Application Insights | APM feature parity |
| SendGrid | Azure Communication Services or SendGrid on Azure | SendGrid available via Azure Marketplace |
| Cloudinary | Azure Blob Storage + CDN | Media storage + delivery |
| Memcachier | Azure Cache for Redis | Redis supports memcache patterns |
| Bonsai (Elasticsearch) | Azure AI Search or Elastic on Azure | Search service migration |
| Heroku Scheduler | Azure Functions Timer trigger | Cron-based scheduling |
| Bucketeer (S3) | Azure Blob Storage | Object storage migration |

## Config Vars → App Configuration / Key Vault

| Config Var Type | Azure Target | Implementation |
|----------------|--------------|----------------|
| `DATABASE_URL` | App Setting (managed identity) | Use Entra auth, not connection string |
| `REDIS_URL` | App Setting | Azure Cache connection string or managed identity |
| `SECRET_KEY` | Key Vault reference | `@Microsoft.KeyVault(SecretUri=...)` |
| `API_KEY` (third-party) | Key Vault reference | Store in Key Vault |
| `NODE_ENV` / `RAILS_ENV` | App Setting | Add as a regular App Setting (e.g., `NODE_ENV=production`) — controls runtime behavior. Do NOT confuse with `WEBSITES_NODE_DEFAULT_VERSION`, which controls the Node.js engine version on Windows App Service. |
| `PORT` | Auto-injected | App Service sets `PORT` automatically |
| Feature flags | App Configuration | Feature management support built-in |

> ⚠️ **Warning:** Heroku's `DATABASE_URL` includes credentials. On Azure, use managed identity authentication instead. Never migrate connection strings with embedded passwords.

## Buildpacks → Docker

For apps using standard runtimes, use App Service runtime stacks directly. For custom buildpacks, migrate to Docker:

| Buildpack Scenario | Azure Approach |
|-------------------|----------------|
| Official Node.js buildpack | App Service Node.js runtime stack |
| Official Python buildpack | App Service Python runtime stack |
| Official Java buildpack | App Service Java runtime stack |
| Multi-buildpack (e.g., Node + Python) | Custom Dockerfile |
| Custom buildpack (apt packages) | Custom Dockerfile |
| Heroku CNB (Cloud Native Buildpack) | Azure Container Apps with CNB |

## Heroku Pipelines → GitHub Actions

| Pipeline Feature | Azure Equivalent |
|-----------------|------------------|
| Pipeline stages (dev → staging → prod) | GitHub Actions environments |
| Auto-deploy on push | GitHub Actions `on: push` trigger |
| Review Apps | Deployment slots with PR-based deploy |
| Pipeline promotion | Slot swap (staging → production) |
| Heroku CI test runner | GitHub Actions test job |
| Release phase | Pre-swap slot scripts |

### Example: GitHub Actions Deployment

```yaml
name: Deploy to App Service
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write   # Required for azure/login@v2 OIDC token request
      contents: read    # Required to checkout the repo
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
      - uses: azure/login@7184910d9eb2b1c5e48f7073824a90609bb9b6d6 # v2.3.1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - uses: azure/webapps-deploy@657f0700ea5214d56a0400d8ac5e8023c963d25d # v3.0.6
        with:
          app-name: '<app-name>'
          slot-name: 'staging'
```

> ⚠️ Without the `permissions:` block, `azure/login@v2`'s OIDC token request fails with HTTP 403.

## Review Apps → Deployment Slots

| Heroku Review Apps | App Service Deployment Slots |
|-------------------|------------------------------|
| Auto-create per PR | Create via GitHub Actions per PR |
| Unique URL per PR | `<app>-<slot>.azurewebsites.net` |
| Auto-destroy on PR close | Delete slot in PR close workflow |
| Shared pipeline config | Slot-specific App Settings |
| `app.json` postdeploy scripts | Slot swap pre/post actions |

## Reference Links

- [Heroku to Azure migration guide](https://learn.microsoft.com/en-us/azure/app-service/overview)
- [App Service deployment slots](https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots)
- [GitHub Actions for App Service](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions)
- [App Service managed identity](https://learn.microsoft.com/en-us/azure/app-service/overview-managed-identity)
