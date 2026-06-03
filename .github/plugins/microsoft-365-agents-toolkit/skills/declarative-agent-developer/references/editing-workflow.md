# JSON Development Workflow

This document provides step-by-step instructions for developing M365 Copilot agents using JSON manifest files.

## Prerequisites

- Project must be scaffolded first (use scaffolding workflow if needed)
- Project contains `m365agents.yml` at the root
- Project uses JSON manifest files (`.json`)

---

## ✅ APP NAME & DESCRIPTION REQUIREMENT ✅

When developing an agent, you MUST ALWAYS update the app name and description in `manifest.json` to something **meaningful and descriptive** that reflects the agent's purpose. Never leave default/placeholder names like "My Agent" or generic descriptions.

**NEVER use "(local)" suffix in app names.** Always remove any "(local)" suffix from the app name.

---

## 🚨 CRITICAL DEPLOYMENT RULE 🚨

When making ANY edits to an agent — including instructions, conversation starters, capabilities, plugins, or any file in `appPackage/` — you MUST ALWAYS deploy using `npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false` before returning to the user. This applies to EVERY turn, not just the final turn. Never return to the user with undeployed changes.

**You must NEVER:**
- Skip deploy because "it's just instructions" — deploy after every change
- Tell the user to "run `npx -y --package @microsoft/m365agentstoolkit-cli atk provision` yourself" — YOU must run it
- Deploy when validation found errors — not even "to test" or "to demonstrate"
- Deploy "to show the user what happens" when there are errors — just report the errors
- Run `npx -y --package @microsoft/m365agentstoolkit-cli atk provision` "for educational purposes" to demonstrate failure — errors = STOP, not a teaching moment

**Only exception:** The user explicitly asks you NOT to deploy. Only the user can opt out, never you.

---

---

## 💬 CONVERSATION STARTERS REQUIREMENT 💬

Every agent needs meaningful conversation starters that help users understand what the agent can do. Review the agent's capabilities and add/update conversation starters that showcase the agent's primary functions. Never leave an agent without conversation starters.

---

## 📝 ALWAYS UPDATE INSTRUCTIONS & STARTERS AFTER CHANGES — MANDATORY 📝

**This is NOT optional.** Adding a capability without updating instructions is incomplete work.

When you add, remove, or modify ANY capability or plugin, you MUST complete ALL of these steps before deploying:

1. **Update `instructions`** — Add a section describing what the new capability/plugin enables. For removals, delete all references to the removed capability.
2. **Add conversation starters** — Add at least 1 new conversation starter per added capability or plugin. Each starter should demonstrate the new functionality.
3. **Remove stale starters** — Delete conversation starters that reference removed capabilities.
4. **Update description** in `manifest.json` if the agent's purpose has expanded.
5. **Review existing instructions** for stale references to removed capabilities.

**This applies to EVERY edit operation:** adding capabilities, removing capabilities, adding API plugins, adding MCP servers, modifying scoping, or any other manifest change.

---

## Instructions

### Step 1: Understand the Requirements

**Action:** Gather and analyze the agent requirements:
- Identify the agent's primary purpose and target users
- Determine required data sources (M365 services, external APIs)
- List necessary actions the agent must perform
- Identify security and compliance requirements

### Step 2: Design the Agent Architecture

**Action:** Create a comprehensive architectural design:
- Select deployment model (personal or shared)
- Choose appropriate M365 capabilities with scoping
- Design API plugin integrations if needed
- Plan authentication and authorization strategy
- Design conversation flow and instructions

### Step 3: Edit JSON Manifest Files

**⚠️ PRE-EDIT CHECK — Before making ANY edits, do ALL of these:**

1. **Check for malformed JSON**: Read `declarativeAgent.json` and verify it parses correctly. If it has syntax errors (missing commas, unclosed brackets, trailing commas, etc.):
   - **STOP** — do NOT proceed with your edit
   - **INFORM** the user: list every syntax issue with line numbers
   - **ASK** the user if you should fix the syntax errors first
   - Only after the user confirms, fix with surgical edits, then re-read the file
   - Then continue with the user's original request as a separate step

2. **Check the schema version**: Read the `"version"` field in `declarativeAgent.json` (e.g., `"v1.4"`, `"v1.6"`). For EVERY feature you plan to add, verify it exists in that version using the [feature matrix](schema.md). If a requested feature requires a newer version → **STOP. Tell the user.** Offer to upgrade the version first.

