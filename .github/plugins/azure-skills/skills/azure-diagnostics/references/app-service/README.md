# App Service Troubleshooting

> **Request to "collect"/"gather" diagnostics?** Once the app name and resource
> group are known from the request or existing context, run the
> [`appservice-diagnostics`](../../scripts/appservice-diagnostics.sh) script
> ([PowerShell](../../scripts/appservice-diagnostics.ps1)) directly as your first action —
> don't verify the app/resource group exists with separate calls first, and don't substitute
> the individual commands below for it. It's read-only and reports clearly if the
> resource can't be found. Ask only for identifiers that remain missing. See "Combined
> Diagnostic Script" below for usage.

## Common Issues Matrix

| Symptom | Likely Cause | Action |
|---------|--------------|-----------|
| High CPU / memory | Runaway process, inefficient code | Use Process Explorer via Kudu, scale up |
| Deployment failure | Build error, locked files, quota | Check Kudu logs at `https://APP.scm.azurewebsites.net/api/deployments` to look for details on build errors, locked files or lack of storage quota |
| App crash / restart | Unhandled exception, OOM kill | Review Event Log and STDERR in Diagnose & Solve |
| Slow responses | Downstream dependency, no caching | Enable request tracing, check dependency calls |
| 502 / 503 errors | App not starting, port conflict | Check STDERR logs, verify startup command |
| TLS / domain errors | Certificate expired, DNS mismatch | `az webapp config ssl list`, verify CNAME |
| Health check failure | Endpoint not returning 200 | Verify health check path responds within 2 min |

---

## High CPU / Memory Diagnosis

**Diagnose:**
```bash
# Check app metrics
az monitor metrics list --resource APP_RESOURCE_ID \
  --metric "CpuPercentage,MemoryPercentage" --interval PT1M --output table

# View running processes via ARM Processes API (Entra ID auth)
az rest --method get \
  --uri "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Web/sites/<app-name>/processes?api-version=2024-04-01"
```

**Fix:** Scale up (`az appservice plan update -n <app-service-plan-name> -g <resource-group> --sku P1V3`) or profile the app via Kudu Process Explorer at `https://APP.scm.azurewebsites.net/ProcessExplorer/` to identify hot paths.

---

## Deployment Failure Analysis

**Diagnose:**
```bash
# List deployment history
az webapp deployment list -n APP -g RG --output table

# View deployment log for a specific deployment
az webapp log deployment show -n APP -g RG --deployment-id DEPLOY_ID

# Stream build logs from Kudu
az webapp log tail -n APP -g RG
```

**KQL — Failed deployments:**
```kql
// Replace <app-service-resource-id> with the full resource ID, for example:
// /subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Web/sites/<app-name>
AppServicePlatformLogs
| where TimeGenerated > ago(24h)
| where Level == "Error" and _ResourceId == "<app-service-resource-id>"
| project TimeGenerated, Level, Message
| order by TimeGenerated desc
```

**Common deployment failures:**

| Error Message | Cause | Fix |
|---------------|-------|-----|
| `WEBSITE_RUN_FROM_PACKAGE=1` but no package | Missing zip deploy artifact | Redeploy with `az webapp deploy --src-path app.zip` |
| `Error building on server` | Oryx build failure | Check build logs, pin runtime version |
| `Locked file` during deploy | Files in use | Set an environment variable named `MSDEPLOY_RENAME_LOCKED_FILES=1` on the App Service resource to enable MSDeploy to rename locked files. |

---

## Application Crash / Restart Diagnosis

**Diagnose:**
```bash
# Check recent restarts via activity log
az monitor activity-log list -g RG --resource-id APP_RESOURCE_ID \
  --max-events 10 --query "[?operationName.value=='Microsoft.Web/sites/restart/action']"

# View STDERR/STDOUT (Linux)
az webapp log download -n APP -g RG --log-file logs.zip
```

**KQL — App crashes and errors:**
```kql
AppServiceConsoleLogs
| where TimeGenerated > ago(1h)
| where ResultDescription contains "error" or ResultDescription contains "fatal"
| project TimeGenerated, ResultDescription
| order by TimeGenerated desc
| take 50
```

