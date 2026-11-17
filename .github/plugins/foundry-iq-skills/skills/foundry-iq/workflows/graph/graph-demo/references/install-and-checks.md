# Install and checks

Use the shared [runtime setup](../../graph-guide/references/install-and-checks.md).

## Act 1 commands

Run these yourself, in the main conversation, in order, and say what each does first.
`<package-root>` is the plugin folder holding `graph` and `skills`, five folders above this
skill's folder. Resolve it once from the loaded skill's path and reuse it; never search the
disk or list plugins for it.

```text
python -I "<package-root>\graph\runtime\preflight.py"
az account show --query "{subscription:name, id:id, tenant:tenantId, tenantName:tenantDisplayName, user:user.name}" -o json
python -I "<package-root>\graph\runtime\bootstrap.py" run entity entity-graph-provision discover --tenant-id <tenant> --subscription-id <id> --json
```

Never hand these to subagents, read or import runtime source such as `bootstrap.py`, or write
your own probe scripts. If one fails, show its error and next step; for sign-in or access, run
`bootstrap.py run entity entity-graph-provision doctor`, which checks the current Azure CLI tenant.

## Preflight

Before provisioning or any Entity Graph write, run preflight directly for the user with an
existing Python 3.12, 3.13 or 3.14. It is the expected first step; run it without asking.
It is not read-only: it may prepare the plugin's runtimes in the plugin cache.
It never signs in or calls Azure. Grounding, when chosen at
intake, is set up in Act 2 ([grounding](grounding.md)).

Exit `1` / `blocked` stops the demo: show its results and `next_step`
([setup](../../graph-guide/references/install-and-checks.md#missing-prerequisites)).
`status: conditional` with `native.status: download_pending` is normal on a first run: the
Topic Graph executable is downloaded at the Topic Graph plan step, behind its own approval.
It runs on Windows and Linux (x64/arm64), not macOS.

Preflight doesn't see the source index. As soon as the physical content index exists,
delegate actual schema inspection to `topic-graph-build` (its `inspect`, see
[handoffs](handoffs.md#3-topics)) before advancing the demo. Topic Graph reads the original index directly, in place:
it needs a retrievable string key and stored, retrievable float32 vectors with an HNSW cosine or
dotProduct profile (`scalarQuantization`/`binaryQuantization` compression is fine). The executable's
own preflight checks that it can read the source.

## Subscription and models

Each leaf picks models only through `entity-graph-provision discover`. Don't list
subscriptions by default: intake item 2 offers the signed-in one by name. Only if the user
wants another, run `discover --tenant-id <tenant> --json` (every subscription they can see;
it can be long), ask for one by name, and show that list only if they ask.
`discover --subscription-id <id>` lists only usable chat and embedding deployments, by model
and region, with the ones the user holds a role on first; add `--all` only if they ask for
every resource. Show it as is and ask for the models by name. Map each choice to its `rows`
entry and pass the flags `discover --subscription-id <sub> --row <N> --discovery-id <id> --role <role>`
prints; never show row numbers. Never pick or guess for the user. If none fit, or the user
asks, create new ones: pass `--embedding-model <name> --chat-model <name>` to the resources
plan (the region's default version is used). Never run `az account set`; pass the subscription.

## Resources card

Create [new resources](../../entity-graph-provision/references/new-resources.md) (public
endpoints with Entra-only auth: RBAC, no keys, no IP rules), or use the user's own:
[connect existing](../../entity-graph-provision/references/connect-existing-resources.md).
Search goes in a region where the graph features are available; ask the user if unsure, and never pick one
yourself. Pass the region the user names as `--search-location`; without it, Search,
storage and models all use `--location` (default `westus3`). The plan checks the region,
quota, roles and what already exists, so look nothing up yourself: no `az role assignment
list`, `rbac-check`, other `az rest` calls or help text. Plan, apply and connect print a
short summary; don't add `--json` or parse their output with scripts. Use only Search
services this demo created or the user names; never list or suggest anyone else's.

Show every runtime approval card verbatim, then ask one Approve/Stop question unless Approve
all covers it ([intake](intake.md#then-show-the-plan-and-ask-once)); never write
your own approval text or ask the user to type an ID. If the question is cancelled, show the
card again. After approval, run the plan's `apply_command` in this conversation with
`initial_wait: 600` and wait for it. Apply also runs connect and prints the build flags.
No time estimates; status: [apply status](../../entity-graph-provision/references/apply-status.md).
