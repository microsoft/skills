# Grounding provision

First read [runtime setup](../graph-guide/references/install-and-checks.md#plugin-and-clis); use its `run <domain>` launcher.

The demo and Entity Graph builds reuse the Search service from `entity-graph-provision`; use it. This skill is for a standalone grounding service.

Load one path only.

| Intent | Load |
|---|---|
| Pick an existing Search service, or check roles and preview API readiness | [Connect and doctor](references/connect-and-doctor.md) |
| Create a resource group and Search service for grounding | [Create a service](references/create-service.md) |

## Shared rules

Standalone creation supports [run naming](../graph-guide/references/run-naming.md): use `--run-name` or the resolved `--run-prefix`, retaining `--run-state-dir` for approval/apply. Missing group and service names default from that prefix; existing explicit names are retained.

Run read-only `grounding-provision doctor` first. If it reports no endpoint, or skips or blocks a check, follow [prerequisites](../graph-guide/references/install-and-checks.md#missing-prerequisites) instead of its raw `next_step`. State the tenant and subscription before any Azure call; the CLI prints both to stderr, and `--tenant` aborts on mismatch. Entra auth only: never request, pass, or store keys.

Writes stay on the CLI. `grounding-provision create` is a dry run: show its runtime `approval` card verbatim, ask one Approve/Stop question, then re-run it with `--plan-id <id>`; never write or paraphrase your own approval text, never promise behavior the plan doesn't state, never ask the user to type an ID, and no raw `az`/REST workarounds; when the CLI blocks, stop and report the blocker. Ask the user to choose the service when connecting. Never delete anything. Report role gaps and who must grant them. When the service is ready, hand off to `grounding-build` with the saved endpoint.
