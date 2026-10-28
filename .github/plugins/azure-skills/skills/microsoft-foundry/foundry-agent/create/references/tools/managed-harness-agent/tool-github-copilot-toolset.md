# Copilot Toolset

Requires:

```yaml
harness:
  type: microsoft_copilot_preview
```

Configure built-ins:

```yaml
tools:
  - type: microsoft_copilot_toolset_preview
    defaultConfig:
      enabled: false
    configs:
      - name: filesystem_read
        enabled: true
      - name: filesystem_write
        enabled: false
      - name: shell
        enabled: false
      - name: web
        enabled: true
      - name: subagents
        enabled: true
```

Supported names:

- `filesystem_read`
- `filesystem_write`
- `shell`
- `web`
- `subagents`

`defaultConfig.enabled` sets the default; `configs` overrides individual tools. Duplicate/unknown names, unknown fields, and non-boolean `enabled` values fail before deployment.

The built-in `web` tool is distinct from Foundry `web_search`. Prefer one search path unless the user explicitly needs both.

## Legacy compatibility

Existing definitions may use `github_copilot_preview` and `github_copilot_toolset_preview`. Read and preserve those literal values during ordinary updates; do not migrate them merely by opening, editing, saving, redeploying, or creating a new version. Existing mixed harness/toolset families are also preserved as authored.
