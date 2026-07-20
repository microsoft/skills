# azd ai CLI Reference

Core mental model for the `azd ai agent` extension. Use this when you need to understand command surface, file layout, or where a given setting lives.

## CLI surface

```bash
azd ai project show                  # which Foundry project endpoint is active
azd ai agent show                    # is the agent deployed? what version?
azd ai agent doctor                  # full health check, suggests fixes

azd ai agent sample list             # curated catalog -- pick a manifestUrl
azd ai agent init -m <manifestUrl>   # scaffold from a sample
azd ai agent init --src <dir>        # scaffold from existing source

azd ai agent run --no-client         # start on localhost:8088 without a client UI
azd ai agent invoke "<msg>"          # invoke the deployed agent
azd ai agent invoke --local "<msg>"  # invoke the agent on localhost

azd provision                        # core azd; creates Foundry project + infra
azd deploy                           # core azd; packages + registers new agent version
azd ai agent endpoint update         # patch agentEndpoint / agentCard in place

azd ai connection list / show / create / update / delete
azd ai toolbox list / show / create / publish / delete
azd ai toolbox connection add / remove / list
azd ai toolbox versions list

azd ai agent files upload / download / list / delete / mkdir / stat
azd ai agent sessions create / show / stop / delete / list
azd ai agent monitor                 # per-session log stream (SSE)

azd ai agent eval generate / run / show / update / list
azd ai agent optimize / optimize status / optimize apply / optimize deploy / optimize cancel
```

Use `--output json` only when a command supports it. `azd ai agent invoke` supports `default` and `raw` output.

### Hosted files and sessions

Use the file commands for an active hosted-agent session:

| Command | Purpose |
|---------|---------|
| `azd ai agent files upload` | Upload a local file. |
| `azd ai agent files download` | Download a remote file. |
| `azd ai agent files list` | List a remote directory. |
| `azd ai agent files stat` | Inspect metadata for a remote path. |
| `azd ai agent files mkdir` | Create a remote directory. |
| `azd ai agent files delete` | Delete a remote file or directory. |

Directory deletion is not recursive by default. Add `--recursive` only when deleting the directory and all of its contents is intentional.

`azd ai agent invoke` manages the current session automatically. It reuses the saved session for the agent or captures and persists the server-assigned session on the first invoke. Use `--new-session` to reset session-backed state or `--session-id` to select a known session.

Use `sessions create` only when a session must exist before invoke or file operations. The remaining session commands are `show`, `stop`, `delete`, and `list`. `sessions stop` stops compute and preserves the session filesystem. `sessions delete` removes both compute and filesystem state. See [Hosted Session Management](../../invoke/references/session-management.md).

## The azure.yaml service block

After `azd ai agent init`, every hosted agent is defined as a **service block in `azure.yaml`** (`host: azure.ai.agent`) plus the active azd env; init consolidates the sample's definition into `azure.yaml`.

| Location | What it holds |
|------|---------------|
| `azure.yaml services.<name>` (the agent) | `host: azure.ai.agent`, `kind`, `name`, `project`, `language`, `uses`, `protocols`, `environmentVariables`, `codeConfiguration` / `docker` / `image`, `container.resources`, `description`, `agentEndpoint`, `agentCard`, `startupCommand`. |
| `azure.yaml services.ai-project` | Model `deployments[]` (`host: azure.ai.project`). The agent links to it via `uses: [ai-project]`. |
| `.azure/<env>/.env` (`azd env set`) | Secrets and `PARAM_<CONN>_<KEY>` credential values referenced from `azure.yaml`. |

`azd deploy` reads the agent service block and creates a new immutable agent version. `azd provision` reads project infrastructure such as `services.ai-project.deployments[]` and applies it via Bicep.

`agent.manifest.yaml` (the file passed to `-m`) is the seed format -- it is NOT on disk after init. Init folds its `parameters:` / `resources:` blocks into the `azure.yaml` service block and the azd env.

> **Local vs API field names.** Local `azure.yaml` uses **camelCase** (`codeConfiguration`, `entryPoint`, `dependencyResolution`, `environmentVariables`). The deployed definition returned by `azd ai agent show` / the Foundry `agent_get` API uses **snake_case** (`code_configuration`, `entry_point` as an array, `environment_variables`). Don't mix the two.

