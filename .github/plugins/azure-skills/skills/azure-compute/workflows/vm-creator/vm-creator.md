# Azure VM/VMSS Creator

Guided create-flow for Azure Virtual Machines (VMs) and VM Scale Sets (VMSS). Adapts to the user's expertise — beginners get sensible defaults; networking/spec/cost/security experts get the deep questions for their domain only — then emits the chosen artifact: az CLI bash, Bicep, Terraform, or live apply via Azure MCP.

## When to use

- User wants to **create / provision / deploy / spin up** a VM or VMSS (not just pick a SKU)
- User has a recommendation in hand and wants a deployable artifact
- User asks for a "create VM" script, template, or commands in az CLI, Bicep, or Terraform

> **Disambiguator.** If the user wants to deploy an **application** (Docker service, web app, API, function), route to `azure-prepare`. This workflow is for **bare VM/VMSS infrastructure** only.
> **Recommender first.** If the user has not picked a SKU yet ("what should I pick?"), pause and run [vm-recommender](../vm-recommender/vm-recommender.md) Steps 1–6 first, then resume here.

## Workflow

### Step 1 — Determine VM vs VMSS

If the user already said "VM" or "VMSS" / "scale set", use that. Otherwise: autoscaling, multiple identical instances, or stateless tier behind a load balancer → **VMSS**; everything else → **VM**. If unsure, default to single VM and ask one confirmation.

### Step 2 — Depth Probe

Classify the user's first 1–2 messages against the signal table in [depth-probe/index.md](references/depth-probe/index.md) and pick the highest-scoring branch:

| Branch | File |
|---|---|
| Beginner / fast-path | [beginner.md](references/depth-probe/beginner.md) |
| Networking-deep | [networking-deep.md](references/depth-probe/networking-deep.md) |
| Spec-deep | [spec-deep.md](references/depth-probe/spec-deep.md) |
| Cost-deep | [cost-deep.md](references/depth-probe/cost-deep.md) |
| Security-deep | [security-deep.md](references/depth-probe/security-deep.md) |

> Never ask a question whose answer can be inferred or safely defaulted. Batch silent inferences into the Plan Card so the user can see and edit them.

### Step 3 — Adaptive Gather

Ask **only** the questions from the matched branch's matrix. Use the defaults ladder when asking:

> *"NSG inbound rules — `[Recommended: SSH from your IP only]` / `[Show alternatives]` / `[I have specifics]`"*

Cross-branch follow-ups (once, after the primary branch):
- Resource group (existing or new — propose `<vm-name>-rg`)
- Tags (accept "none" without follow-up)
- VMSS only: instance count, orchestration mode (default **Flexible**)

If the user volunteers a deep signal mid-flow, append the relevant matrix questions for that topic. Do not restart.

### Step 4 — Validate

> **GATE — do not present the Plan Card until validation passes.**

Use the Azure MCP read-only tools listed in [validation-gates.md](references/validation-gates.md) (SKU exists in region / image is current / quota headroom / region availability). Required path; CLI fallback is documented in [mcp-tools.md](references/mcp-tools.md).

Outcomes:

| Result | Action |
|---|---|
| ✅ Sufficient | Proceed to Step 5 |
| ⚠️ Near limit (>80%) | Proceed but flag in Plan Card; suggest quota increase |
| ❌ Insufficient / SKU missing | Propose alternate SKU or region; do **not** generate output |

### Step 5 — Plan Card (with explicit-override fast path)

**Default path.** Render a single markdown table summarizing **every decision** (explicit answers + silent defaults). The user reads top-to-bottom and either approves or edits any row before output is generated. See [plan-card.md](references/plan-card.md) for the schema, example, and rendering rules.

Ask: *"Approve as-is, edit a row, or change output format?"* — do not generate until approved.

**Explicit-override fast path.** If the user's prompt combines (a) an explicit deliverable ("give me the Bicep", "just print the az CLI", "apply it via MCP") **and** (b) an explicit refusal of dialog ("no questions", "skip planning", "no plan", "just do it"), **respect them**. Skip the Plan Card table and the approval AskUserQuestion. Instead:

1. Emit a **single-line preview** that surfaces the high-signal decisions inline — e.g. *"→ Deploying `Standard_D2s_v5` in `eastus`, OS `Ubuntu2404`, NSG = your public IP only on 22, est. ~$70/mo."*
2. Immediately emit the requested artifact (Bicep / Terraform / az CLI / MCP apply).
3. Mention once, at the end, that the full Plan Card is available on request if they want to edit rows.

Step 4 validation gates (SKU / image / quota / region) still run on the fast path — they protect against broken artifacts, not user intent. If validation fails, fall back to the ❌ outcome in Step 4 (propose alternate SKU/region, do not generate output).

### Step 6 — Output Choice

Ask the user to pick one of four formats (or use the one they already specified):

| Format | When | Adapter |
|---|---|---|
| **az CLI bash** | Quick one-off, learning, copy-paste | [az-cli.md](references/output-adapters/az-cli.md) |
| **Bicep** | Repeatable IaC, production, ARM-native | [bicep.md](references/output-adapters/bicep.md) |
| **Terraform** | Existing TF state, multi-cloud | [terraform.md](references/output-adapters/terraform.md) |
| **Apply via Azure MCP** | "Just do it" — MCP connected, user trusts the Plan Card | [mcp-apply.md](references/output-adapters/mcp-apply.md) |

All four adapters consume the **same Plan Card parameter set** — switching format is a re-render, not a re-gather. For Apply via MCP, confirm one more time (the only destructive path) before calling `compute_vm_create` / `compute_vmss_create`.

### Step 7 — Delivery

> **Skip for Apply via MCP** — the artifact is the live deployment.

For `az CLI` / `Bicep` / `Terraform`, ask one final question: *where should it land?* See [delivery-options/index.md](references/delivery-options/index.md) for the decision logic. Three modes: [print](references/delivery-options/print.md), [save locally](references/delivery-options/save-local.md), [GitHub PR](references/delivery-options/github-pr.md).

If the user later says "also save it locally" or "open the PR now", re-run delivery with the cached Plan Card — **do not re-ask Plan Card questions**.

## Error handling

| Scenario | Action |
|---|---|
| Azure MCP not connected | Skip MCP pre-flight; warn that quota / SKU availability is unverified; offer CLI fallback |
| `compute_vm_list-skus` returns empty | Broaden filter (drop `familyPrefix`, lower `minVCpus`); if still empty, suggest another region |
| Quota insufficient | Show the gap; offer (a) smaller SKU, (b) different family, (c) different region, (d) quota-increase link |
| User wants Windows but supplies SSH key | Switch auth to password (with strength check) or RDP + cert; do not generate broken artifact |
| User asks "what was that az CLI again?" after picking Bicep | Re-render via Adapter 1; do not re-ask questions |
| Custom image / Shared Image Gallery | Pass full resource ID to `compute_vm_list-images`; do not try to map to an alias |
| User requests confidential / FedRAMP / HIPAA controls mid-flow | Append Security-deep questions; flag any defaults that fail the compliance bar |

## Routing back / handoff

| Situation | Route to |
|---|---|
| Deploy an **application** (not a bare VM) | `azure-prepare` skill |
| Reserve capacity *before* creating | [capacity-reservation](../capacity-reservation/capacity-reservation.md) |
| Enroll the new VM in management | [essential-machine-management](../essential-machine-management/essential-machine-management.md) |
| Compare more SKU / pricing options | [vm-recommender](../vm-recommender/vm-recommender.md) Steps 1–6 |
