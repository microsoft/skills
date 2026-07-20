# Manage Foundry Routines (azd ai routine)

Create, read, update, and delete Microsoft Foundry **routines** with the Azure Developer CLI (`azd`). A routine pairs a trigger (timer, recurring schedule, GitHub issue, or custom external event) with an action that invokes a Foundry agent. Use only the `azd` path for routine work: imperative `azd ai routine` commands or declarative `host: azure.ai.routine` services in `azure.yaml`.

> **Preview.** Routines ship in the `azure.ai.routines` azd extension. The command surface is `azd ai routine <verb>`; do not use Foundry MCP tools, REST, or SDK for routine CRUD in this skill.

## Quick Reference

| Property | Value |
|----------|-------|
| Primary CLI | `azd ai routine` (extension `azure.ai.routines`) |
| Install extension | `azd extension install azure.ai.routines` |
| CRUD verbs | `create`, `list`, `show`, `update`, `delete` |
| Routine operations | `enable`, `disable`, `dispatch`, `run list` |
| Declarative form | `azure.yaml` service with `host: azure.ai.routine`, upserted by `azd deploy` / `azd up` |
| Agent prompt/input | Set `action.input` in a routine manifest or `azure.yaml`; use a string for the agent `responses` protocol and the target payload for the agent `invocations` protocol. `azd ai routine create` flags do not include `--input` |
| Project endpoint | `--project-endpoint`, then `AZURE_AI_PROJECT_ENDPOINT`, global `azd ai project set`, then `FOUNDRY_PROJECT_ENDPOINT` |
| Output format | `--output json` or `--output table` (default) |

## When to Use This Skill

- Schedule an agent on a one-shot timer or recurring cron schedule.
- Trigger an agent from a GitHub issue event or custom external event.
- List, inspect, update, enable, disable, dispatch, or delete existing routines.
- Manage routines declaratively in `azure.yaml` so `azd up` / `azd deploy` keeps them in sync.

> A routine **references an agent**; it does not create one. Deploy or identify the target agent first (see [deploy](../deploy/deploy.md) / [create](../create/create-hosted.md)), then attach a routine to it.

## Workflow

### Step 1 - Verify the environment

Before any routine command, run the shared verification script to confirm `azd`, `az`, auth, and the base Foundry extensions are ready:

```bash
../create/scripts/verify-environment.sh     # macOS / Linux
../create/scripts/verify-environment.ps1    # Windows (pwsh)
```

Act on the summary prefixes:

- `[OK]` - nothing to do.
- `[WARN]` - non-blocking; continue.
- `[ACTION]` - resolve first, then rerun the script. Never run `az login` or `azd auth login` for the user; stop and ask them to log in manually. Missing base extensions (`azure.ai.agents`, `azure.ai.projects`, `microsoft.foundry`) can be installed with `azd extension install <name>`.

Do not continue while any `[ACTION]` remains.

### Step 1b - Check the routines extension

The shared script does not check `azure.ai.routines`. Confirm it is installed:

```bash
azd extension list --installed --output json
```

If missing, install it (ask first in interactive mode; install directly in non-interactive mode):

```bash
azd extension install azure.ai.routines
```

Verify the command surface:

```bash
azd ai routine --help
```

