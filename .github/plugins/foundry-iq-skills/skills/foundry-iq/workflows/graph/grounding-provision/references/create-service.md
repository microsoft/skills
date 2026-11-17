# Create a service

Already have a Search service? Use [connect and doctor](connect-and-doctor.md).

## Quick starts

- "Create a Basic Azure AI Search service in westus3 for grounding."
- "Show me the plan for creating a Search service named `earnings-search` in resource group `rg-grounding`."
- "I approve that plan; apply it."

## Use this path

Use this path only when the user has no suitable Search service. Ask for resource group, service name, and region; offer `--sku basic` as the default.

## Steps

1. State the tenant and subscription and confirm them.
2. Dry run: `grounding-provision create --resource-group <rg> --service-name <name> --location <region> --sku basic`. It writes nothing and prints the actions, a plan ID (`pln-` plus 16 hex characters), and an approval card.
3. Show the approval card verbatim, then ask one Approve/Stop question; never ask the user to type an ID.
4. Apply by re-running the same command with `--plan-id <plan_id>`. The plan is re-derived from the same inputs and refused on mismatch (exit 5). It is also bound to the tenant and subscription it was made under.
5. Run `grounding-provision doctor` against the new service.

## What it creates

A resource group and Search service if they do not exist, with local (key) auth disabled, plus the data-plane role assignments for the signed-in identity. There is no delete command.

## Known outcomes

- `no_op: true` means everything already exists; re-running is safe.
- `roles_assigned_awaiting_propagation` means role assignments can take minutes to appear; re-run `doctor` later.
- Regional capacity errors such as `InsufficientResourcesAvailable` are reported as-is. Pick another region and re-plan; this is a new plan ID.
