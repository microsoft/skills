---
name: foundry-managed-skills
description: "Author, version, attach, and consume Foundry-managed skills (SKILL.md as a project resource). USE FOR: azd ai skill, Foundry skills REST/SDK, attach skill to toolbox, SkillsProvider, download skills into hosted agent containers, update agent behavior without code changes, skill versioning/rollback. DO NOT USE FOR: general Microsoft Learn docs search, non-Foundry agent frameworks, or Azure Functions/App Service deploy."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Foundry Managed Skills

Foundry **managed skills** store reusable behavioral guidelines (`SKILL.md`) as versioned project resources. Hosted agents download them at startup (or via toolbox attachment) so you can change agent behavior **without redeploying application code**.

This skill teaches the mental model and gotchas, then directs you to live CLI/SDK surfaces for current syntax.

## Pre-Execution Requirements

1. Authenticate (`az login`, and `azd auth login` when using `azd`).
2. Ensure the Foundry project endpoint is available (`AZURE_AI_PROJECT_ENDPOINT` or equivalent).
3. Install the skills extension when using CLI workflows: `azd extension install azure.ai.skills`.
4. Before Foundry MCP operations, discover available tools via the Azure MCP `foundry` surface.

## When to Use This Skill

| Intent | Action |
|--------|--------|
| Create / update / list / download / delete a Foundry skill | Follow **Create & version** below, then read [skill-manage](../microsoft-foundry/foundry-agent/create/references/skills/skill-manage.md) |
| Attach skills to a toolbox for hosted agents | Read [skill-toolbox-attach](../microsoft-foundry/foundry-agent/create/references/skills/skill-toolbox-attach.md) |
| Load skills inside agent code (`SkillsProvider`) | Read [skill-attach](../microsoft-foundry/foundry-agent/create/references/skills/skill-attach.md) |
| Broader hosted-agent create/deploy context | Also load `microsoft-foundry` create/deploy workflows |

## Mental Model

- A **skill** is a directory with `SKILL.md` (YAML front matter + Markdown body), uploaded to a Foundry project.
- Every mutation creates an **immutable version**; `create`/`update` promote a new default unless you pin a version.
- Agents discover skills primarily via the `description` field (progressive disclosure) — write **when-to-use** descriptions, not vague summaries.
- Toolbox references without a pinned version follow `default_version`; pinned refs (`skill@2`) stay fixed.
- `SkillsProvider` downloads the default version at **agent startup** — redeploy (or restart) to pick up updates.

## Create & Version (CLI)

```bash
azd extension install azure.ai.skills

# Directory with SKILL.md at root
azd ai skill create support-style --file ./skills/support-style/

# After local edits — new version, promoted to default
azd ai skill update support-style --file ./skills/support-style/

# Rollback without uploading
azd ai skill update support-style --set-default-version 1

azd ai skill list
azd ai skill download support-style
```

**Gotcha:** `name` and `description` in YAML front matter must be **unquoted**. Quoting them can cause HTTP 500 on import.

## Attach & Consume

- **Toolbox path:** attach skills to a Foundry toolbox so hosted agents receive them as session instructions / MCP-exposed guidance. Details: [skill-toolbox-attach](../microsoft-foundry/foundry-agent/create/references/skills/skill-toolbox-attach.md).
- **Code path:** use `SkillsProvider` (or equivalent sample patterns) so the container downloads skills at startup. Details: [skill-attach](../microsoft-foundry/foundry-agent/create/references/skills/skill-attach.md).
- **SDK CRUD sample (preview):** follow the current Foundry sample script linked from [skill-manage](../microsoft-foundry/foundry-agent/create/references/skills/skill-manage.md) — the Skills SDK surface may change.

## RBAC

Skills require **Foundry User** on the Foundry project for both the developer identity and the hosted agent's managed identity.

## Discover Current Syntax

Do **not** invent REST paths or SDK method names from memory.

1. Read [skill-manage](../microsoft-foundry/foundry-agent/create/references/skills/skill-manage.md) for CLI recipes and troubleshooting.
2. Use Foundry MCP / Microsoft Docs MCP for the latest Skills API shape.
3. Prefer `azd ai skill --help` and the Foundry samples repo over stale blog snippets.

## Troubleshooting (Quick)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| HTTP 500 on create | Quoted front matter `name`/`description` | Remove quotes |
| Agent ignores skill update | Startup download of old default / pinned toolbox version | Redeploy agent, or unpin / bump toolbox skill ref |
| Permission denied | Missing Foundry User | Grant role on the project scope |

For the full troubleshooting table and versioning rules, read [skill-manage](../microsoft-foundry/foundry-agent/create/references/skills/skill-manage.md).
