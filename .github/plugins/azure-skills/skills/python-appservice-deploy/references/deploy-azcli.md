# Deploy via `az` CLI

Use this path when there is **no** `azure.yaml` or it doesn't target `appservice`.

> ⛔ **NEVER USE `az webapp up`** — this command is deprecated. Use the explicit create + deploy commands below.

## Prerequisites

- Verify the latest stable Azure CLI is installed ([installation/update guide](https://learn.microsoft.com/cli/azure/install-azure-cli-windows?pivots=winget)).
- `az login` complete
- Subscription, resource group, region, and app name decided (see [create-app.md](create-app.md))
- App Service Plan (Linux, P0v3) and Web App (Python runtime) exist (see [create-app.md](create-app.md))

## 1. Enable server-side build

```bash
az webapp config appsettings set \
  -n <app> -g <rg> \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true
```
```powershell
az webapp config appsettings set `
  -n <app> -g <rg> `
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

This tells Oryx to run `pip install -r requirements.txt` during deploy.

## 2. Startup command — skip for Flask/Django, always set for FastAPI

Azure App Service (Oryx) auto-detects **Flask** and **Django** — **do not set a startup command** for these. Skip this step entirely.

For **FastAPI**, always set the uvicorn startup command, regardless of the Python runtime version. This skill does **not** rely on Oryx FastAPI auto-detection, so the behavior is identical on every supported runtime (3.12, 3.13, 3.14, …):

```bash
az webapp config set -n <app> -g <rg> \
  --startup-file "python -m uvicorn main:app --host 0.0.0.0"
```
```powershell
az webapp config set -n <app> -g <rg> `
  --startup-file "python -m uvicorn main:app --host 0.0.0.0"
```

(Replace `main:app` if the FastAPI entry point differs — e.g., `app.main:app`.)

For other frameworks (generic WSGI / ASGI / unknown), **skip this step** and emit the manual-startup warning. See [startup-commands.md](startup-commands.md).

## 3. Package the code

For Django remote builds, require `STATIC_ROOT` and successful `python manage.py check` and `python manage.py collectstatic --noinput` before packaging.

### Normalize Linux scripts

Before every deployment/redeployment, explicitly select shipped `.sh` files, text executables with a shebang, and referenced startup scripts. Exclude binaries and dependency folders. From the application/service root, replace the example path below with the selected files; skip only if none exist.

This command works in Bash and PowerShell, preserves encoding/permissions, normalizes CRLF/lone CR, then re-reads bytes to verify LF:

```bash
python -c "import sys; from pathlib import Path
for name in sys.argv[1:]:
    p = Path(name)
    data = p.read_bytes()
    if b'\0' in data: raise ValueError(p)
    lf = data.replace(b'\r\n', b'\n').replace(b'\r', b'\n')
    if lf != data: p.write_bytes(lf)
    if b'\r' in p.read_bytes(): raise ValueError(p)
" "./startup.sh"
```

Immediately check the result **in the same shell call** before packaging:

```bash
if [ "$?" -ne 0 ]; then exit 1; fi
```

```powershell
if (-not $? -or $LASTEXITCODE -ne 0) { throw "LF normalization/validation failed" }
```

### Create a fresh ZIP

Package only after normalization/validation succeeds. Stop on any failure; deployment requires successful packaging, not merely an existing archive.

Zip the project (excluding venv, caches, git, node_modules):

```bash
# bash
rm -f app.zip || exit 1
zip -r app.zip . \
  -x ".git/*" -x ".venv/*" -x "venv/*" -x "__pycache__/*" \
  -x "*.pyc" -x ".env" -x "node_modules/*" -x "app.zip" \
  || { rm -f app.zip; exit 1; }
```

```powershell
# PowerShell
if (Test-Path app.zip) { Remove-Item app.zip -ErrorAction Stop }
$exclude = @('.git','.venv','venv','__pycache__','node_modules','app.zip')
$items = Get-ChildItem -Force -ErrorAction Stop | Where-Object { $exclude -notcontains $_.Name }
try {
    Compress-Archive -Path $items -DestinationPath app.zip -Force -ErrorAction Stop
} catch {
    if (Test-Path app.zip) { Remove-Item app.zip -ErrorAction Stop }
    throw
}
```

## 4. Deploy the zip

Proceed only if normalization, validation and ZIP creation all succeeded in this attempt. Never deploy a stale/partial archive or continue after a failed packaging call.

```bash
az webapp deploy \
  -n <app> -g <rg> \
  --src-path app.zip \
  --type zip \
  --track-status false \
  --enriched-errors true
```
```powershell
az webapp deploy `
  -n <app> -g <rg> `
  --src-path app.zip `
  --type zip `
  --track-status false `
  --enriched-errors true
```

Do not use `--only-show-errors` or suppress enriched diagnostics. Report failures with suggested fixes and the Copilot prompt, not success.

> 💡 `--track-status false` returns once the ZIP is **accepted by the SCM endpoint** — this is **not** the same as "Oryx build succeeded". The server-side `pip install` / startup-command rendering happens asynchronously after the CLI returns. A zero exit code only confirms the upload + a deployment record. If the site never starts, inspect the build outcome via `az webapp log deployment list/show` — that is the only authoritative confirmation that the build itself succeeded.

## 5. Stop. Report the endpoint to the user.

After `az webapp deploy` returns, the skill is done.

> ℹ️ `az webapp deploy` does **not** initiate a cold start by pinging the site. With `--track-status false`, it returns as soon as the SCM endpoint accepts the ZIP; the Oryx build and container restart happen asynchronously on the SCM side. The container only warms up when an inbound HTTP request actually hits `https://<app>.azurewebsites.net` — which is why the post-deploy message tells the user to expect a 2–3 minute wait on their first visit.

> ⛔ **Do NOT run** `az webapp log tail`, `curl`, `Invoke-WebRequest`, `wget`, or any other "verify startup" command. App Service routinely needs **2–3 minutes** to warm the container; a quiet log stream or a 5xx in the first couple of minutes is **not** a failure signal, and running these probes here will mislead the user.

Resolve the host name without hitting the site:

```bash
HOST=$(az webapp show -n <app> -g <rg> --query defaultHostName -o tsv)
echo "https://$HOST"
```
```powershell
$host_ = az webapp show -n <app> -g <rg> --query defaultHostName -o tsv
"https://$host_"
```

Then print the post-deploy message from [post-deploy-message.md](post-deploy-message.md) and end the turn. The user will run `az webapp log tail -n <app> -g <rg>` themselves if they want to watch logs.

## Common pitfalls

| Pitfall | Fix |
|---------|-----|
| Deployed code missing dependencies | `SCM_DO_BUILD_DURING_DEPLOYMENT=true` not set — re-run step 1 then redeploy |
| Container ping timeout on port 8000 | Wrong startup command — see [startup-commands.md](startup-commands.md) |
| Zip too large (>500 MB) | Exclude `.venv`, caches; consider `.deployment` `.gitignore`-style file |
| `webapp up` examples in older docs | Replace with `az webapp create` + `az webapp deploy` (this file) |
