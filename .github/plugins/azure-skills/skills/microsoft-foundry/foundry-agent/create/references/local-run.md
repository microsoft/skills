# Local Run Reference

Use this when iterating on a hosted agent before deploying.

> **Prerequisite:** Local run does NOT require `azd provision` or any deployed Azure infrastructure. The agent runs on your machine and calls the Foundry model endpoint directly using your local credentials (`DefaultAzureCredential` — falls back to `az login` / VS Code identity). You only need a `.env` file in the agent directory with:
> ```env
> FOUNDRY_PROJECT_ENDPOINT=https://<account>.services.ai.azure.com/api/projects/<project>
> AZURE_AI_MODEL_DEPLOYMENT_NAME=<model-deployment-name>
> ```
> If you already ran `azd provision`, extract these from `azd env get-values`.
>
> 🚦 **If no project endpoint is configured (not in the message, `azd env`, or `.env`) and the user hasn't asked to create one, stop and ask them to pick an existing project or confirm creating a new one — don't silently select or `azd provision` one.** Once they choose, follow [deploy.md Step 2](../../deploy/deploy.md#step-2----provision-azure-resources-one-time-per-env) to provision or resolve the project, then return here for local iteration before deploying the agent.
>
> **Critical: keep `.env` and `azd env` in sync.** `azd ai agent run` injects the active `azd env` values into the agent process before Python loads `.env`. Many samples use `load_dotenv(override=False)`, so an existing process environment value wins over `.env`. If you change the project endpoint or model deployment, update both `.env` and `azd env`:
> ```bash
> azd env set FOUNDRY_PROJECT_ENDPOINT "https://<account>.services.ai.azure.com/api/projects/<project>"
> azd env set AZURE_AI_MODEL_DEPLOYMENT_NAME "<model-deployment-name>"
> azd env get-values
> ```
> A stale `AZURE_AI_MODEL_DEPLOYMENT_NAME` in `azd env` can make local run call the wrong deployment even when `.env` is correct, commonly surfacing as a Foundry responses API `404 Not Found`.

## Prepare the local environment

For Python agents, prepare the environment from the **agent's service source directory** -- the folder that contains `requirements.txt` and the agent source (typically `<repo>/src/<service-name>/`, not the azd project root). `azd ai agent run` resolves the venv relative to this folder; a `.venv` created in the project root is ignored and azd silently creates a second one without `uv`.

1. `cd` into the service source directory.
2. Create a venv, for example `python -m venv .venv`.
3. Activate the venv.
4. Install `uv` inside the active venv: `python -m pip install uv`.
5. In the same shell with the service-dir `.venv` activated, run `azd ai agent run --no-client` (from any cwd in the project); it installs `requirements.txt` itself and uses `uv` from the active venv for faster Python dependency installation.

> **Important:** The venv must live next to `requirements.txt`, not in the azd project root. Install `uv` before running `azd ai agent run`, and keep that venv activated when running the command; otherwise the local run falls back to slower dependency installation. Do NOT manually run `pip install -r requirements.txt` / `uv pip install -r requirements.txt --prerelease=allow`; let `azd ai agent run` install dependencies.

## Start the agent locally

Activate the service-dir `.venv`, then in that venv run:

```bash
azd ai agent run --no-client
```

Use `--no-client` without prompting unless the user explicitly requests a local client UI. If a client is requested, omit the flag.

What this does:

1. Resolves the agent service from `azure.yaml` (auto-picks when only one exists).
2. Detects the project type (Python, .NET, or Node.js) from files in the service source dir.
3. Installs dependencies if needed. For Python, `azd ai agent run` installs `requirements.txt` itself and uses `uv` from the active local environment when available.
4. Starts the agent in the foreground on `localhost:8088` (default).
5. Opens no client when `--no-client` is set. Without that flag, responses and invocations agents open Agent Inspector.

> Wait for the ready log line before sending the first invocation. Poll the log at short intervals; do not pre-sleep on a fixed duration.

`Ctrl+C` stops the agent and clears the saved local session id in an interactive terminal.

For headless or CI runs, pass `--no-client` and start the local server in a managed background session that later steps can monitor and stop. Wait for the ready log line, invoke it from a second command, then stop the same background session before deploying or leaving a temporary workspace.

Do **not** start `azd ai agent run` as a detached process that you cannot monitor or stop (for example, a bare `azd ai agent run ... &`, or a popped PowerShell window on Windows). Keep logs, readiness polling, and the PID/process handle for cleanup.

## Useful flags

| Flag | Purpose |
|------|---------|
| `--port <n>` / `-p <n>` | Override the listen port. Useful when 8088 is taken. |
| `--start-command "<cmd>"` / `-c "<cmd>"` | Override `azure.yaml` and auto-detect. Example: `--start-command "python app.py"`. |
| `--no-client` | Skip the local client UI. Use by default unless the user requests a client UI. |

Pass the service name when there are multiple `ai.agent` services:

```bash
azd ai agent run my-agent --no-client
```

## Where the start command comes from

Resolution order (first non-empty wins):

1. `--start-command` flag.
2. `azure.yaml services.<name>.startupCommand`.
3. Auto-detected from project type.

Example:

```yaml
# azure.yaml
services:
  my-agent:
    project: src/my-agent
    language: python
    host: azure.ai.agent
    startupCommand: "uvicorn app:app --host 0.0.0.0 --port 4001"
```

If detection fails and no override is set, `run` errors with the project dir and asks for `--start-command` or `startupCommand`.

## Invoke the local agent

```bash
azd ai agent invoke --local "hello, are you up?"
```

For a multi-agent project, select the service explicitly:

```bash
azd ai agent invoke my-agent --local "hello, are you up?"
```

Prefer the named form when multiple agent services exist. Keep the unnamed form for a single-agent project.

Do not use `--output json` with invoke. The invoke command supports `default` and `raw` output only.

If the user did not explicitly specify a prompt, use `"hello, are you up"` for the local smoke test; only verify that the agent can return a response.

Run one representative local invocation before deploying. If the local invocation returns a model `404` or wrong deployment error, check `azd env get-values` before changing code; stale azd env values are the most common cause.

`--local` differs from a remote invoke in:

- Targets `http://localhost:<port>` instead of the Foundry endpoint.
- Targets localhost, so it does not authorize or bill a remote invocation.
- `--version` is rejected (versions are a remote concept).
- A name selects the intended service in a multi-agent project.

Other useful flags:

| Flag | Purpose |
|------|---------|
| `--protocol responses` (default) / `--protocol invocations` | Wire format your agent speaks. |
| `--input-file request.json` / `-f request.json` | Send a file body instead of a string message. |
| `--new-session` | Drop the saved local session and start fresh. |
| `--port <n>` | Match the port you started `run` with. |

After the local invocation completes, stop the `azd ai agent run` process you started before moving on.

## When to graduate to remote

Local dev validates code shape; remote validates infra + identity + Foundry binding. Move to deploy when:

- You changed the agent's `model`, `tools`, `connections`, or `protocols` in `azure.yaml`. Those only take effect on the deployed agent.
- You need to test against real Foundry connections (search indexes, Bing, MCP, A2A) that have no local mock.
- You are ready to publish a new immutable agent version.

Before proceeding to deploy, clean up the local agent process.

Next step -> [deploy/deploy.md](../../deploy/deploy.md).

## Common failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `could not connect to localhost:<port>` | `run` not started, or wrong port | Start `azd ai agent run --no-client`; pass `--port` to `invoke --local` if non-default. |
| `could not detect project type in <dir>` | Missing project marker file | Set `startupCommand` in `azure.yaml` or pass `--start-command`. |
| `cannot use --version with --local` | `--version` is remote-only | Drop `--version`, or remove `--local` to hit the deployed agent. |
| Older command uses `--no-inspector` | Deprecated compatibility alias | Replace it with `--no-client`. |
| Requested client never opens | Agent Inspector extension missing or localhost not ready | Install the Agent Inspector extension with `azd extension install azure.ai.inspector`, then run without `--no-client`. |
| Auth / connection errors against Azure services | Local credentials not wired | Expected -- `DefaultAzureCredential` falls back to your `az login` / VS Code identity. Use `azd auth login` if needed. |
