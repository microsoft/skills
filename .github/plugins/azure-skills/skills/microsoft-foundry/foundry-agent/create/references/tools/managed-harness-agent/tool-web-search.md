# Web Search

Add Foundry Web Search directly:

```yaml
tools:
  - type: web_search
```

No project connection is required.

This differs from the Copilot toolset's built-in `web` capability (`microsoft_copilot_toolset_preview` for new authoring; legacy `github_copilot_toolset_preview` remains accepted). Most Managed Harness Agents should choose one to avoid overlapping search tools.
