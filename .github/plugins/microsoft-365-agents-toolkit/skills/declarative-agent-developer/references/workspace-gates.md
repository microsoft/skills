# Workspace Detection & Gate Rules

This document contains detailed rules for workspace detection, gate scenarios, and error handling behavior.

---

## 🚨 CRITICAL — Read Before Anything Else

**The #1 eval failure pattern is creating files that should not exist.** These rules are HARD BLOCKS:

1. **If `declarativeAgent.json` does NOT exist and the user asked to edit/modify/add/deploy → REJECT.** Respond with text only. Do NOT create the file. Do NOT create `appPackage/`. Do NOT look at other directories for examples to copy.
2. **If `declarativeAgent.json` has malformed JSON → DETECT first, then INFORM, then ASK.** You must parse the file and report errors to the user BEFORE making any edits. Never edit a broken file without first telling the user it's broken.
3. **If validation finds errors → NEVER run `npx -y --package @microsoft/m365agentstoolkit-cli atk provision`.** There are zero exceptions. Report errors and ask the user.

**The "Detect → Inform → Ask" protocol is mandatory for ALL error states:**
- **Detect**: Identify the problem (missing file, parse error, validation error)
- **Inform**: Tell the user what you found BEFORE taking action
- **Ask**: Wait for instructions before modifying anything

---

## Gate Definitions

### Gate 1: Wrong Project Type — STOP

The workspace contains a non-agent project (Express, React, Django, plain Node.js, Python, Go, etc.) with NO `appPackage/` folder and NO `m365agents.yml`.

**Your entire response must be text-only. No edits, no commands, no files.**

**Example rejection:**
```
This workspace contains an Express.js application (I can see package.json with
express as a dependency, src/index.js, etc.) but it is NOT an M365 declarative
agent project — there is no `appPackage/` folder and no `m365agents.yml`.

I cannot create agent files inside an existing non-agent project. To create a
declarative agent:
1. Navigate to a separate, empty directory
2. Ask me to create a new agent from scratch
```

### Gate 2: No Manifest, User Wants to Edit/Deploy — STOP

No `appPackage/declarativeAgent.json` exists but user implies an existing agent ("add X to this agent", "deploy this", "update instructions").

**Your entire response must be text-only. No edits, no commands, no files.**

**Anti-patterns that WILL cause eval failure:**
- ❌ Creating `declarativeAgent.json` from scratch to "help" the user
- ❌ Creating the `appPackage/` directory
- ❌ Looking at other directories/fixtures for examples and copying them
- ❌ Running `npx -y --package @microsoft/m365agentstoolkit-cli atk new` when the user asked to edit (editing ≠ scaffolding)
- ❌ Running ANY `npx -y --package @microsoft/m365agentstoolkit-cli atk` command — the project is not an agent project

**Example rejection:**
```
This workspace does not appear to be an M365 declarative agent project —
I could not find `appPackage/declarativeAgent.json`.

To get started with a new agent, please:
1. Navigate to an empty directory
2. Ask me to create a new agent from scratch

I cannot add capabilities or plugins to a project that doesn't have an agent manifest.
```

### Gate 3: No Manifest, User Wants New Project — Scaffold

User explicitly says "create a new agent", "scaffold", "start from scratch". The workspace should be empty — if it has a different project, go to Gate 1 instead.

→ Proceed to [Scaffolding Workflow](scaffolding-workflow.md)

### Gate 4: Manifest Exists with Errors — Fix First

`declarativeAgent.json` exists but has validation errors.

**Rules:**
- Parse and check `declarativeAgent.json` against the expected schema
- Report ALL errors to the user with specific details
- ASK the user before making changes
- **Do NOT** run `npx -y --package @microsoft/m365agentstoolkit-cli atk provision` — fix errors first, no exceptions
- **Do NOT** silently rewrite the entire file — surgical fixes only
- **Do NOT** invent placeholder values for missing required fields

**Special case — mostly empty manifest** (has `$schema` and `version` but no `name`, `description`, or `instructions`): This is Gate 4. Report missing fields, ASK the user. Do NOT invent values.

