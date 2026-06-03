# Scaffolding Workflow

Step-by-step instructions for scaffolding a new M365 Copilot agent project.

## ⛔ STOP — READ THIS FIRST

### ATK CLI Setup

Check if ATK CLI is available by running `npx -y --package @microsoft/m365agentstoolkit-cli atk --version`. If the command is not found, **STOP and tell the user** that the ATK CLI is required but not installed. Do NOT attempt to install it yourself — the user must install ATK separately before you can proceed.

### The Only Valid Command

Copy this command EXACTLY. Replace `<project-name>` with the user's project name:

```bash
npx -y --package @microsoft/m365agentstoolkit-cli atk new -n <project-name> -c declarative-agent -with-plugin no -i false
```

### Forbidden Commands — These Do Not Exist

| ❌ Invalid Command | Why It Fails |
|-------------------|--------------|
| `npx -y --package @microsoft/m365agentstoolkit-cli atk init` | DOES NOT EXIST — there is no init command |
| `npx -y --package @microsoft/m365agentstoolkit-cli atk init --template` | DOES NOT EXIST — there is no init or --template flag |
| `npx -y --package @microsoft/m365agentstoolkit-cli atk create` | DOES NOT EXIST — there is no create command |
| `npx -y --package @microsoft/m365agentstoolkit-cli atk scaffold` | DOES NOT EXIST — there is no scaffold command |
| `--template anything` | DOES NOT EXIST — there is no --template flag |

---

## Workflow

### Step 1: Understand the Request

**Action:** Verify the user wants to create a NEW M365 Copilot agent project.

**Check for:**
- Keywords: "new project", "create agent", "scaffold", "start from scratch", "M365 Copilot", "M365 agent", "declarative agent"
- Confirmation this is NOT an existing project

**If existing project:** Stop and use the editing workflow instead.

### Step 2: Verify Empty Directory and Collect Project Name

**Action:** Check if the current directory is empty, then ask for the project name.

**Directory check (CRITICAL):**
- Use `ls -A` to check if the current directory is empty
- **Ignore hidden folders** (starting with `.`) — these are meta-configuration folders (`.claude`, `.copilot`, `.github`) and should not block scaffolding
- If ONLY hidden folders exist, treat the directory as empty and proceed
- If directory has non-hidden files/folders, **ERROR OUT immediately**:
  ```
  ❌ Error: Current directory is not empty!

  This skill requires an empty directory to scaffold a new M365 Copilot agent project.
  Please navigate to an empty directory or create a new one first.
  ```
- Do NOT ask for a project name until the directory check passes

**Project naming rules:**
- Use **kebab-case** (lowercase with hyphens): `customer-support-agent`, `expense-tracker`
- Keep it concise: 2–4 words maximum
- No spaces, underscores, or special characters
- ✅ Good: `sales-dashboard`, `document-finder`, `hr-faq-agent`
- ❌ Bad: `agent1`, `test`, `ExpenseTrackerAgent`, `my project`

### Step 3: Run ATK CLI Command and Move Files

**Action:** Execute the scaffolding command, then move files from the ATK-created subfolder to the current directory.

Always use `-i false` (non-interactive mode) to prevent unexpected prompts.

**Commands to execute sequentially:**

1. **Create the project:**
```bash
npx -y --package @microsoft/m365agentstoolkit-cli atk new -n <project-name> -c declarative-agent -with-plugin no -i false
```

2. **Move all files from the subfolder to current directory:**
```bash
mv <project-name>/* <project-name>/.* . 2>/dev/null || true
```

3. **Delete the now-empty subfolder:**
```bash
rmdir <project-name>
```

4. **Verify success:**
- Check that key files exist in the current directory (`package.json`, `m365agents.yml`)
- Confirm the ATK-created subfolder was removed
- If the command fails, report the error and stop — do NOT retry automatically

### Step 4: Add Agent Context Files

**Action:** Ensure the project has context files that tell coding agents which skills are available and how to invoke them. This is critical for future sessions — without these files, agents won't know to use the `declarative-agent-developer` skill.

