# Session Protocol — Step 1

## All Prompts Are Actionable

> ⛔ **ALL prompts that activate this skill are actionable — go directly to Step 1.** Do NOT answer the user's question, give an overview of capabilities, or describe what AppOnboard can do before starting the pipeline. "Can Azure figure out my app?" and "Deploy my app" are the same action: Step 1 → Step 2 → scan. The user's phrasing (question vs command) does NOT change the workflow.

## Session Check

Resolve active session via pointer file.

> ⛔ **YOU MUST CREATE A SESSION BEFORE DOING ANY WORK — INCLUDING SCANNING**
>
> 1. **STOP** — Do not answer the user's question, scan code, or plan architecture yet
> 2. **CHECK** — Read `.copilot-azure/sessions/active-session.json`.
>    - **Pointer exists** →
>      1. ⛔ **Read [`session-schemas.ts`](session-schemas.ts)** to get the exact field names and types for `AppOnboardContext`, `PrereqOutput`, and `PreparePlan`. Do not guess field names. Then read the pointed-to session's `context.json`. Display: "Found session from [lastModifiedUtc] — {statusSummary}."
>      2. ⛔ **MANDATORY `ask_user` GATE — execute this step NOW, before ANY branching.** Call `ask_user`: "Resume this session or start fresh?" **Do NOT auto-resume, do NOT skip ahead to the staleness check, do NOT present cached findings.** Nothing else happens until the user answers. WHY: stale sessions from prior test runs cause the agent to silently reuse outdated results and skip PHASE.md reads. The staleness check alone cannot catch this — only the user knows whether the prior session is still relevant.
>      3. **Branch on user's answer** (only after `ask_user` returns):
>         - Resume → **Staleness check (prereq skill only):** If `completedPhases` includes `"prereq"`, run `git rev-parse HEAD` and compare to `context.json.repo.lastScanCommit`. If the commit is **different** OR `lastScanCommit` is **missing** → tell the user: "Repo has changed since last scan — re-running prereq." Proceed to SKILL.md Step 2 (skip session creation). If identical → present cached findings from `prereq-output.json` and go to SKILL.md Step 8 (Route). Then ⛔ **Read the PHASE.md for the NEXT phase** (derive from `completedPhases`). E.g., prereq done → read `prepare/PHASE.md`. Then continue from that phase.
>         - Start fresh → generate a new UUID via `[guid]::NewGuid().ToString()`, create a new session folder, update `active-session.json` to point to the new session. Old session folder is never touched again.
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

**Azure login gate (mandatory):** Run `az account show --query "{id:id, name:name, tenantId:tenantId}" -o json` with a **5-second timeout** (PowerShell: `Start-Process` with `-Wait` or inline timeout; if command hangs beyond 5s, treat as failure). If it succeeds, merge `subscriptionId`, `subscriptionName`, `tenantId` into `context.json.azure` (use `replace_string_in_file` or rewrite the file — the minimal context.json from Step 1 sub-step 2 may not have the `azure` key yet).

> ⛔ **If `az account show` fails or hangs:** ⛔ **You MUST read [`subscription-resolution.md`](subscription-resolution.md)** and follow its fallback procedure. Do NOT proceed to Step 2 without a resolved subscription. Do NOT leave `context.json.azure` empty and continue. Every downstream phase (prepare, scaffold validation, deploy) requires Azure auth — proceeding without it produces incomplete results.

## User Identity Detection

**User identity detection (for `deployed-by` tag):** If `az account show` succeeded, also run `az ad signed-in-user show --query displayName -o tsv` (5-second timeout). Write the result to `context.json.azure.userDisplayName`. Fallback if `az ad` fails: use `az account show --query user.name -o tsv` (returns UPN/email). If both fail, leave empty — prepare phase will resolve. This value becomes the `deployed-by` tag on ALL resources — resolving it once here prevents inconsistent tag values across resources.

## Subscription Detection Method

> ⛔ **`az account show` is the ONLY subscription detection method in Step 1.** Do NOT call `mcp_azure_mcp_subscription_list` here — that tool returns ALL subscriptions across ALL tenants and causes a lengthy picker detour. `az account show` returns the CLI's active subscription in <1 second. MCP subscription list is reserved for prepare Step 1 when the user explicitly wants a different subscription.

## Artifact Locations

| Location | Artifacts |
|----------|-----------|
| `.copilot-azure/sessions/{uuid}/` | `context.json`, `prereq-output.json`, `prepare-plan.json`, `scaffold-manifest.json`, `deploy-result.json` |

## Phase-gated Reference Loading

> ⛔ **Phase-gated reference loading.** Do NOT pre-read reference files for downstream phases. Read each sub-skill's references only when entering that step. Scaffold references are irrelevant during deploy; prepare references are irrelevant during scaffold. Each sub-skill PHASE.md specifies its own required reads.
