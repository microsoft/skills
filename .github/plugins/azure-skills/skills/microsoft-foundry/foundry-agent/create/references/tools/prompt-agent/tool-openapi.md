# Tool — OpenAPI

Expose a REST API to the agent by attaching its OpenAPI 3.x spec. The platform parses the spec and synthesizes one tool per operation.

## Toolbox shape (anonymous)

```json
{
  "type": "openapi",
  "openapi": {
    "spec": { /* inlined OpenAPI 3.x document */ },
    "auth": { "type": "anonymous" }
  }
}
```

## `auth.type` values

- **`anonymous`** — no credentials sent.
- **`connection`** with `project_connection_id` — Foundry attaches a static API key (or OAuth tokens) from the named project connection. **`project_connection_id` is required only here.**
- **`managed_identity`** with `audience` — the project's managed identity calls the target API. **No `project_connection_id` is required**; Foundry uses the project MI and acquires a token for the supplied `audience` (the target service's resource URI). You must grant the project MI the appropriate RBAC role on the target service or the agent receives `401 Unauthorized`.

## Multi-entry rules

Multiple `openapi` entries are allowed in one toolbox **only if** each entry's spec defines a distinct `info.title` (the title is the implicit identifier). See [toolbox-reference.md § Multi-Tool Toolbox Constraint](../../toolbox-reference.md#multi-tool-toolbox-constraint).

## References

- [OpenAPI tool documentation](https://learn.microsoft.com/azure/foundry/agents/how-to/tools/openapi)
- [agent-tools.md](agent-tools.md) — tool index
- [foundry-tool-catalog.md](../../foundry-tool-catalog.md) — project connections for the `connection` auth path