**Detection logic — check for existing files in this order:**

1. `.github/copilot-instructions.md` — if it exists, **edit it** to append the skill context block below
2. `AGENTS.md` — if it exists, **edit it** to add the skill context block below
3. `CLAUDE.md` (that is NOT a symlink) — if it exists, **edit it** to add the skill context block below
4. **If NONE of the above exist** — create both:
   - `AGENTS.md` — with the full content below
   - `CLAUDE.md` — as a **symlink** to `AGENTS.md` (`ln -sf AGENTS.md CLAUDE.md`)

**Content to add** (when editing an existing file, append this section; when creating `AGENTS.md`, use this as the full content):

````markdown
# M365 Declarative Agent Project

This is an M365 Copilot declarative agent project managed by the ATK CLI.

## Available Skills

When working on this project, you MUST use the appropriate skill for the task. **Do NOT work directly on files without invoking a skill first.**

| Skill | When to Use |
|-------|-------------|
| **declarative-agent-developer** | Any task involving this agent (see scenarios below). **This is the primary skill for this project.** |
| **ui-widget-developer** | Only when adding an MCP server that renders rich interactive widgets (HTML) in Copilot Chat using the OpenAI Apps SDK. |
| **install-atk** | Only when the ATK CLI is not installed or needs updating. |

## ⛔ MANDATORY: Invoke `declarative-agent-developer` Skill First

**This is a declarative agent project. For ANY task in this workspace — regardless of what it is — you MUST invoke the `declarative-agent-developer` skill BEFORE doing any work.** This is not optional. Do not attempt to handle any task yourself. Always delegate to the skill.

### Scenarios handled by this skill

- Creating a new agent project from scratch
- Editing manifests (declarativeAgent.json, manifest.json, m365agents.yml)
- Adding or removing capabilities (web search, Graph connectors, etc.)
- Adding API plugins from OpenAPI specs
- Adding MCP server plugins
- Adding OAuth authentication to plugins
- Localizing an agent into multiple languages
- Adding a new language to an already-localized agent
- Writing or updating agent instructions
- Deploying and provisioning with `atk provision`
- Validating the project with `atk validate`
- Fixing manifest errors or validation failures

**Do NOT:**
- Edit `declarativeAgent.json` or other manifest files directly without the skill
- Run `npx -y --package @microsoft/m365agentstoolkit-cli atk` commands without the skill
- "Help" by manually making changes — always delegate to the skill
````

**Rules:**
- When editing an existing file, preserve all existing content — append the skill context block at the end
- When creating new files, use the content above as-is
- Always create the `CLAUDE.md` symlink when creating a new `AGENTS.md` — both GitHub Copilot CLI and Claude Code read these files automatically
- This step is NOT optional — every scaffolded project must have agent context files

### Step 5: Confirm and Continue

**Action:** Provide a brief confirmation and immediately continue to the editing workflow.

```
✅ Project scaffolded in current directory: <absolute-current-directory-path>

Your M365 Copilot agent project structure is ready (JSON-based).
Agent context files have been added for future skill invocation.

🚀 Continuing to help you design and implement your agent...
```

Then invoke the editing workflow — do NOT wait for user input.

---

## Scope Boundaries

This workflow **only** handles project creation and agent context setup. After scaffolding:

- ✅ Confirm creation and hand off to the editing workflow automatically
- ❌ Do NOT discuss architecture, capability selection, or API plugin design
- ❌ Do NOT write JSON manifests, instructions, or configuration
- ❌ Do NOT create TODO files, open VS Code workspaces, or run extra commands
- ❌ Do NOT provide implementation guidance — that's for the editing workflow

---

## Error Handling

| Error | Action |
|-------|--------|
| ATK CLI not installed | Stop. Tell the user to install ATK first. |
| Directory not empty | Stop. Show error message. Do not proceed. |
| Invalid project name | Warn and suggest a corrected name. |
| `npx -y --package @microsoft/m365agentstoolkit-cli atk new` command fails | Report the error with full output. Do not retry. |
| File move fails | Report the error. Files may still be in the subfolder. |