If `azd ai routine` reports an unknown command after install, the azd core is too old. The extension requires `azd >= 1.27.0`; upgrade azd (<https://aka.ms/azd-install>) and retry.

### Step 2 - Resolve the Foundry project endpoint

Every routine command targets a Foundry project endpoint. `azd ai routine` resolves it in this order:

1. `-p` / `--project-endpoint <url>` on the command.
2. Active azd environment `AZURE_AI_PROJECT_ENDPOINT` (`azd env get-values`).
3. Global config from `azd ai project set <endpoint>`.
4. `FOUNDRY_PROJECT_ENDPOINT` environment variable.
5. Otherwise the command fails with a missing-endpoint error.

Prefer the azd env inside an azd project. Otherwise set it once:

```bash
azd env set AZURE_AI_PROJECT_ENDPOINT "https://<account>.services.ai.azure.com/api/projects/<project>"
# or, outside an azd project:
azd ai project set "https://<account>.services.ai.azure.com/api/projects/<project>"
```

The endpoint host must end with `.services.ai.azure.com` and use `https` with no explicit port.

## Two Ways to Create a Routine

A routine is the same Foundry resource — keyed by its name — no matter how you create it. Both paths go through `azd` and act on that same named resource, so a routine created one way can later be managed the other way. Declarative `azd deploy` always upserts idempotently; imperative `azd ai routine create` refuses to overwrite an existing routine unless you pass `--force`. Pick a path, then read its reference doc for exact examples.

### Way 1 — Imperative: `azd ai routine create`

Create the routine directly against the Foundry project with a single command — flags, or a `--file` manifest when it must carry a stored prompt/payload (`action.input`; there is no `--input` flag). Best for one-off scheduling, quick experiments, ad-hoc CRUD, and working **outside** an azd project — no `azure.yaml` required. → [CLI CRUD and Operations](references/cli-crud.md)

### Way 2 — Declarative: `azure.yaml` + `azd deploy`

Declare the routine as a `host: azure.ai.routine` service in `azure.yaml`, then let `azd deploy` / `azd up` upsert it. Best when the routine should be **versioned with the agent in source control** and **reproduced per azd environment** — GitOps, multi-env, CI/CD. → [Declarative Routines](references/azure-yaml.md)

### Which path?

| Situation | Path |
|-----------|------|
| One-off schedule, quick experiment, or no `azure.yaml` in play | Way 1 — imperative |
| Routine versioned with the agent, reproduced per environment, GitOps / CI/CD | Way 2 — declarative |
| Unsure and already in an azd project with the agent | Way 2 — declarative keeps the routine and agent in sync |

Read, update, enable/disable, manually dispatch, inspect past runs, and delete are imperative-only operations that work on a routine regardless of how it was created — see [CLI CRUD and Operations](references/cli-crud.md).

## Error Handling

| Symptom | Cause | Resolution |
|---------|-------|------------|
| `unknown command "routine"` / `unknown command "ai"` | Extension not installed or azd too old | `azd extension install azure.ai.routines`; ensure `azd >= 1.27.0` |
| Missing project endpoint error | No endpoint resolved | Set `AZURE_AI_PROJECT_ENDPOINT`, run `azd ai project set <url>`, or pass `-p <url>` |
| `routine "<name>" already exists` on create | Name collision | Re-run with `--force` to upsert, or choose a different name |
| `--trigger cannot be changed on an existing routine` (same for `--action`) | Trigger/action type is immutable | Delete then create with the new type |
| `--force is required when --no-prompt is set` on delete | Non-interactive delete without confirmation | Add `--force` |
| `routine "<name>" not found` | Wrong name or wrong project | Check the name and resolved endpoint with `show` / `list` |
| `host "..." is not a recognized Foundry host` | Endpoint host invalid | Use `https://<account>.services.ai.azure.com/api/projects/<project>` (no port) |
| `json: cannot unmarshal number into Go struct field Routine.created_at of type string` | The routines extension could not decode a routine response after the service call | Do not assume the operation failed. Check with `show <name>` and `list`; if both decode badly, the routine may exist but cannot be decoded by the current extension. |
| Network isolation / `PublicNetworkAccessDisabled` / `403` | Project has public access disabled | See [Network Isolation Errors](../../SKILL.md#network-isolation-errors) |

## Additional Resources

- [CLI CRUD and Operations](references/cli-crud.md)
- [Declarative Routines](references/azure-yaml.md)
- [azd ai CLI Reference](../azd-guidance/references/azd-ai-cli.md)
- [Deploy a Foundry Agent](../deploy/deploy.md) - deploy the agent a routine will invoke
- [Invoke a Foundry Agent](../invoke/invoke.md) - smoke-test the agent before scheduling it
- [Microsoft Foundry Skill (index)](../../SKILL.md)