### Hosted agent service block (code deploy)

```yaml
services:
  ai-project:
    host: azure.ai.project
    deployments:
      - name: gpt-4.1-mini
        model:
          format: OpenAI
          name: gpt-4.1-mini
          version: "2024-04-09"
        sku:
          name: GlobalStandard
          capacity: 50
  my-agent:
    project: src/my-agent
    host: azure.ai.agent
    language: python
    uses:
      - ai-project
    kind: hosted
    name: my-agent
    description: A hosted agent.
    codeConfiguration:
      runtime: python_3_13
      entryPoint: main.py
      dependencyResolution: remote_build   # or "bundled"
    container:
      resources:
        cpu: "0.5"
        memory: 1Gi
    environmentVariables:
      - name: AZURE_AI_MODEL_DEPLOYMENT_NAME
        value: ${AZURE_AI_MODEL_DEPLOYMENT_NAME}
    protocols:
      - protocol: responses
        version: 1.0.0
```

- `protocols` -- `responses`, `invocations`, `invocations_ws`. Editing requires `azd deploy`.
- `container.resources` -- valid tiers: `0.25/0.5Gi`, `1/2Gi`, `2/4Gi`.
- `environmentVariables` -- `${VAR}` resolves from the active azd env. Not for secrets.
- `codeConfiguration` present -> direct code deploy (ZIP, Foundry builds).
- `agentEndpoint` / `agentCard` -- patch in place with `azd ai agent endpoint update` (no new version).
- `deployments[]` (under the `ai-project` service) -- model deployments provisioned via Bicep. `name` is the literal Azure deployment resource name the agent references through `AZURE_AI_MODEL_DEPLOYMENT_NAME`.
- Connections/toolboxes -- created with `azd ai connection` / `azd ai toolbox` and consumed via a `TOOLBOX_<NAME>_MCP_ENDPOINT` env var (see [tools](../../create/references/tools.md)).

## State (azd env vars)

| Variable | Read by | Where to set |
|----------|---------|--------------|
| `AZURE_AI_PROJECT_ENDPOINT` | Every `azd ai agent` command | `azd env set` |
| `AZURE_AI_PROJECT_ID` | `azd ai agent show` (playground URL) | `azd env set` |
| `AZURE_SUBSCRIPTION_ID`, `AZURE_LOCATION` | `azd provision` | Always set with `azd env set ...` immediately after init |
| `AGENT_<SVC>_NAME` / `_VERSION` / `_<PROTO>_ENDPOINT` | Auto-written by deploy | Auto |
| `PARAM_<CONN>_<KEY>` | Connection credentials in `azure.yaml` | `azd env set` |

Manage with `azd env get-values`, `azd env set`, `azd env list`, `azd env new`, `azd env select`.

The platform also injects `FOUNDRY_*` and `AGENT_*` into the running container at runtime. **Never** put these in the agent service's `environmentVariables` section.

## Resolving subscription / location

`azd ai project show` returns only the Foundry project endpoint. For subscription / location, try in order:

1. `azd config get defaults`
2. `azd env get-values`
3. Ask the user.
4. Last resort, with explicit consent: `az account list --output json`.

For the Foundry project ARM ID (`--project-id`), ask the user: "New project, or use an existing one?" If existing, ask for the ID and hint where to find it (https://ai.azure.com -> Operate -> Admin). Do NOT shell out to `az cognitiveservices` -- it returns the wrong resource shape.

## Common error codes

- `not_logged_in` / `login_expired` -- ask the user to run `azd auth login`.
- `missing_project_endpoint` -- run `azd provision`, or `azd env set AZURE_AI_PROJECT_ENDPOINT <url>`.
- `project_not_found` -- cwd has no `azure.yaml`. Move to project root or run init.
- `invalid_agent_manifest` -- the agent service block is malformed. Run `azd ai agent doctor` and read the named field.
- `invalid_connection` -- inspect with `azd ai connection show <name>`.
- `eval_config_invalid` -- `eval.yaml` failed validation. Run `azd ai agent doctor`.
- `agent_definition_not_found` -- deployed name doesn't match `azure.yaml`. Re-deploy from project root.

Any unfamiliar `code` value is safe to surface verbatim to the user.
