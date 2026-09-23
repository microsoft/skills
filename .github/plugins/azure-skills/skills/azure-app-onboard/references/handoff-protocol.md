# Handoff Protocol — Step 9

Offer next steps: CI/CD setup, monitoring, domain config, **🗑️ resource cleanup**, skill-based suggestions. Session artifacts remain for deferred pickup.

> ⛔ **Handoff MUST include ALL FOUR sections: (1) Deployment Identity, (2) Cleanup Commands, (3) Redeploy Command, (4) Post-Deploy Recommendations.** Missing any section = incomplete handoff. Do NOT skip cleanup even if deployment failed. Do NOT skip identity even if no resources were created. Do NOT skip recommendations even if the list is empty (print "No post-deploy recommendations.").

## Deployment Identity

> ⛔ **Start handoff with deployment identity.** First lines of the handoff response MUST be:
> ```
> 🏢 Subscription: {context.json.azure.subscriptionName} ({context.json.azure.subscriptionId})
> 📁 Resource Group: {context.json.azure.resourceGroup}
> 🌍 Region: {context.json.azure.region}
> 🔗 Portal: https://portal.azure.com/#@/resource/subscriptions/{subId}/resourceGroups/{rgName}/overview
> ```
> Source: `context.json.azure`. This is the user's quickest path to finding their resources after the session ends.

See [deploy-checklist-template.md § Deployment Summary](../deploy/references/deploy-checklist-template.md) for the full deployment summary format.

## Artifact Self-Check

> ⛔ **Artifact self-check — MANDATORY before handoff.** Verify these exist before presenting cleanup or next steps:
> 1. `deploy-result.json` in session folder — if missing, read [`deploy-schemas.ts`](../deploy/references/deploy-schemas.ts) and write it NOW with status, endpoints, health, `orphanedResourceGroups[]`
> 2. Portal deployment link printed in chat — if missing, generate from `$resId` pattern (see deploy/SKILL.md Step 6) and print now
> 3. `deployment-summary.md` in session folder — if missing, `create` it NOW with the same content you are about to present in chat (status, subscription, RG, region, services table, endpoints, cleanup commands). One `create` call — do NOT skip.

## Post-Deploy Recommendations

> ⛔ **`postDeployRecommendations[]` MUST be surfaced — not silently dropped.** Read `prepare-plan.json.postDeployRecommendations[]` (already merged with prereq findings by the prepare phase). Present EACH entry as a numbered recommendation with this format:
> ```
> 📋 Post-deploy recommendations:
> 1. **{title}** ({effort} effort) — {reason}. Services: {services[]}
> 2. ...
> ```
> This section MUST appear BEFORE the skill-based suggestions and AFTER the cleanup commands. If `postDeployRecommendations[]` is empty, print "No post-deploy recommendations." Do NOT skip this section — findings buried in JSON artifacts are easily dropped from the handoff if not explicitly surfaced here.

## Cleanup Commands

> ⛔ **Cleanup commands are MANDATORY — always print BOTH.** Every handoff must include these two cleanup blocks, regardless of whether healing occurred or orphans exist.

**Primary cleanup (always print):**
```
🗑️ Delete this deployment's resources:
  → az group delete -n {rg} --yes --no-wait
```

**Tag-based bulk cleanup (always print — catches orphans from healing):**
```
🏷️ Delete ALL resources from this AppOnboard session:
  → az group list --tag app-onboard-session-id={sessionId} --query "[].name" -o tsv | ForEach-Object { az group delete -n $_ --yes --no-wait }
```
This catches orphaned RGs from region fallback or naming conflict healing. For Terraform: `cd infra && terraform destroy`.

**If `deploy-result.json.orphanedResourceGroups[]` is non-empty**, list each explicitly with delete commands. For orphans with a `subscription` field, include `--subscription {subscription}`.

## Redeploy Command