**Malformed JSON handling — STRICT ORDER (do NOT skip steps or reorder):**
1. **DETECT**: Read the file and attempt to parse it. Identify all syntax errors.
2. **INFORM**: Tell the user the file has malformed JSON BEFORE making any edits. List every syntax issue you found (missing commas, unclosed brackets, trailing commas, etc.) with line numbers.
3. **ASK**: Ask the user if you should fix the syntax errors. Wait for their response.
4. **FIX** (only after user confirms): Fix with surgical edits (not a rewrite — if you're changing >20% of lines, stop and reconsider)
5. **VALIDATE**: Check the manifest against the schema after fixing
6. **DO NOT DEPLOY**: Even after fixing, do NOT run `npx -y --package @microsoft/m365agentstoolkit-cli atk provision` until the user's original request is also addressed and validation passes cleanly

**⛔ Malformed JSON anti-patterns that WILL cause eval failure:**
- ❌ Reading the file and immediately editing it without telling the user it's broken
- ❌ Fixing JSON errors as part of a larger edit (fix syntax → inform → ask, THEN handle the user's request separately)
- ❌ Running `npx -y --package @microsoft/m365agentstoolkit-cli atk provision` after fixing syntax errors
- ❌ Validating AFTER editing instead of detecting errors BEFORE editing
- ❌ Mentioning malformed JSON only in a summary at the end instead of upfront

### Gate 5: Valid Project, User Reports Behavior Issues — Review

`declarativeAgent.json` exists and is valid, but the user reports that the agent "doesn't work well", "gives generic answers", "doesn't use the right tool", "ignores capabilities", or shows behavior changes after a model update.

**Trigger phrases:** "review instructions", "improve instructions", "my agent doesn't work", "agent gives generic answers", "agent doesn't follow the process", "agent changed after update"

→ Proceed to [Instruction Review](instruction-review.md) — run the full 5-phase review workflow (Inventory → Comprehension Check → Diagnose → Report → Rewrite).

**Rules:**
- Follow the Detect → Inform → Ask protocol — diagnose first, present findings, wait for approval before rewriting
- Do NOT skip directly to editing the instructions — run the diagnostic checklist first
- Do NOT deploy until the review is complete and the user has approved changes

### Gate 6: Valid Agent Project — Edit

→ Proceed to [Editing Workflow](editing-workflow.md)

---

## STOP Scenarios Quick Reference

| Scenario | What you see | What you MUST do | What you MUST NOT do |
|----------|-------------|-----------------|---------------------|
| Express/React/Node app | `package.json` + `src/index.js` but NO `appPackage/` | Text-only: tell user this is NOT an agent project | ❌ Create `appPackage/` ❌ Run `npx -y --package @microsoft/m365agentstoolkit-cli atk new` ❌ Create ANY files |
| No manifest, edit request | No `declarativeAgent.json`, user says "add capability" | Text-only: explain manifest is missing | ❌ Create files ❌ Scaffold ❌ "Help" by creating missing files |
| Manifest missing fields | `declarativeAgent.json` missing `name`/`description`/`instructions` | List ALL missing fields, ASK user | ❌ Invent placeholders ❌ Auto-fill ❌ Run `npx -y --package @microsoft/m365agentstoolkit-cli atk provision` |
| Manifest has errors | Manifest has structural/schema errors | Report ALL errors, suggest fixes, ask user | ❌ Silently fix ❌ Deploy ❌ Auto-correct |
| Valid project, behavior issues | Valid manifest, user says "agent doesn't work well" | Run Instruction Review workflow (5 phases) | ❌ Jump to editing without diagnosis ❌ Deploy without review ❌ Rewrite without user approval |

---

## Anti-Patterns (Gate 4)

These will cause eval failure:

**File creation violations:**
- ❌ Creating `declarativeAgent.json` when it doesn't exist (this is Gate 2, not Gate 4)
- ❌ Scaffolding a new project to "fix" an incomplete manifest
- ❌ Creating `appPackage/` directory in a non-agent project

**Content invention violations:**
- ❌ Inventing placeholder values (generic names, boilerplate instructions)
- ❌ Auto-completing missing fields without asking

**Malformed JSON violations:**
- ❌ Editing a malformed file without first telling the user it's broken
- ❌ Combining syntax fixes with other edits in one step (fix syntax first, THEN handle the request)
- ❌ Validating JSON only AFTER editing — you must detect errors BEFORE editing
- ❌ Mentioning "the file had malformed JSON" only in a final summary

**Deployment violations:**
- ❌ Running `npx -y --package @microsoft/m365agentstoolkit-cli atk provision` when validation found errors — not even "to test"
- ❌ Running `npx -y --package @microsoft/m365agentstoolkit-cli atk provision` "to see what happens"
- ❌ Auto-correcting errors and deploying without asking
- ❌ Deploying "for educational purposes" to show error output

**"EVEN IF..." — No exceptions to the deploy block:**
- EVEN IF deploying would "demonstrate the error" — just report errors
- EVEN IF the user says "deploy this" — if you know there are errors, explain why you can't
- EVEN IF you fixed errors yourself — verify the JSON is valid before deploying