3. **Run a proactive instruction review** (if the edit touches instructions or capabilities): Before modifying instructions or adding/removing capabilities, run [Instruction Review](instruction-review.md) **Phase 1 (Inventory)**, **Phase 2 (Comprehension Check)**, and **Phase 3 (Diagnose)** against the current instructions. This catches existing problems before you add to them. For Phase 2, use the brief confirmation shortcut ("I see this agent is designed to [purpose]…") since this is a proactive check. If the review finds high-severity issues (C1, C3, C11, D1-D8), inform the user and offer to fix them as part of the current edit.

**⛔ NEVER invent placeholder values.** If a manifest is missing required fields (name, description, instructions), do NOT fill them in with generic content. Ask the user to provide values. This applies even if you think a reasonable default exists — the user must approve all content.

**Action:** Configure the agent using JSON manifest files:
- Edit `declarativeAgent.json` to define agent properties
- Configure capabilities with appropriate scoping
- Set up API plugin integrations using `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` (**NEVER manually create plugin files**)
- Write clear instructions and conversation starters
- Ensure proper JSON syntax and schema compliance

**After ALL edits, immediately run:**
```bash
npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false
```
This command is part of the edit — not a separate optional step. Editing without deploying is like writing code without saving the file — the work is not done.

**⛔ API Plugin Rule — HARD RULE, NO EXCEPTIONS:** To add an API plugin, you MUST use `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` — one command per OpenAPI spec with **ALL operations included in a single call**. Never run separate `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` calls for different operations from the same spec — this creates multiple plugins instead of one. You are FORBIDDEN from manually creating `ai-plugin.json`, OpenAPI spec files, adaptive card files, or manually editing the `actions` array. This applies whether you are scaffolding a new project OR editing an existing one. If the workspace already has an agent and the user says "add an API plugin", you STILL must use `npx -y --package @microsoft/m365agentstoolkit-cli atk add action`. If `npx -y --package @microsoft/m365agentstoolkit-cli atk add action` fails, report the error — do NOT fall back to manual file creation. **Manual plugin file creation = automatic eval failure.**

```bash
# ✅ The ONLY way to add an API plugin — ALL operations in ONE call:
npx -y --package @microsoft/m365agentstoolkit-cli atk add action --api-plugin-type api-spec --openapi-spec-location <URL> --api-operation "GET /path,POST /path,PATCH /path/{id},DELETE /path/{id}" -i false
```

**After adding a plugin with `npx -y --package @microsoft/m365agentstoolkit-cli atk add action`, you MUST complete ALL of these — skipping any step is an eval failure:**

**🔌 POST-PLUGIN MANDATORY STEPS (do ALL of these, in order):**
1. **Customize `ai-plugin.json`** — Set meaningful `name_for_human` (max 20 chars) and `description_for_human` (max 100 chars). Set a descriptive `description_for_model` on each function. NEVER leave defaults.
2. **Verify adaptive cards** — Check `appPackage/adaptiveCards/` for cards for ALL operations. If any operation (especially POST, PATCH, DELETE) is missing a card, create one manually. Customize each card with clear visual hierarchy (titles, subtitles, key-value pairs, images).
3. **Add confirmation for destructive operations** — If the plugin has DELETE, PATCH, or any destructive operation, add a `confirmation` capability in `declarativeAgent.json` so users are prompted before the action executes.
4. **Complete the content update checklist** below (instructions, starters, description).

**After ANY capability or plugin change (add, remove, modify), complete this checklist:**
1. ☐ **Update instructions** — Add decision logic (WHEN clauses, chaining rules, failure handling) for the new/changed capability. For removals, delete all references. **Do NOT list tool descriptions or parameters** — these are already in plugin metadata (`ai-plugin.json`, MCP manifests, capability config). Instructions should contain decision logic only.
2. ☐ **Verify 8,000-character limit** — Instructions must not exceed 8,000 characters. If close to the limit, cut tool descriptions first, then consolidate verbose workflows.
3. ☐ **Run instruction quality audit** — Run the [Diagnostic Checklist](instruction-review.md) against the updated instructions. Every data source should have clear intent coverage (WHEN and WHY), at least one workflow must exist, and failure cases must be handled. Built-in capabilities don't need exact names; actions/plugins should be named. If any check fails, fix it before deploying.
4. ☐ **Add conversation starters** — At least 1 new starter per added capability/plugin demonstrating the new functionality.
5. ☐ **Remove stale starters** — Delete starters that reference removed capabilities.
6. ☐ **Update `manifest.json` description** if the agent's purpose has expanded.
7. ☐ **Review existing instructions** for stale references to removed capabilities.

