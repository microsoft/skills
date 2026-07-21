# Use Skills in a Hosted Agent

How to consume Foundry **skills** (reusable behavioral guidelines) from hosted agent code. Two approaches:

1. **Direct download** — agent downloads skill ZIPs at startup via the Skills API and builds a skills provider.
2. **Via Toolbox MCP** — agent connects to a toolbox MCP endpoint that exposes skills as resources.

## How progressive disclosure works

The Agent Framework SDK injects skill names/descriptions into the system prompt (~100 tokens each) and synthesizes a `load_skill` tool. When the model determines a skill is relevant, it calls `load_skill(name)` to retrieve the full body on demand — keeping context usage low.

## Choosing an approach

| | Direct Download | Via Toolbox MCP |
|--|---|---|
| How | Downloads ZIPs at startup, builds provider from local files | Connects to toolbox MCP; SDK reads `resources/list` → `load_skill` |
| Skill updates | Redeploy agent | Consumer endpoint picks up new version automatically |
| Header | `Foundry-Features: Skills=V1Preview` | Not required |
| When to use | No toolbox; need explicit version control | Already have a toolbox; want dynamic updates |

---

## Approach 1: Direct Download

At startup, the agent downloads skill ZIPs from the Foundry Skills API, extracts them to a local directory, and builds a skills provider. The SDK advertises skill names/descriptions in the system prompt and synthesizes a `load_skill` tool for on-demand loading.

**Prerequisites:**
- Skills provisioned in the Foundry project — see [skill-manage.md](skill-manage.md)

**Env vars** — set in `.env` for local run, and in the agent service's `environmentVariables` in `azure.yaml` for deployed agents:

| Variable | Purpose |
|----------|---------|
| `FOUNDRY_PROJECT_ENDPOINT` | Project endpoint for SDK calls |
| `AZURE_AI_MODEL_DEPLOYMENT_NAME` | Model deployment for the agent |
| `SKILL_NAMES` | Comma-separated skill names to download |

### Python

Flow: download skills → extract ZIPs → build skills provider → attach to agent as context provider → SDK synthesizes `load_skill` tool.

Full working sample: [12-foundry-skills (Python)](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/agent-framework/responses/12-foundry-skills) — **read `README.md` and `main.py`** for setup and integration details.

### C#

Flow: download skills via Skills API → extract ZIPs → build skills provider → register in agent context → SDK synthesizes `load_skill` tool.

Full working sample: [agent-skills (C#)](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/hosted-agents/agent-framework/agent-skills) — **read `README.md` and `Program.cs`** for setup and integration details.

---

## Approach 2: Via Toolbox MCP

The agent connects to a toolbox MCP endpoint at startup. The SDK discovers skills via `resources/list`, advertises them in the system prompt, and synthesizes a `load_skill` tool that reads skill content via `resources/read` on demand.

**Prerequisites:**
- Skills provisioned in the Foundry project — see [skill-manage.md](skill-manage.md)
- Skills attached to a toolbox — see [skill-toolbox-attach.md](skill-toolbox-attach.md)

**Env vars** — set in `.env` for local run, and in the agent service's `environmentVariables` in `azure.yaml` for deployed agents:

| Variable | Purpose |
|----------|---------|
| `FOUNDRY_PROJECT_ENDPOINT` | Project endpoint for SDK calls |
| `AZURE_AI_MODEL_DEPLOYMENT_NAME` | Model deployment for the agent |
| `TOOLBOX_NAME` | Toolbox name — SDK constructs endpoint |

### C#

Flow: connect to toolbox MCP endpoint → discover skills via `resources/list` → build skills provider from MCP resources → SDK synthesizes `load_skill` tool → reads skill content via `resources/read` on demand.

Full working sample: [foundry-toolbox-mcp-skills (C#)](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/csharp/hosted-agents/agent-framework/foundry-toolbox-mcp-skills) — **read `README.md` and `Program.cs`** for setup and integration details.

## Verify end-to-end

```bash
azd ai agent run --no-client
azd ai agent invoke --local "Hi, can I return my tent within 30 days?"
```

### Handling `mcp_approval_request`

The `load_skill` tool is exposed as an MCP tool in the Responses protocol. The sample code defaults to requiring approval (`require_approval: "always"`), so the agent returns both a `function_call` (completed) and an `mcp_approval_request` in the output. The agent will not produce a text response until the client approves the request.

**Foundry Portal** — after deploying, the portal playground shows the approval prompt and handles it interactively.

**Local with Agent Inspector** (`azd ai agent run`) — the Inspector UI shows an approval button to approve the request.

**Local without Inspector** (`azd ai agent run --no-client`) — use `curl` against `http://localhost:8088/responses` directly:

1. Send the initial message:

```bash
curl -s -X POST http://localhost:8088/responses \
  -H "Content-Type: application/json" \
  -d '{"input": "What is your return policy?"}'
```

The response includes `mcp_approval_request` items with an `id` field.

2. Approve and continue — send `mcp_approval_response` referencing each `id`:

```bash
curl -s -X POST http://localhost:8088/responses \
  -H "Content-Type: application/json" \
  -d '{
    "previous_response_id": "<response_id_from_step_1>",
    "input": [
      {
        "type": "mcp_approval_response",
        "approval_request_id": "<mcp_approval_request_id>",
        "approve": true
      }
    ]
  }'
```

The agent now produces the text response with skills applied.

**To skip approval entirely**, configure `require_approval: "never"` on the MCP tool. This behavior is controlled by the Agent Framework SDK — see the sample code for how MCP tool approval is configured.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|------------|-----|
| `SKILL.md not found` after download | ZIP doesn't contain `SKILL.md` at root | Create skill from directory with `SKILL.md` at root |
| Agent ignores skills | Descriptions don't match user queries | Improve `description` in SKILL.md front matter |
| Skills load but agent doesn't follow | Instructions vague or conflicting | Refine skill body; add canary token to verify loading |
| `asyncio.TimeoutError` (Python) | Slow network or large packages | Increase bootstrap timeout (default 60s) |
| `allow_preview` error (Python) | SDK client missing preview flag | Set `allow_preview=True` on the project client |
| HTTP 500 on skill download (C#) | Missing feature header | Add `Skills=V1Preview` feature header to requests |
| `SKILL_NAMES` not in deployed agent | Env var missing from `azure.yaml` | Add to the agent service's `environmentVariables`, redeploy |
| MCP timeout (Toolbox) | Auth token expired or wrong scope | Use `https://ai.azure.com/.default`; refresh per request |

## References

- [skill-manage.md](skill-manage.md) — create, version, and manage skills
- [skill-toolbox-attach.md](skill-toolbox-attach.md) — attach skills to a toolbox, MCP protocol
