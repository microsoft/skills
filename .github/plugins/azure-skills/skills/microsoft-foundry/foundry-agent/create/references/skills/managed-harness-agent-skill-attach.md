# Attach Skills to a Managed Harness Agent

Manage Foundry Skills separately with `azd ai skill`; the Agent only consumes existing versioned Skills.

## Existing Foundry Skill

Obtain the immutable version:

```bash
azd ai skill show <skill-name> \
  --project-endpoint "<project-endpoint>" \
  --output json
```

Attach it in the Agent service:

```yaml
skills:
  - name: issue-triage
    version: "3"
```

Do not silently select the default version when the user requested a specific version.

## Local Skill

The local directory must contain `SKILL.md` at its root. Create the Foundry resource only when the user explicitly asks:

```bash
azd ai skill create issue-triage \
  --file ./skills/issue-triage/ \
  --project-endpoint "<project-endpoint>" \
  --output json
```

Use the returned version in the Agent's `skills` list. Later edits create a new immutable version:

```bash
azd ai skill update issue-triage \
  --file ./skills/issue-triage/ \
  --project-endpoint "<project-endpoint>" \
  --output json
```

Replace the pinned version before redeploying the Agent.

## Boundary

Do not add a `host: azure.ai.skill` service during this phase; it would make `azd deploy` create or update the Skill. Do not route Skills through a Toolbox: the Copilot harness accepts top-level versioned Skill references.
