# Continuous Evaluation

Enable, configure, disable, or remove continuous evaluation for a Foundry agent. Continuous evaluation automatically assesses agent responses on an ongoing basis using configured evaluators (e.g., groundedness, coherence, violence detection). This is typically the final step in the [observe loop](../observe.md) after deploying and batch-evaluating an agent — it keeps production quality visible without manual intervention.

## When to Use This Skill

USE FOR: enable continuous evaluation, disable continuous evaluation, configure continuous eval, set up monitoring evaluators, check continuous eval status, delete continuous eval, update evaluators, change sampling rate, change eval interval, production monitoring, ongoing agent quality.

DO NOT USE FOR: running a one-off batch evaluation (use [observe](../observe.md)), querying traces (use [trace](../../trace/trace.md)), creating evaluator definitions (use [observe](../observe.md) Step 1).

## Quick Reference

| Property | Value |
|----------|-------|
| MCP server | `azure` |
| Key MCP tools | `continuous_eval_create`, `continuous_eval_get`, `continuous_eval_delete`, `agent_get`, `evaluation_get` |
| Prerequisite | Agent must exist in the project |
| Local cache | `.foundry/agent-metadata.yaml` |

## Entry Points

| User Intent | Start At |
|-------------|----------|
| "Enable continuous eval" / "Set up monitoring evaluators" | [Before Starting](#before-starting--detect-current-state) → [Enable or Update](#enable-or-update) |
| "Is continuous eval running?" / "Check eval status" | [Before Starting](#before-starting--detect-current-state) → [Check Current State](#check-current-state) |
| "Change evaluators" / "Update sampling rate" | [Before Starting](#before-starting--detect-current-state) → [Check Current State](#check-current-state) → [Enable or Update](#enable-or-update) |
| "Pause evaluations" / "Disable continuous eval" | [Before Starting](#before-starting--detect-current-state) → [Disable](#disable) |
| "Stop evaluating this agent" / "Delete continuous eval" | [Before Starting](#before-starting--detect-current-state) → [Delete](#delete) |
| "Scores are dropping" / "Act on monitoring results" | [Before Starting](#before-starting--detect-current-state) → [Acting on Results](#acting-on-results) |

> ⚠️ **Important:** Always run [Before Starting](#before-starting--detect-current-state) to resolve the project endpoint and agent name before calling any MCP tools.

## Before Starting — Detect Current State

1. Resolve the target agent root and environment using the [Common Project Context Resolution](../../../SKILL.md#agent-common-project-context-resolution) workflow.
2. Extract `projectEndpoint` and `agentName` from the selected environment. If not available in metadata, use `ask_user` to collect them.
3. Use `agent_get` to verify the agent exists and note its kind (prompt or hosted).
4. Use `continuous_eval_get` to check for existing continuous evaluation configuration.
5. Jump to the appropriate entry point based on user intent.

## How It Works

The tool auto-detects the agent's kind and uses the appropriate backend:

- **Prompt agents** — evaluation runs are triggered automatically each time the agent produces a response. Parameters: `samplingRate` (percentage of responses to evaluate), `maxHourlyRuns`.
- **Hosted agents** — evaluation runs are triggered on an hourly schedule, pulling recent traces from App Insights. Parameters: `intervalHours` (hours between runs), `maxTraces` (max data points per run).

The user does not need to choose between these — the tool handles it based on agent kind.

## Behavioral Rules

1. **Always resolve context first.** Run [Before Starting](#before-starting--detect-current-state) before calling any MCP tool. Never assume a project endpoint or agent name.
2. **Check before creating.** Always call `continuous_eval_get` before `continuous_eval_create` to determine whether to create or update. Present existing configuration to the user.
3. **Confirm evaluator selection.** Present the evaluator list to the user before enabling. Distinguish quality evaluators (require `deploymentName`) from safety evaluators (do not).
4. **Prompt for next steps.** After each operation, present options. Never assume the path forward (e.g., after enabling, offer to check status or adjust parameters).
5. **Keep context visible.** Include the project endpoint, agent name, and environment in operation summaries.
6. **Use `continuous_eval_get` for IDs.** The `delete` tool requires a `configId` — always retrieve it from the `get` response rather than asking the user to provide it.
7. **Surface the remediation path.** When presenting continuous eval results that show score degradation, always offer to route into the [observe skill](../observe.md) for diagnosis and optimization. Monitoring without action is incomplete.
8. **Handle agent-not-found.** If `agent_get` returns a not-found error, stop the continuous eval flow. Offer to route to the [deploy skill](../../deploy/deploy.md) to create the agent first, or ask the user to verify the agent name and environment.
9. **Handle auth and endpoint errors.** If `agent_get` or `continuous_eval_create` returns a permission or authentication error, verify the project endpoint, environment, and user access. Do not suggest creating the agent — the issue is access, not existence.
10. **Validate `deploymentName` before enabling.** Do not assume `gpt-4o` exists. If quality evaluators are selected, verify a chat-capable deployment is available in the project. If none exists, stop and explain that quality evaluators cannot be enabled until a compatible deployment is provisioned.
11. **Handle invalid evaluator names.** If `continuous_eval_create` returns an invalid evaluator name error, call `evaluator_catalog_get` to list available evaluators and present valid options. Do not retry with the same arguments.
12. **Handle unexpected empty config.** If `continuous_eval_get` returns an empty list for an agent the user believes has continuous eval configured, verify the agent name and project endpoint match the intended environment in `.foundry/agent-metadata.yaml`. The configuration may exist under a different environment or resolved `agentName`.

## Operations

### Check Current State

Before enabling or modifying, check what's already configured:

```yaml
Tool: continuous_eval_get
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
```

- Empty list → no continuous eval configured. Proceed to [Enable or Update](#enable-or-update).
- Non-empty list → agent already has continuous eval. Present the configuration and ask what the user wants to change.

> ⚠️ **Empty result is not proof of absence.** If the user expects a config to exist but the list is empty, verify the project endpoint and agent name match the intended environment before concluding it was never set up.

### Enable or Update

**Replace Semantics**: `continuous_eval_create` always creates a new evaluation group with the provided evaluators and points the evaluation rule at it. Always pass the complete desired configuration on every call — omitted evaluators are dropped, not preserved.

> ⚠️ **Do not assume `gpt-4o` exists.** Before setting `deploymentName`, verify a chat-capable deployment is available in the project. If none exists, quality evaluators cannot be enabled — only safety evaluators (which do not require a deployment) will work.

```yaml
Tool: continuous_eval_create
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
  evaluatorNames: ["groundedness", "coherence", "fluency"]  # Illustrative — align with your batch eval evaluators
  deploymentName: "gpt-4o"          # Required for quality evaluators
  enabled: true                      # Set false to disable without deleting
```

**Evaluator selection guidance:**
- **Quality evaluators** (require `deploymentName`): coherence, fluency, relevance, groundedness, intent_resolution, task_adherence, tool_call_accuracy
- **Safety evaluators** (no `deploymentName` needed): violence, sexual, self_harm, hate_unfairness, indirect_attack, code_vulnerability, protected_material
- Custom evaluators from the project's evaluator catalog are also supported by name.

**Optional parameters by agent kind:**

| Parameter | Applies To | Description | Default |
|-----------|-----------|-------------|---------|
| `samplingRate` | Prompt | Percentage of responses to evaluate (1-100) | All responses |
| `maxHourlyRuns` | Prompt | Cap on evaluation runs per hour | No limit |
| `intervalHours` | Hosted | Hours between evaluation runs | 1 |
| `maxTraces` | Hosted | Max data points per evaluation run | 1000 |
| `scenario` | Prompt | Evaluation scenario: `standard` (quality and safety metrics, default) or `business` (business success metrics). An agent can have one of each simultaneously. | `standard` |

### Disable

To temporarily disable without changing configuration, pass the configuration currently in use along with `enabled: false`. Because `continuous_eval_create` has replace semantics, omitting parameters will change the configuration when re-enabled. The `continuous_eval_get` response does not include evaluator names directly — they are stored in the linked evaluation group — so retrieve them via `evaluation_get` first. If multiple configurations are returned in the `continuous_eval_get` response, present the list to the user and ask which to target.

```yaml
# Step 1: Get the evalId, then retrieve current evaluators from the eval group
Tool: continuous_eval_get
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
# Note the evalId from the response
```

```yaml
Tool: evaluation_get
Arguments:
  projectEndpoint: <project endpoint>
  evalId: <evalId from above>
# Note the evaluator names from the evaluation group's testing criteria
```

```yaml
# Step 2: Disable with the same evaluators
Tool: continuous_eval_create
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
  evaluatorNames: ["groundedness", "coherence", "fluency"]  # Must match current config
  deploymentName: "gpt-4o"
  enabled: false
```

### Delete

To permanently remove continuous evaluation configuration:

```yaml
Tool: continuous_eval_delete
Arguments:
  projectEndpoint: <project endpoint>
  configId: <id from continuous_eval_get>
  agentName: <agent name>
```

Always call `continuous_eval_get` first to retrieve the `id` field of the configuration to delete. If multiple configurations are returned, present the list to the user and ask which to target.

## Acting on Results

Continuous evaluation generates ongoing scores — but monitoring is only useful when you **act** on what it reveals. This section covers how to consume evaluation results and the remediation loop when scores degrade.

### Step 1: Read Evaluation Scores

The `continuous_eval_get` response includes an `evalId` that links to the evaluation group. Use this to retrieve actual run results:

```yaml
Tool: continuous_eval_get
Arguments:
  projectEndpoint: <project endpoint>
  agentName: <agent name>
# Note the evalId from the response
```

```yaml
Tool: evaluation_get
Arguments:
  projectEndpoint: <project endpoint>
  evalId: <evalId from continuous_eval_get>
  isRequestForRuns: true
# Returns evaluation runs with per-evaluator scores
```

Review the run results for score trends. Each run contains scores for every configured evaluator. Look for:
- **Scores below threshold** — any evaluator consistently scoring below your acceptable baseline
- **Score degradation over time** — scores that were previously healthy but are trending downward
- **Safety flags** — any non-zero safety evaluator scores that indicate harmful content

### Step 2: Triage the Regression

1. **Identify the failing evaluators.** From the evaluation runs, note which specific evaluators are scoring low (e.g., `groundedness` dropping from 4.2 to 2.8).
2. **Correlate with traces.** Use the [trace skill](../../trace/trace.md) to search App Insights for the conversations that triggered low scores. Look for patterns: specific query types, tool-call failures, or grounding gaps.
3. **Compare to baseline.** If batch eval results exist in `.foundry/results/`, compare continuous eval scores against the last known-good batch run to determine whether this is a new regression or a pre-existing gap.

### Step 3: Remediate via the Observe Loop

Once you understand the failure pattern, use the [observe skill](../observe.md) to fix it:

| Symptom | Action |
|---------|--------|
| Quality scores dropping (coherence, relevance, task_adherence) | Run [Step 3: Analyze](analyze-results.md) to cluster failures, then [Step 4: Optimize](optimize-deploy.md) to improve the prompt |
| Safety evaluators flagging (violence, indirect_attack) | Review flagged traces via [trace skill](../../trace/trace.md), then update agent instructions or tool definitions to address the pattern |
| Grounding failures | Check whether the agent's data sources are still accessible and returning expected results; update knowledge index or tool configuration |
| Scores fluctuating after a deploy | Run [Step 5: Compare](compare-iterate.md) between the current and previous agent version to isolate the regression |

### Step 4: Verify the Fix

After deploying a fix through the observe loop:

1. **Re-run a batch eval** via [observe](../observe.md) Step 2 against the same test cases to confirm the fix.
2. **Read continuous eval scores** from the next evaluation cycle using `evaluation_get` with the `evalId` — verify scores have recovered.
3. **Adjust evaluators if needed.** If the regression exposed a gap in evaluator coverage, use `continuous_eval_create` to update the configuration with additional or refined evaluators.

> 💡 **Tip:** The continuous eval → observe → deploy → continuous eval cycle is the core production quality loop. Continuous eval detects; observe diagnoses and fixes; continuous eval verifies.

## Response Format

All tools return a unified `ContinuousEvalConfig` shape. The `get` tool returns a list; `create` returns a single object.

| Field | Description | Present For |
|-------|-------------|-------------|
| `id` | Configuration identifier (needed for delete) | All |
| `displayName` | Human-readable name | All |
| `enabled` | Whether evaluation is active | All |
| `evalId` | Linked evaluation group containing evaluator definitions | All |
| `agentName` | Target agent name | All |
| `status` | Provisioning status | Hosted only |
| `scenario` | Evaluation scenario (`standard` or `business`) | Prompt only |
| `samplingRate` | Percentage of responses evaluated | Prompt only |
| `maxHourlyRuns` | Cap on runs per hour | Prompt only |
| `intervalHours` | Hours between scheduled runs | Hosted only |
| `maxTraces` | Max data points per run | Hosted only |
| `createdAt` | Creation timestamp | All |
| `createdBy` | Creator identity | All |

## Related Skills

| User Intent | Skill |
|-------------|-------|
| "Evaluate my agent" / "Run a batch eval" | [observe skill](../observe.md) |
| "Scores are dropping" / "Diagnose and fix quality regression" | [observe skill](../observe.md) (Steps 3–5) |
| "Analyze production traces" / "Find flagged conversations" | [trace skill](../../trace/trace.md) |
| "Deploy my agent" / "Redeploy after fix" | [deploy skill](../../deploy/deploy.md) |
