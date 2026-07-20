# Enable Incoming A2A on a Foundry Agent

Expose a Foundry agent (prompt or hosted) as an Agent2Agent (A2A) endpoint so other agents can discover and call it.

## Pick a path

| Situation | Path |
|---|---|
| Hosted agent, `azd` project on disk, new agent version is fine | **A. Declarative (`azd deploy`)** |
| Same as above, want to change card / protocols without a new version | **B.1 `azd ai agent endpoint update`** |
| Prompt agent, portal-created agent, no local project | **B.2 REST PATCH** |

## Compose the agent card

Foundry validates the card — you can't enable A2A without one.

- **Required:** `description` (one sentence), and `skills[]` with at least one entry containing `id`, `name`, `description`.
- **Optional:** `version` (defaults to `"1.0"`), `skills[].tags`, `skills[].examples`.

**Confirm with the user before writing.** Never fabricate skills silently:

1. If the agent's purpose is fresh context, propose a card and ask "OK to proceed with this?"
2. If the target is unknown (existing agent, no context), fetch its record first, then draft from `instructions` / `tools` / `description` and ask the user to confirm or edit.
3. If the agent already has an `agent_card`, show it and ask whether to keep, replace, or edit.

## Path A: Declarative (`azd deploy`)

Add three blocks to the agent service in `azure.yaml`. **All three are required** — top-level `protocols:` declares the impl, `agentEndpoint.protocols` is the gate that exposes A2A, `agentCard` is validated on deploy.

```yaml
services:
  my-hosted-agent:
    host: azure.ai.agent
    # ...existing service config...
    protocols:
      - protocol: responses
        version: 2.0.0
      - protocol: a2a          # (a) implementation
        version: 1.0.0
    agentEndpoint:
      protocols:               # (b) gate
        - responses
        - a2a
    agentCard:                 # (c) required when a2a is in endpoint protocols
      description: "One-sentence summary of the agent."
      version: "1.0"
      skills:
        - id: general-qa
          name: General Q&A
          description: "What this skill does."
```

Then `azd deploy`. Bakes A2A in from v1 on a fresh agent, or bumps to a new version on an existing one.

## Path B.1: `azd ai agent endpoint update` (in place, no new version)

Same three-block YAML as Path A, but `endpoint update` PATCHes `agent_endpoint` and `agent_card` on the deployed agent without a new version:

```bash
azd ai agent endpoint update
```

**Does not touch** the top-level `protocols:` block — that's a per-version implementation declaration and only takes effect via `azd deploy`. If the deployed version doesn't already advertise `a2a` in its `protocol_versions`, use Path A first.

## Path B.2: REST PATCH (universal fallback)

Works on any agent kind (prompt, portal-created, hosted without local checkout).

```bash
AGENT_NAME="prompt-a2a"
PROJECT_ENDPOINT="https://<account>.services.ai.azure.com/api/projects/<project>"
TOKEN=$(az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv)

curl -X PATCH "$PROJECT_ENDPOINT/agents/$AGENT_NAME?api-version=v1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_card": {
      "description": "One-sentence summary of the agent.",
      "version": "1.0",
      "skills": [
        {"id": "general-qa", "name": "General Q&A", "description": "What this skill does."}
      ]
    },
    "agent_endpoint": { "protocols": ["responses", "a2a"] }
  }'
```

## Verify

Fetch the v1.0 card — this is the discovery URL other agents will use:

```bash
curl "$PROJECT_ENDPOINT/agents/$AGENT_NAME/endpoint/protocols/a2a/agentCard/v1.0" \
  -H "Authorization: Bearer $TOKEN"
```