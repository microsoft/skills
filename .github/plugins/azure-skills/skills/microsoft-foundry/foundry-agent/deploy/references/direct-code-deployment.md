# Direct Code Deployment Reference

Use this reference only when the user explicitly requested direct code deployment.

This reference covers only direct-code deployment from [deploy.md](../deploy.md) Step 3. After deployment completes, proceed directly back to [deploy.md Step 7: Test the Agent](../deploy.md#step-7-test-the-agent).

Direct-code deployment uses local project files plus the Foundry REST API for upload and version operations. Azure MCP discovery and context lookup are optional context, not a prerequisite when project endpoint, model deployment, and agent name are already resolved. For the code upload itself, follow the REST endpoints below instead of the Docker/ACR `agent_update` path.

## Task 1: Preflight

Resolve the project endpoint from project context, `.env`, `azd env get-values`, or the user. The endpoint must look like:

```text
https://<account>.services.ai.azure.com/api/projects/<project>
```

Every direct-code REST call must use:

```http
Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview
```

This includes create/update/create-version, version polling, version listing, code download, and delete calls.

Get the token for this resource. Do not use the Cognitive Services token resource for direct-code REST calls:

```text
https://ai.azure.com
```

Direct-code REST caller prerequisite: the signed-in user or service principal must have `Azure AI User` or a higher role on the Foundry project.

Global direct-code limits:

- Agent name: at most 63 characters, alphanumeric and hyphens only.
- Multipart upload zip: at most 250 MB.
- CPU/memory: use conservative defaults such as `0.5` CPU and `1Gi` when the project does not specify resources.

## Task 2: Detect Runtime and Entry Point

Scan only the selected agent root.

| Project Type | Detection | Runtime | Entry point |
|--------------|-----------|---------|-------------|
| Python | `main.py` plus `requirements.txt` | `python_3_13` or `python_3_14` | `["python", "main.py"]` |
| C#/.NET | exactly one `*.csproj` or user-selected project file | `dotnet_8`, `dotnet_9`, or `dotnet_10` | `["dotnet", "<AssemblyName>.dll"]` |

For Python, prefer a supported runtime explicitly declared in `agent.yaml`/`agent.manifest.yaml` or provided by the user. If none is declared, use `python_3_13`. Do not use `python_3_11` or `python_3_12` for this preview path; if a manifest declares either one, warn and choose `python_3_13` unless the user selects another supported runtime.

For .NET, derive the runtime from the project `TargetFramework`:

| TargetFramework | Runtime |
|-----------------|---------|
| `net8.0` | `dotnet_8` |
| `net9.0` | `dotnet_9` |
| `net10.0` | `dotnet_10` |

If the target framework is missing or does not map to a supported runtime, ask instead of guessing.

For .NET, derive `<AssemblyName>` from `<AssemblyName>` in the `.csproj` when present; otherwise use the `.csproj` file stem. Never use `["dotnet", "run", ...]` for direct code deployment. The runtime environment has the .NET runtime, not the SDK, and `dotnet run` fails with `No .NET SDKs were found`.

## Task 3: Collect Direct-Code Configuration

Ask only for values not already resolved:

- `projectEndpoint`
- `agentName` - prefer `agent.yaml` or `agent.manifest.yaml` name, then folder name
- model deployment environment variable, usually `AZURE_AI_MODEL_DEPLOYMENT_NAME`
- CPU and memory - prefer `agent.yaml` resources, otherwise use conservative defaults (`0.5` CPU, `1Gi` memory)
- protocol/version - prefer `agent.yaml` protocols, otherwise `responses` `1.0.0`

Do not put `FOUNDRY_PROJECT_ENDPOINT` in `environment_variables`; the platform injects it for hosted agents. Include only custom variables that the agent code reads at runtime, such as `AZURE_AI_MODEL_DEPLOYMENT_NAME`.

### Dependency Packaging Mode

Use remote dependency packaging by default (`dependency_resolution: "remote_build"` in `metadata.json`). In this mode, upload source files plus dependency manifests such as `requirements.txt` or `.csproj`; Foundry installs dependencies during the remote build.

Use bundled local dependencies only when the user explicitly asks for it. In bundled mode, package Linux-compatible dependencies that match the selected runtime.

For remote packaging, keep the user's dependency files unchanged. Do not slim, pin, or remove packages just to make deployment smoother. If the service fails while installing dependencies, report the exact error and ask before changing dependencies.

## Task 4: Create `metadata.json`

Create the parent directory and write `.foundry/direct-code/metadata.json`. Do not write `metadata.json` before the parent directory exists.

Use the user's platform or language tooling. For example, Python works consistently across common shells:

```python
from pathlib import Path

metadata = Path(".foundry/direct-code/metadata.json")
metadata.parent.mkdir(parents=True, exist_ok=True)
# Build the JSON object, then write it to metadata.
```

Example Python metadata:

```json
{
  "description": "Direct code deployment hosted agent",
  "definition": {
    "kind": "hosted",
    "protocol_versions": [
      {
        "protocol": "responses",
        "version": "1.0.0"
      }
    ],
    "cpu": "0.5",
    "memory": "1Gi",
    "environment_variables": {
      "AZURE_AI_MODEL_DEPLOYMENT_NAME": "<model-deployment>"
    },
    "code_configuration": {
      "runtime": "python_3_13",
      "entry_point": ["python", "main.py"],
      "dependency_resolution": "remote_build"
    }
  }
}
```

Example C#/.NET metadata:

```json
{
  "description": "Direct code deployment C# hosted agent",
  "definition": {
    "kind": "hosted",
    "protocol_versions": [
      {
        "protocol": "responses",
        "version": "1.0.0"
      }
    ],
    "cpu": "0.5",
    "memory": "1Gi",
    "environment_variables": {
      "AZURE_AI_MODEL_DEPLOYMENT_NAME": "<model-deployment>"
    },
    "code_configuration": {
      "runtime": "dotnet_10",
      "entry_point": ["dotnet", "<AssemblyName>.dll"],
      "dependency_resolution": "remote_build"
    }
  }
}
```

## Task 5: Create a Flat Code Zip

The zip must be flat at the root. Do not include a top-level wrapper folder such as `my-agent/`. The entry point path in `metadata.json` must resolve from the zip root.

Before upload, inspect the archive entries and verify the required files are at the zip root. A wrapper folder, raw wheel files, Windows binaries, or a published output nested under `publish/` will usually fail at version build or session startup.

Exclude local/development artifacts:

```text
.env
.foundry/
.git/
.vscode/
.venv/
__pycache__/
bin/
obj/
Dockerfile
.dockerignore
docker-compose.yml
Properties/launchSettings.json
```

### Remote Packaging (Default)

The examples below use Python's `zipfile` module so they work across common shells and operating systems. Use equivalent platform zip tooling if Python is unavailable.

Python remote-packaging zip should include `main.py`, `requirements.txt`, and any imported local source modules/packages needed by the entry point. Do not include `packages/`; the service installs dependencies from `requirements.txt`.

```python
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

zip_path = Path(".foundry/direct-code/agent-code.zip")
zip_path.parent.mkdir(parents=True, exist_ok=True)
files = ["main.py", "requirements.txt"]

with ZipFile(zip_path, "w", ZIP_DEFLATED) as zf:
    for name in files:
        path = Path(name)
        if path.exists():
            zf.write(path, name)
```

C#/.NET remote-packaging zip should include the project file, source files, and appsettings files. Do not include `bin/`, `obj/`, `.env`, Docker assets, or local launch settings. The `.csproj` `TargetFramework` must match the selected `dotnet_*` runtime.

```python
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

zip_path = Path(".foundry/direct-code/agent-code.zip")
zip_path.parent.mkdir(parents=True, exist_ok=True)
files = ["StorytellerAgent.csproj", "Program.cs", "appsettings.json", "appsettings.Development.json"]

with ZipFile(zip_path, "w", ZIP_DEFLATED) as zf:
    for name in files:
        path = Path(name)
        if path.exists():
            zf.write(path, name)
```

### Bundled Local Dependencies (Only When Requested)

Bundled Python zip should include `main.py`, `requirements.txt`, and a `packages/` directory containing extracted Linux-compatible modules. Do not include raw `.whl` files, Windows `.pyd`/`.dll` binaries, or packages built without the target Linux platform flags.

```text
python -m pip install -r requirements.txt --target packages --platform manylinux2014_x86_64 --python-version 3.13 --implementation cp --only-binary=:all:
```

Match `--python-version` to the selected `python_*` runtime and avoid Windows binaries.

Bundled .NET zip is the output of `dotnet publish -c Release -r linux-x64 --self-contained false`, rooted directly at the publish output. It should contain `<AssemblyName>.dll`, `<AssemblyName>.runtimeconfig.json`, and the rest of the publish output at the zip root, not inside a `publish/` wrapper folder.

```text
dotnet publish -c Release -r linux-x64 --self-contained false -o publish
```

Then create the zip from the publish output:

```python
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path("publish")
zip_path = Path(".foundry/direct-code/agent-code.zip")
zip_path.parent.mkdir(parents=True, exist_ok=True)

with ZipFile(zip_path, "w", ZIP_DEFLATED) as zf:
    for path in root.rglob("*"):
        if path.is_file():
            zf.write(path, path.relative_to(root).as_posix())
```

## Task 6: Upload Code and Create or Update the Agent

Use the user's current platform and shell syntax. The examples below use literal placeholders and can be translated to any shell or HTTP client. Always keep `?api-version=...` in the final request URL.

Resolve these values:

- `<project-endpoint>`
- `<agent-name>`
- `<metadata-json>` - usually `.foundry/direct-code/metadata.json`
- `<code-zip>` - usually `.foundry/direct-code/agent-code.zip`
- `<access-token>` - from `az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv`
- `<code-sha256>` - SHA-256 of the zip file

Calculate the zip SHA-256 with any platform tool. Python example:

```python
import hashlib
from pathlib import Path

with Path(".foundry/direct-code/agent-code.zip").open("rb") as f:
    print(hashlib.sha256(f.read()).hexdigest())
```

Use `<project-endpoint>` as the base URL. Append paths directly to that project endpoint; do not strip `/api/projects/<project>` from it.

Direct-code deployment uses these REST operations:

| Purpose | Method and endpoint | When to use |
|---------|---------------------|-------------|
| Check whether the agent exists | `GET <project-endpoint>/agents/<agent-name>?api-version=2025-11-15-preview` | Run first. `404` means create the agent; `200` means deploy a new version by default |
| Create a new agent | `POST <project-endpoint>/agents?api-version=2025-11-15-preview` | Use only when the existence check returned `404` |
| Create a new version for an existing agent | `POST <project-endpoint>/agents/<agent-name>/versions?api-version=2025-11-15-preview` | Default path when the agent already exists |
| Update an existing agent in place | `POST <project-endpoint>/agents/<agent-name>?api-version=2025-11-15-preview` | Use only when the user explicitly asks for an in-place update |

If any GET/POST returns `Missing required query parameter: api-version`, the request URL was malformed. Fix the URL construction and retry the same REST call before continuing; do not interpret that response as "agent exists", "agent missing", or a version/build problem.

All write requests use `multipart/form-data` with:

- `metadata`: the JSON metadata file, content type `application/json`
- `code`: the flat zip file, content type `application/zip`, with `filename=<agent-name>.zip`
- `x-ms-code-zip-sha256`: SHA-256 of the zip file

Create-agent request shape:

```http
POST <project-endpoint>/agents?api-version=2025-11-15-preview
Authorization: Bearer <access-token>
Accept: application/json
Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview
x-ms-agent-name: <agent-name>
x-ms-code-zip-sha256: <code-sha256>
Content-Type: multipart/form-data

metadata=<metadata-json file>; type=application/json
code=<code-zip file>; type=application/zip; filename=<agent-name>.zip
```

Create-version request shape:

```http
POST <project-endpoint>/agents/<agent-name>/versions?api-version=2025-11-15-preview
Authorization: Bearer <access-token>
Accept: application/json
Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview
x-ms-code-zip-sha256: <code-sha256>
Content-Type: multipart/form-data

metadata=<metadata-json file>; type=application/json
code=<code-zip file>; type=application/zip; filename=<agent-name>.zip
```

Do not send `x-ms-agent-name` on `POST /agents/<agent-name>/versions` or `POST /agents/<agent-name>`. Send it only on `POST /agents` because the agent name is not in that route.

Update agent and create version are idempotent on zip SHA-256 plus agent definition. If both are unchanged from the latest version, the service can return the existing version instead of creating a duplicate. To force a new version, change the zip contents or definition.

Other useful REST operations:

| Purpose | Method and endpoint | Notes |
|---------|---------------------|-------|
| List versions | `GET <project-endpoint>/agents/<agent-name>/versions?api-version=2025-11-15-preview` | Use when the write response does not clearly return a version |
| Download code | `GET <project-endpoint>/agents/<agent-name>/code:download?api-version=2025-11-15-preview` | Add `agent_version=<n>` when downloading a specific version; compare the `x-ms-code-zip-sha256` response header with the local SHA |
| Delete agent | `DELETE <project-endpoint>/agents/<agent-name>?api-version=2025-11-15-preview` | Deletes the agent and all versions; pull logs before deletion if needed |

## Task 7: Poll Version Status

Use the version from the create/version response. If the response does not clearly include it, list versions and pick the newest version returned for the agent.

```http
GET <project-endpoint>/agents/<agent-name>/versions/<version>?api-version=2025-11-15-preview
Authorization: Bearer <access-token>
Foundry-Features: CodeAgents=V1Preview,HostedAgents=V1Preview
```

Loop until the version status is no longer `creating`.

- `active` -> proceed directly back to [deploy.md Step 7: Test the Agent](../deploy.md#step-7-test-the-agent).
- `failed` -> read the error from the version object. There is no runtime session yet, so `:logstream` will not help.