> ⛔ **Redeploy command is MANDATORY.** The full AppOnboard pipeline (prereq → prepare → scaffold → deploy) is a one-time setup. After that, the user only needs to rebuild and push code. Without this command, they'd have to reverse-engineer the deploy steps from session artifacts or re-run the entire pipeline. Give them the shortcut.

**Derive from what you ran in deploy Step 6b (code deploy).** Do NOT hardcode per service type — echo back the actual command(s) you executed to deploy code. The command varies by compute type, registry name, Dockerfile path, image tag, app name, etc. — all of which you already know from this session.

```
🔄 Redeploy (after code changes):
  → {code deploy command(s) from Step 6b}
```

Include this in the chat handoff AND in `deployment-summary.md`.

**If `deploy-result.json.healingAttempts[]` is non-empty**, surface: "⚕️ Deployment required {N} healing attempts" with per-attempt error/action/outcome and planLevelChange details.

**Cross-session cleanup (optional — show if user asks):**
```
🔍 Find ALL AppOnboard resources across all sessions:
  → az group list --tag app-onboard-skill=true -o table
```

## Skill-Based Next Steps

> ⛔ **Skill-based next steps are MANDATORY.** Always suggest at minimum `azure-compliance` and `azure-resource-visualizer`. Evaluate every condition below.

> ⛔ **Suggest, don't self-execute.** Present these as optional suggestions. The deploy agent must NEVER perform post-deploy infra changes itself — zone redundancy, private endpoints, SKU upgrades, and resource re-creation are imperative mutations the deploy phase must not make. If the user explicitly opts into one, route to that skill as a new, scoped task; otherwise the pipeline ends at handoff.

| Condition | Suggest |
|-----------|--------|
| Always | **`azure-compliance`** — "Run a compliance scan on your deployed resources" |
| Always | **`azure-resource-visualizer`** — "Generate an architecture diagram of your resource group" |
| Reliability/HA gaps (single-zone, no failover, prod workload) or user asks to "harden" / "make production-ready" | **`azure-reliability`** — "Assess & improve reliability: zone redundancy, multi-region failover, health probes" |
| Cost-sensitive workload or user asks about spend | **`cost-analysis`** from the optional `azure-cost` plugin — "Review your Azure spend and identify its drivers" |
| Health check failed / `healthStatus: "degraded"/"unreachable"` | **`azure-diagnostics`** — "Troubleshoot your deployment" |
| Auth/OAuth/MSAL detected in intent or prereq | **`entra-app-registration`** — "Set up app registration for your auth flow" |
| `postDeployRecommendations[]` has upgrade suggestions | **`azure-upgrade`** — "Upgrade your runtime or framework" |
| Storage-heavy patterns | **`azure-storage`** — "Optimize your storage configuration" |
| `postDeployRecommendations[]` mentions RBAC/role | **`azure-rbac`** — "Configure least-privilege role assignments" |

If unavailable, direct the user to their client's supported plugin installation
flow and leave the handoff pending.

## Completion

> ⛔ **End the handoff with an explicit completion line — the LAST thing you emit.** It marks the pipeline done (so you stop working) and tells the user the core task succeeded and anything more is their choice. Frame it as closure WITH an open door — never a hard stop.
>
> ⛔ **Use this EXACT sentence verbatim — do NOT paraphrase, reword, or reorder it:** "The onboarding pipeline is finished." Only `{primary endpoint URL}` varies. This exact phrase is a required completion marker.

```
✅ **Deployment complete — your app is live at {primary endpoint URL}.** The onboarding pipeline is
finished. The next steps above are optional — tell me which you'd like and I'll route you to the
right skill.
```

> ⛔ **The recommendations above are OPTIONAL — do NOT autonomously execute them.** Present them and let the user choose; if they pick one, route to the matching skill (it makes the change properly). Don't turn a general acknowledgment into a batch of unsolicited hardening. Beyond this point the session is the user's — they may continue, invoke another skill, or run their own commands; that's expected and no longer part of this pipeline.