**Health check failures:**
```bash
# Show health check config
az webapp show -n APP -g RG --query "siteConfig.healthCheckPath"

# Test the endpoint directly
curl -s -o /dev/null -w "%{http_code}" https://APP.azurewebsites.net/health
```

> ⚠️ **Warning:** If the health check fails on >50% of instances for 1 hour, the instance is replaced.

---

## Slow Response Time Investigation

**Diagnose:**
```bash
# Check average response time
az monitor metrics list --resource APP_RESOURCE_ID \
  --metric "HttpResponseTime" --interval PT5M --aggregation Average --output table

# Enable failed request tracing
az webapp log config -n APP -g RG --failed-request-tracing true
```

**KQL — Slow requests with dependency analysis:**
```kql
AppServiceHTTPLogs
| where TimeGenerated > ago(1h)
| where TimeTaken > 5000
| project TimeGenerated, CsUriStem, ScStatus, TimeTaken, CsHost
| order by TimeTaken desc
| take 20
```

**Auto-Heal — Automatic mitigation:**
```bash
# Configure auto-heal to recycle on slow requests
az webapp config set -n APP -g RG \
  --auto-heal-enabled true \
  --generic-configurations '{"autoHealRules":{"triggers":{"slowRequests":{"timeTaken":"00:00:30","count":10,"timeInterval":"00:02:00"}},"actions":{"actionType":"Recycle"}}}'
```

---

## Custom Domain / TLS Certificate Issues

**Diagnose:**
```bash
# List custom domains
az webapp config hostname list -g RG --webapp-name APP --output table

# List TLS certificates
az webapp config ssl list -g RG --output table

# Check SSL binding
az webapp config ssl show --certificate-name CERT -g RG
```

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ERR_CERT_DATE_INVALID` | Certificate expired | If certificate came from an external certificate authority, renew with `az webapp config ssl upload` and upload a new certificate or enable managed certificates to allow Azure to provide a free TLS/SSL certificate |
| `DNS_PROBE_FINISHED_NXDOMAIN` | CNAME not configured | Add CNAME record pointing to `APP.azurewebsites.net` |
| `SSL binding not found` | Missing SNI binding | Add the missing SNI binding using `az webapp config ssl bind --certificate-thumbprint THUMB --ssl-type SNI -n APP -g RG` |
| Managed cert pending | DNS validation incomplete | Verify TXT record `asuid.DOMAIN` matches custom domain verification ID |

---

## AZ CLI or MCP Tools for App Service Diagnostics

| Tool | Command | Use When |
|----------|---------|----------|
| `Azure CLI` | `az webapp list` | List all web apps in subscription |
| `Azure CLI` | `az webapp show -n APP -g RG` | Get app config, stack, status |
| `Azure CLI` | `az webapp config appsettings list -n APP -g RG` | Check env vars and connection strings |
| `Azure CLI` | `az webapp deployment slot list -n APP -g RG` | Compare slot configurations |
| `mcp_azure_mcp_appservice` | `appservice_webapp_diagnostic_diagnose` | AI-powered root cause analysis |
| `mcp_azure_mcp_monitor` | `monitor_resource_log_query` | Run KQL against Log Analytics |
| `mcp_azure_mcp_resourcehealth` | `get` | Check platform-level health status |

> 💡 **Tip:** Start with `mcp_azure_mcp_appservice` (`diagnose`) — it automatically runs relevant detectors and surfaces the most likely root cause before you dig into logs manually.

---

## Combined Diagnostic Script

Use the [`appservice-diagnostics`](../../scripts/appservice-diagnostics.sh) script
([PowerShell](../../scripts/appservice-diagnostics.ps1)) to collect everything in one call.
It prints clearly labeled sections — app config, recent deployments, app settings, and
custom domains — and a summary line describing what it collected. Interpreting the output
remains your job.

```powershell
..\..\scripts\appservice-diagnostics.ps1 -Name <app> -ResourceGroup <rg>
```
```bash
../../scripts/appservice-diagnostics.sh --name <app> --resource-group <rg>
```
