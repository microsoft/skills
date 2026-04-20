---
name: azure-maf-declarative-workflows-py
description: This skill should be used when the user asks about "declarative workflow", "YAML workflow", "workflow expressions", "workflow actions", "declarative agent", "GotoAction", "RepeatUntil", "Foreach", "BreakLoop", "ContinueLoop", "SendActivity", or needs guidance on building YAML-based declarative workflows as an alternative to programmatic workflows in Microsoft Agent Framework Python. Make sure to use this skill whenever the user mentions defining agent orchestration in YAML, configuration-driven workflows, PowerFx expressions, workflow variables, InvokeAzureAgent in YAML, or human-in-the-loop YAML actions, even if they don't explicitly say "declarative".
version: 0.1.0
---

# MAF Declarative Workflows

## Overview

Declarative workflows in Microsoft Agent Framework (MAF) Python define orchestration logic using YAML configuration files instead of programmatic code. Describe *what* a workflow should do rather than *how* to implement it; the framework converts YAML definitions into executable workflow graphs.

This YAML-based paradigm is completely different from programmatic workflows. Use it when configuration-driven flows are preferred over code-driven orchestration.

## When to Use Declarative vs. Programmatic Workflows

| Scenario | Recommended Approach |
|----------|---------------------|
| Standard orchestration patterns | Declarative |
| Workflows that change frequently | Declarative |
| Non-developers need to modify workflows | Declarative |
| Complex custom logic | Programmatic |
| Maximum flexibility and control | Programmatic |
| Integration with existing Python code | Programmatic |

**Prerequisites**: Python 3.10–3.13, `agent-framework-declarative` package (`pip install agent-framework-declarative --pre`), and basic YAML familiarity. Python 3.14 is not yet supported in the baseline docs at the time of writing.

## Basic YAML Structure

Define workflows with these elements (root-level pattern):

```yaml
name: my-workflow
description: A brief description of what this workflow does

inputs:
  parameterName:
    type: string
    description: Description of the parameter

actions:
  - kind: ActionType
    id: unique_action_id
    displayName: Human readable name
    # Action-specific properties
```

| Element | Required | Description |
|---------|----------|-------------|
| `name` | Yes | Unique identifier for the workflow |
| `description` | No | Human-readable description |
| `inputs` | No | Input parameters the workflow accepts |
| `actions` | Yes | List of actions to execute |

Advanced docs may also show a `kind: Workflow` + `trigger` envelope for trigger-based workflows. Use the shape documented for your targeted runtime.

## Variable Namespace Overview

Organize state with five namespaces. Use full paths (e.g., `Workflow.Inputs.name`) in expressions; literal values omit the `=` prefix.

| Namespace | Access | Purpose |
|-----------|--------|---------|
| `Local.*` | Read/Write | Temporary variables during execution |
| `Workflow.Inputs.*` | Read-only | Input parameters passed to the workflow |
| `Workflow.Outputs.*` | Read/Write | Values returned from the workflow |
| `System.*` | Read-only | System values (ConversationId, LastMessage, Timestamp) |
| `Agent.*` | Read-only | Results from agent invocations |

## First Example Walkthrough

Create a greeting workflow that uses variables and expressions.

**Step 1: Create the YAML file (`greeting-workflow.yaml`)**

```yaml
name: greeting-workflow
description: A simple workflow that greets the user

inputs:
  name:
    type: string
    description: The name of the person to greet

actions:
  - kind: SetVariable
    id: set_greeting
    displayName: Set greeting prefix
    variable: Local.greeting
    value: Hello

  - kind: SetVariable
    id: build_message
    displayName: Build greeting message
    variable: Local.message
    value: =Concat(Local.greeting, ", ", Workflow.Inputs.name, "!")

  - kind: SendActivity
    id: send_greeting
    displayName: Send greeting to user
    activity:
      text: =Local.message

  - kind: SetVariable
    id: set_output
    displayName: Store result in outputs
    variable: Workflow.Outputs.greeting
    value: =Local.message
```

**Step 2: Load and run from Python**

```python
import asyncio
from pathlib import Path

from agent_framework.declarative import WorkflowFactory


async def main() -> None:
    factory = WorkflowFactory()
    workflow_path = Path(__file__).parent / "greeting-workflow.yaml"
    workflow = factory.create_workflow_from_yaml_path(workflow_path)

    result = await workflow.run({"name": "Alice"})
    for output in result.get_outputs():
        print(f"Output: {output}")


if __name__ == "__main__":
    asyncio.run(main())
```

**Expected output**: `Hello, Alice!`

## Action Type Summary

| Category | Actions |
|----------|---------|
| Variable Management | `SetVariable`, `SetMultipleVariables`, `AppendValue`, `ResetVariable` |
| Control Flow | `If`, `ConditionGroup`, `Foreach`, `RepeatUntil`, `BreakLoop`, `ContinueLoop`, `GotoAction` |
| Output | `SendActivity`, `EmitEvent` |
| Agent Invocation | `InvokeAzureAgent` |
| Human-in-the-Loop | `Question`, `Confirmation`, `RequestExternalInput`, `WaitForInput` |
| Workflow Control | `EndWorkflow`, `EndConversation`, `CreateConversation` |

## Expression Basics

Prefix values with `=` to evaluate at runtime. Unprefixed values are literals.

```yaml
value: Hello                    # Literal
value: =Concat("Hi ", Workflow.Inputs.name)  # Expression
```

Common functions: `Concat`, `If`, `IsBlank`. Operators: comparison (`=`, `<>`, `<`, `>`, `<=`, `>=`), logical (`And`, `Or`, `Not`), arithmetic (`+`, `-`, `*`, `/`).

## Control Flow and Output

Use **If** for conditional branching (`condition`, `then`, `else`). Use **ConditionGroup** for multi-branch routing (first matching condition wins). Use **Foreach** to iterate collections; **RepeatUntil** to loop until a condition is true. Use **BreakLoop** and **ContinueLoop** inside loops for early exit or skip. Use **GotoAction** with `actionId` to jump to a labeled action for retries or non-linear flow.

Send messages with **SendActivity** (`activity.text`); emit events with **EmitEvent**. Store results in `Workflow.Outputs.*` for callers. Use **EndWorkflow** to terminate execution.

## Agent and Human-in-the-Loop

Invoke Azure AI agents with **InvokeAzureAgent**. Register agents via `WorkflowFactory.register_agent()` before loading workflows. Use `input.externalLoop.when` for support-style conversations that continue until resolved.

For interactive input: **Question** (ask and store response), **Confirmation** (yes/no), **RequestExternalInput** (external system), **WaitForInput** (pause until input arrives).

## Additional Resources

For detailed guidance, consult:

- **`references/expressions-variables.md`** — Variable namespaces (Local, Workflow, System, Agent), operators, functions (`Concat`, `IsBlank`, `If`), expression syntax, `${}` references
- **`references/actions-reference.md`** — All action kinds with property tables and YAML snippets: variable, control flow, output, agent, HITL, workflow
- **`references/advanced-patterns.md`** — Multi-agent YAML pipelines, loop control (RepeatUntil, BreakLoop, GotoAction), HITL patterns, complete support-ticket workflow, naming conventions, error handling
- **`references/acceptance-criteria.md`** — Correct/incorrect patterns for YAML structure, expressions, variables, actions, agent invocation, and Python execution

### Provider and Version Caveats

- Keep YAML examples aligned to the runtime shape used by your target SDK version.
- Validate Python version support against current declarative workflow release notes before deployment.
