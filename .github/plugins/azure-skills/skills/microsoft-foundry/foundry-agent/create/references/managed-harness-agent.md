# Managed Harness Agent Authoring

A Microsoft Foundry Managed Harness Agent is a Prompt Agent configured with the Foundry-managed Copilot harness. This skill uses azd to author and deploy it:

```yaml
services:
  assistant:
    host: azure.ai.agent
    kind: prompt
    name: assistant
    model: gpt-5-mini
    instructions: Help the user.
    harness:
      type: microsoft_copilot_preview
```

Use REST field names, normally `snake_case`, inside `tools[]`. azd strictly validates the harness and Copilot toolset; most other nested tool fields pass through to Foundry.

## Compatibility

- New authoring uses `microsoft_copilot_preview` and, when declared, `microsoft_copilot_toolset_preview`.
- Existing `github_copilot_preview` and `github_copilot_toolset_preview` values remain accepted.
- Preserve the exact harness and toolset discriminator values already present, including mixed existing definitions. Do not migrate them during read, edit, save, redeploy, or revision flows.
- Author `defaultConfig` in `azure.yaml`; azd translates it to REST `default_config` only at the API boundary.
- Both discriminator families use `Foundry-Features: MicrosoftCopilot=V1Preview`. Do not retry with the legacy `GitHubCopilot=V1Preview` header.

## Direct tools

Prefer direct tool definitions unless the user explicitly requests a Toolbox:

```yaml
tools:
  - type: web_search
  - type: code_interpreter
```

Read [Managed Harness Agent Tools](tools/managed-harness-agent/agent-tools.md) for the supported tools, required fields, connections, and per-tool authoring references.

## Toolbox attachment

A Managed Harness Agent prefers direct tools. When the user explicitly requests a Toolbox, manage it separately with `azd ai toolbox`, create or reuse a matching authenticated project connection, then attach its exact versioned MCP endpoint as a direct tool:

```yaml
tools:
  - type: mcp
    server_label: research-tools
    server_url: https://<account>.services.ai.azure.com/api/projects/<project>/toolboxes/<toolbox>/versions/<version>/mcp?api-version=v1
    project_connection_id: <toolbox-connection>
    require_approval: always
```

The connection must be `RemoteTool` with `UserEntraToken`, audience `https://ai.azure.com`, and target exactly equal to `server_url`. See [Toolbox](tools/managed-harness-agent/tool-toolbox.md) for creation, reuse, metadata, and validation. Do not use connectionless Toolbox MCP.

## Skill attachment

Create and version Skills separately with `azd ai skill`. Reference an existing Foundry Skill by name and immutable version:

```yaml
skills:
  - name: issue-triage
    version: "3"
```

For a local Skill, upload it first:

```bash
azd ai skill create issue-triage \
  --file ./skills/issue-triage/ \
  --project-endpoint "<project-endpoint>" \
  --output json
```

Use the returned version in `azure.yaml`. For updates, run `azd ai skill update` and replace the pinned version.

Do not declare `host: azure.ai.skill` in this phase: that would make `azd deploy` manage the Skill lifecycle.

## Validation

After deploy, read the published definition and verify:

- `kind` remains `prompt`.
- New definitions use `microsoft_copilot_preview`; existing definitions retain their authored Copilot harness discriminator.
- Direct tools retain their authored fields.
- Existing Copilot toolset discriminators remain unchanged.
- The versioned Toolbox MCP endpoint and matching `project_connection_id` remain in the direct `mcp` tool.
- Skill references retain both `name` and `version`.

Managed Harness Agents, ordinary Prompt Agents, and Hosted Agents are not converted in place.
