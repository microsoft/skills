# Connect and doctor

## Quick starts

- "Connect grounding to my existing Azure AI Search service."
- "Check whether my Search service has the roles and preview API a grounding index needs."
- "Which Search services can I use for grounding in this subscription?"

## Use this path

Use this path when a Search service already exists, or when you need to know why one is not ready. Everything here is read-only except saving the chosen endpoint in local state (no secrets).

## Steps

1. Confirm the tenant and subscription the CLI prints to stderr. `--tenant` and `--subscription` take a name or an ID; without `--tenant` the signed-in tenant is used. Pass `--subscription` for a service outside the default subscription. Never run `az account set`; it changes the default for every tool.
2. Run `grounding-provision doctor [--endpoint <url>]`. It prints a short summary of Entra auth, role gaps and `2026-11-01-preview` availability (`--json` for the full result). Without `--subscription` it finds the service in whichever subscription holds it.
3. List services with `grounding-provision connect`. Add `--service <name>` to select and save one, or `--no-save` to only inspect. `--endpoint <url>` targets a known service.
4. Re-run `doctor` against the saved endpoint.

## Roles

The signed-in identity needs Search Service Contributor, Search Index Data Contributor, and Search Index Data Reader. If one is missing, name it and say who must grant it. Do not assign roles yourself outside an approved `create` plan.

## Output

JSON on stdout (doctor: a short summary unless `--json`). Exit codes: 0 ok, 1 unexpected, 2 blocked, 3 auth, 4 service, 5 approval missing or mismatched. Errors look like `{"ok": false, "code": "...", "message": "...", "next_step": "..."}`; report `next_step` literally.

## Hand off

When `doctor` passes, give the endpoint to `grounding-build`. If there is no service, load the create path instead.
