# Session Protocol — Step 1

## All Prompts Are Actionable

> ⛔ **ALL prompts that activate this skill are actionable — go directly to Step 1.** Do NOT answer the user's question, give an overview of capabilities, or describe what AppOnboard can do before starting the pipeline. "Can Azure figure out my app?" and "Deploy my app" are the same action: Step 1 → Step 2 → scan. The user's phrasing (question vs command) does NOT change the workflow.

## Session Check

Resolve active session via pointer file.

> ⛔ **YOU MUST CREATE A SESSION BEFORE DOING ANY WORK — INCLUDING SCANNING**
>
> 1. **STOP** — Do not answer the user's question, scan code, or plan architecture yet
> 2. **CHECK** — Read `.copilot-azure/sessions/active-session.json`.
>    - ⛔ **First, ensure the repo's `.gitignore` contains `.copilot-azure/`** (append if missing, create the file if absent) — this runs on EVERY path below, BEFORE any branch writes a session file, since session artifacts may hold deploy secrets.
>    - **Pointer exists** → ⛔ **You MUST read [`session-schemas.ts`](session-schemas.ts)** to get the exact field names and types for `AppOnboardContext`. Do not guess field names. Then read the pointed-to session's `context.json`. Display: "Found session from [lastModifiedUtc] — {statusSummary}." ⛔ **You MUST ask the user via `ask_user`: "Resume this session or start fresh?" Do NOT auto-resume.** This gate is mandatory — stale sessions from prior tests cause the agent to skip PHASE.md reads and miss artifact writes.
>      - Resume → ⛔ **Read the PHASE.md for the NEXT phase** (derive from `completedPhases`). E.g., prereq done → read `prepare/PHASE.md`. Then continue from that phase.
>        - ⛔ **If `context.json.routeToSkill` is set:** The previous session was halted for migration (e.g., `azure-cloud-migrate`). The code has likely changed since then. **Do NOT skip prereq** — start fresh: clear `routeToSkill`, `routeReason`, remove `"prereq"` from `completedPhases`, and re-run from Step 2. This ensures the migrated codebase gets a clean 3-axis evaluation.
>        - ⛔ **If `completedPhases` includes `"prereq"` (and no `routeToSkill`):** Prereq already wrote `prereq-output.json` and `context.json.components[]`. Proceed to Step 2 (scope triage) — prereq may have been invoked standalone, so the user still needs to confirm the full pipeline. Skip Step 3 (prereq invocation), then continue to Step 4 (scan-informed intent gathering).
>      - Start fresh → generate a new UUID via `[guid]::NewGuid().ToString()`, create a new session folder, update `active-session.json` to point to the new session. Old session folder is never touched again.
>    - **Pointer missing but session folders exist** → list folders under `.copilot-azure/sessions/`. If 1 folder: adopt it (read its `context.json`, write `active-session.json` pointing to it, show summary). If 2+: show a numbered list with `statusSummary` + `lastModifiedUtc` from each, ask user to pick one or start fresh. Write pointer for the chosen session.
>    - **No sessions at all** → generate a UUID by running `[guid]::NewGuid().ToString()` in the terminal. ⛔ **You MUST generate the UUID via a terminal command — do NOT hardcode a placeholder like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`.** Create the session directory: `New-Item -ItemType Directory -Path ".copilot-azure/sessions/{uuid}" -Force`. Then write a **minimal** `context.json` using the `create` tool — only these 3 fields are known immediately: `{ "sessionId": "{uuid}", "createdUtc": "{ISO 8601 now}", "intent": { "userPrompt": "{user's first message verbatim}" } }`. Write `active-session.json` with `activeSessionId: {uuid}` using the `create` tool.
> 3. **PRUNE** — After resolving the active session, check remaining session folders. Delete any where `context.json.lastModifiedUtc` is >7 days ago. **Never delete the active session** (the one `active-session.json` points to).
> 4. **VERIFY** — Confirm `context.json` exists and is valid JSON. If missing or malformed, halt and retry creation — do NOT continue to Step 2 without a verified session.
> 5. **CONFIRM** — Begin your first response with: "Started session at `.copilot-azure/sessions/{uuid}/`" (new) or "Resuming session from [date] — {statusSummary}" (existing)
> 6. **THEN** proceed to Step 2
>
> ⛔ **Ordering: session FIRST, scanning SECOND.** If you scan the workspace or read project files before writing `context.json`, you have violated the session-first rule. The session must exist before ANY code analysis.
>
> ⛔ **Shell fallback:** If PowerShell/terminal hangs on first attempt (no output after 10s), use the `create` tool directly for session directory and file writes. Do NOT retry shell commands more than once.
>
> ⛔ **Path scoping: ALL `create` tool calls for session artifacts MUST target `.copilot-azure/sessions/{active-session-id}/`.** Writing to any other session folder is forbidden.

## CLI Availability

Call `mcp_azure_mcp_extension_cli_install` with `cli-type: "az"` to verify Azure CLI is available. If missing, surface installation instructions before proceeding. Downstream phases (prepare, deploy) require it. Fallback: skip if MCP tool unavailable.

## Azure Login Gate

**Azure login gate (mandatory):** Run `az account show --query "{id:id, name:name, tenantId:tenantId}" -o json` with a **15-second timeout** (PowerShell: `Start-Process` with `-Wait` or inline timeout; if command hangs beyond 15s, treat as failure). Also run `az ad signed-in-user show --query displayName -o tsv` (15-second timeout). After BOTH commands complete, merge ALL azure fields into `context.json.azure` in a **SINGLE update** — `subscriptionId`, `subscriptionName`, `tenantId`, and `userDisplayName`. Do NOT write separate updates for subscription and identity.

> ⛔ **If `az account show` fails or hangs:** ⛔ **You MUST read [`subscription-resolution.md`](subscription-resolution.md)** and follow its fallback procedure. Do NOT proceed to Step 2 without a resolved subscription. Do NOT leave `context.json.azure` empty and continue. Every downstream phase (prepare, scaffold validation, deploy) requires Azure auth — proceeding without it produces incomplete results.

## User Identity Detection

**User identity detection (for `deployed-by` tag):** Run `az ad signed-in-user show --query displayName -o tsv` (15-second timeout) alongside `az account show`. Fallback if `az ad` fails: use `az account show --query user.name -o tsv` (returns UPN/email). If both fail, leave empty — prepare phase will resolve. This value becomes the `deployed-by` tag on ALL resources — resolving it once here prevents inconsistent tag values across resources. **Merge into the SAME `context.json` update as the azure login gate — do NOT write separately.**

## Subscription Detection Method

> ⛔ **`az account show` is the ONLY subscription detection method in Step 1.** Do NOT call `mcp_azure_mcp_subscription_list` here — that tool returns ALL subscriptions across ALL tenants and causes a lengthy picker detour. `az account show` returns the CLI's active subscription in <1 second. MCP subscription list is reserved for prepare Step 1 when the user explicitly wants a different subscription.

## Artifact Locations

| Location | Artifacts |
|----------|-----------|
| `.copilot-azure/sessions/{uuid}/` | `context.json`, `prereq-output.json`, `prepare-plan.json`, `scaffold-manifest.json`, `deploy-result.json` |
| `.copilot-azure/sessions/{uuid}/replaced-files/` | User files displaced by scaffold (existing IaC), stored at their original relative path (**mirror path** = same directory structure as the repo). Never overwritten or deleted — moved here so the original is preserved. |

## Phase-gated Reference Loading

> ⛔ **Phase-gated reference loading.** Do NOT pre-read reference files for downstream phases. Read each sub-skill's references only when entering that step. Scaffold references (bicep-patterns, self-review) are irrelevant during deploy; prepare references (service-mapping, pricing-guide) are irrelevant during scaffold. Each sub-skill PHASE.md specifies its own required reads.
