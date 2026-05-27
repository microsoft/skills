# Configure Health Probes — Platform Notes

## What "health probe" means per service

| Service | Mechanism | Where |
|---|---|---|
| App Service (Basic / Standard / Premium / Dedicated) | `siteConfig.healthCheckPath` (platform health check) | [services/app-service/reliability.md](services/app-service/reliability.md) |
| Functions Premium / Dedicated | `siteConfig.healthCheckPath` (platform health check) | [services/functions/reliability.md](services/functions/reliability.md) |
| Functions Flex Consumption (FC1) / Consumption (Y1) | HTTP-triggered `/api/health` function in **app code** — `healthCheckPath` is unsupported | [services/functions/reliability.md](services/functions/reliability.md) |
| Azure Front Door | `healthProbeSettings` on origin group | [health-probe-checks.md](health-probe-checks.md) |
| Traffic Manager | `monitorConfig` on profile | [health-probe-checks.md](health-probe-checks.md) |

> Container Apps (`liveness` / `readiness` probes) deep-dive references are planned for a future version of this skill but are not yet shipped.

## ⛔ STOP — Code-only fixes require user consent

For any case where enabling health probing requires **modifying app source code** rather than IaC — most notably Functions on FC1 / Y1, and Container Apps where the image doesn't already serve a `/health` route — **always ask the user for explicit consent before touching source files**. The exact prompt and decision tree are documented in the relevant per-service reference.

Do not generate or modify code without an explicit yes.

## Best Practices for Health Endpoints

These apply to any service:

1. **Keep health endpoints lightweight** — return 200 quickly; don't run heavy DB or downstream-dependency queries on every probe.
2. **Use anonymous auth** — platform health probes can't pass auth tokens.
3. **Two endpoints, not one** — a fast `/health` for the load balancer, and an optional `/health/deep` for on-call diagnostics.
4. **For Container Apps, both liveness AND readiness** — liveness alone restarts the container without taking it out of rotation first.
5. **Test the endpoint** before relying on it: `curl https://<app-url>/api/health`.