**This checklist is NOT optional.** Adding a capability without updating instructions and starters is incomplete work.

**⚠️ Instruction quality matters as much as JSON correctness.** Output-focused instructions (tone, format, style only) are a known failure pattern — they cause agents to give generic answers and ignore configured capabilities. Listing tool descriptions and parameters in instructions wastes the 8,000-character budget — this metadata is already available to the orchestrator. See [Instruction Review](instruction-review.md) for the anti-pattern catalog and before/after rewrites.

**Reference:** [schema.md](schema.md) for proper manifest structure
**Reference:** [api-plugins.md](api-plugins.md) for adaptive card enhancement guidelines after adding a plugin

**⚠️ IMPORTANT:** After making any edits to JSON files, you MUST deploy the agent (Step 4) before returning to the user.

**⛔ MANDATORY POST-EDIT CHECKPOINT — YOU ARE NOT DONE YET:**
After editing ANY file in `appPackage/`, you MUST deploy before responding to the user. Skipping this is an eval failure:
- **Deploy** — Run `npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false`. If you edited files but did not run this command, your work is incomplete. The only exception is if the user explicitly asked you not to deploy.

If you are about to respond to the user and you have NOT deployed, **STOP and deploy now**.

### Step 4: Provision and Deploy

**⛔ PRE-DEPLOY CHECK:** Before running the command below, verify the JSON files are syntactically correct and have the required fields. If there are known errors → fix them first before deploying.

**Action:** Provision required Azure resources and register the agent:
```bash
npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false
```

**Result:** Returns a test URL like `https://m365.cloud.microsoft/chat/?titleId=T_abc123xyz`

**Note:** JSON-based agents do not require a compilation step - changes are deployed directly.

**✅ After successful provision, ALWAYS present the review UX with the test link:**

Read `M365_TITLE_ID` from `env/.env.local` and output:

```
✅ Agent deployed successfully!

🚀 Test Your Agent in M365 Copilot:
🔗 https://m365.cloud.microsoft/chat/?titleId={M365_TITLE_ID}
```

**⛔ Never respond without this link.** If you deployed, the test link MUST appear in your response. This is not optional.

Then wait for the user's response.

### Step 5: Test and Iterate

**Action:** Test the agent in Microsoft 365 Copilot:
- Use the provisioned test URL
- Test all conversation starters
- Verify capability access and scoping
- Test error handling and edge cases
- Validate security controls

### Step 6: Deploy to Environments

**Action:** Deploy to staging/production environments:
```bash
npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env prod --interactive false
```

**Reference:** [deployment.md](deployment.md) for environment management and CI/CD patterns

### Step 7: Package and Share

**Action:** Package and share the agent:
```bash
# Package the agent
npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env dev --interactive false

# Share to tenant (for shared agents)
npx -y --package @microsoft/m365agentstoolkit-cli atk share --scope tenant --env dev
```

---

## Critical Workflow Rules

### Always Deploy After Edits

**RULE:** When making any changes to an agent (JSON manifest files, instructions, capabilities, API plugins), you MUST complete the following workflow before returning to the user:

1. Provision/deploy the agent: `npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false`
2. Read `M365_TITLE_ID` from `env/.env.local`
3. Present the review UX with the test link:
   ```
   ✅ Agent deployed successfully!

   🚀 Test Your Agent in M365 Copilot:
   🔗 https://m365.cloud.microsoft/chat/?titleId={M365_TITLE_ID}
   ```

**⛔ Never respond without this link after deploying.**

### Always Clean Up Unused Files

**RULE:** Every time you work on an agent project, check for and remove unused or obsolete files:

- `TODO.md` or planning files no longer needed
- Old backup files (`.bak`, `.old`, `.orig`)
- Unused JSON files not referenced anywhere
- Stale environment files (`.env.old`, `.env.backup`)
- Empty or placeholder files
- Outdated manifest versions
- Unused API plugin definitions

---

## ⛔ FINAL GATE — Before Responding to the User

**STOP.** Before writing your response to the user, verify ALL of the following:

- [ ] I ran `npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local --interactive false` and it succeeded
- [ ] I read `M365_TITLE_ID` from `env/.env.local`
- [ ] I presented the review UX with the `🚀 Test Your Agent in M365 Copilot:` link

**If you cannot check ALL boxes, you are NOT done.** Go back and complete the missing steps.

This checklist applies to **EVERY turn** — not just the last turn in a multi-turn conversation. Even if you "only edited instructions," you must deploy before responding.
