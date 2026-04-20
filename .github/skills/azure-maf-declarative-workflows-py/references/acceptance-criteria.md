# Acceptance Criteria — maf-declarative-workflows-py

Correct and incorrect patterns for MAF declarative workflows in Python, derived from official Microsoft Agent Framework documentation.

## 0a. Import Paths

#### CORRECT: WorkflowFactory from declarative package
```python
from agent_framework.declarative import WorkflowFactory
```

#### CORRECT: Agent imports for registration
```python
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient
from agent_framework.azure import AzureOpenAIChatClient
```

#### INCORRECT: Wrong module path
```python
from agent_framework import WorkflowFactory              # Wrong — use agent_framework.declarative
from agent_framework.workflows import WorkflowFactory    # Wrong — use agent_framework.declarative
from agent_framework_declarative import WorkflowFactory  # Wrong — use dotted import
```

---

## 0b. Authentication Patterns

Declarative workflows delegate authentication to registered agents.

#### CORRECT: Register an authenticated agent
```python
from agent_framework.azure import AzureOpenAIChatClient
from azure.identity import AzureCliCredential

agent = AzureOpenAIChatClient(credential=AzureCliCredential()).as_agent(
    instructions="You are helpful.", name="MyAgent"
)
factory = WorkflowFactory()
factory.register_agent("MyAgent", agent)
workflow = factory.create_workflow_from_yaml_path("workflow.yaml")
```

#### CORRECT: OpenAI agent registration
```python
from agent_framework.openai import OpenAIChatClient

agent = OpenAIChatClient(api_key="your-key").as_agent(
    instructions="You are helpful.", name="MyAgent"
)
factory = WorkflowFactory()
factory.register_agent("MyAgent", agent)
```

#### INCORRECT: Passing credentials to WorkflowFactory
```python
factory = WorkflowFactory(credential=AzureCliCredential())  # Wrong — no credential param
```

---

## 0c. Async Variants

#### CORRECT: Workflow execution is async
```python
import asyncio

async def main():
    factory = WorkflowFactory()
    factory.register_agent("MyAgent", agent)
    workflow = factory.create_workflow_from_yaml_path("workflow.yaml")
    result = await workflow.run({"name": "Alice"})
    for output in result.get_outputs():
        print(f"Output: {output}")

asyncio.run(main())
```

#### INCORRECT: Synchronous workflow execution
```python
result = workflow.run({"name": "Alice"})  # Wrong — run() is async, must await
```

#### Key Rules

- `workflow.run()` must be awaited.
- `factory.create_workflow_from_yaml_path()` is synchronous (returns workflow immediately).
- `factory.register_agent()` is synchronous.
- There are no synchronous variants of `workflow.run()`.

---

## 1. YAML Structure

#### CORRECT: Minimal valid workflow

```yaml
name: my-workflow
actions:
  - kind: SendActivity
    activity:
      text: "Hello!"
```

#### CORRECT: Full structure with inputs and description

```yaml
name: my-workflow
description: A brief description
inputs:
  paramName:
    type: string
    description: Description of the parameter
actions:
  - kind: ActionType
    id: unique_id
    displayName: Human readable name
```

#### INCORRECT: Missing required fields

```yaml
# Wrong — missing name
actions:
  - kind: SendActivity
    activity:
      text: "Hello"
```

```yaml
# Wrong — missing actions
name: my-workflow
inputs:
  name:
    type: string
```

## 2. Expression Syntax

#### CORRECT: Expression prefix with =

```yaml
value: =Concat("Hello ", Workflow.Inputs.name)
value: =Workflow.Inputs.quantity * 2
condition: =Workflow.Inputs.age >= 18
```

#### CORRECT: Literal value (no prefix)

```yaml
value: Hello World
value: 42
value: true
```

#### INCORRECT: Missing = prefix for expressions

```yaml
value: Concat("Hello ", Workflow.Inputs.name)    # Wrong — treated as literal string
condition: Workflow.Inputs.age >= 18              # Wrong — not evaluated
```

#### INCORRECT: Using = with literal values

```yaml
value: ="Hello World"   # Technically works but unnecessary for literals
```

## 3. Variable Namespaces

#### CORRECT: Full namespace paths

```yaml
variable: Local.counter
variable: Workflow.Inputs.name
variable: Workflow.Outputs.result
value: =System.ConversationId
```

#### INCORRECT: Missing or wrong namespace

```yaml
variable: counter              # Wrong — must use namespace prefix
variable: Inputs.name          # Wrong — must be Workflow.Inputs.name
variable: System.ConversationId  # Wrong for writes — System.* is read-only
variable: Workflow.Inputs.name   # Wrong for writes — Workflow.Inputs.* is read-only
```

## 4. SetVariable Action

#### CORRECT: Using variable property

```yaml
- kind: SetVariable
  variable: Local.greeting
  value: Hello World
```

#### INCORRECT: Using wrong property name

```yaml
- kind: SetVariable
  path: Local.greeting       # Wrong — use "variable", not "path"
  value: Hello World

- kind: SetVariable
  name: Local.greeting       # Wrong — use "variable", not "name"
  value: Hello World
```

## 5. Control Flow

#### CORRECT: If with then/else

```yaml
- kind: If
  condition: =Workflow.Inputs.age >= 18
  then:
    - kind: SendActivity
      activity:
        text: "Welcome, adult user!"
  else:
    - kind: SendActivity
      activity:
        text: "Welcome, young user!"
```

#### CORRECT: ConditionGroup with elseActions

```yaml
- kind: ConditionGroup
  conditions:
    - condition: =Workflow.Inputs.category = "billing"
      actions:
        - kind: SetVariable
          variable: Local.team
          value: Billing
  elseActions:
    - kind: SetVariable
      variable: Local.team
      value: General
```

#### INCORRECT: Wrong property names

```yaml
- kind: If
  condition: =Workflow.Inputs.age >= 18
  actions:                    # Wrong — use "then", not "actions"
    - kind: SendActivity
      activity:
        text: "Welcome!"

- kind: ConditionGroup
  conditions:
    - condition: =true
      then:                   # Wrong — use "actions", not "then" (inside ConditionGroup)
        - kind: SendActivity
          activity:
            text: "Hello"
  else:                       # Wrong — use "elseActions", not "else"
    - kind: SendActivity
      activity:
        text: "Default"
```

## 6. Loop Patterns

#### CORRECT: RepeatUntil with exit condition

```yaml
- kind: RepeatUntil
  condition: =Local.counter >= 5
  actions:
    - kind: SetVariable
      variable: Local.counter
      value: =Local.counter + 1
```

#### CORRECT: Foreach with source and item

```yaml
- kind: Foreach
  source: =Workflow.Inputs.items
  itemName: item
  indexName: index
  actions:
    - kind: SendActivity
      activity:
        text: =Concat("Item ", index, ": ", item)
```

#### CORRECT: GotoAction targeting action by ID

```yaml
- kind: SetVariable
  id: loop_start
  variable: Local.counter
  value: =Local.counter + 1

- kind: If
  condition: =Local.counter < 5
  then:
    - kind: GotoAction
      actionId: loop_start
```

#### INCORRECT: GotoAction without matching ID

```yaml
- kind: GotoAction
  actionId: nonexistent_label    # Wrong — no action has this ID
```

#### INCORRECT: BreakLoop outside a loop

```yaml
actions:
  - kind: BreakLoop              # Wrong — BreakLoop must be inside Foreach or RepeatUntil
```

## 7. InvokeAzureAgent

#### CORRECT: Basic agent invocation

```yaml
- kind: InvokeAzureAgent
  agent:
    name: MyAgent
  conversationId: =System.ConversationId
```

#### CORRECT: With input/output configuration

```yaml
- kind: InvokeAzureAgent
  agent:
    name: AnalystAgent
  conversationId: =System.ConversationId
  input:
    messages: =Local.userMessage
    arguments:
      topic: =Workflow.Inputs.topic
  output:
    responseObject: Local.Result
    autoSend: true
```

#### CORRECT: External loop pattern

```yaml
- kind: InvokeAzureAgent
  agent:
    name: SupportAgent
  input:
    externalLoop:
      when: =Not(Local.IsResolved)
  output:
    responseObject: Local.SupportResult
```

#### CORRECT: Python agent registration

```python
from agent_framework.declarative import WorkflowFactory

factory = WorkflowFactory()
factory.register_agent("MyAgent", agent_instance)
workflow = factory.create_workflow_from_yaml_path("workflow.yaml")
result = await workflow.run({"key": "value"})
```

#### INCORRECT: Agent not registered before use

```python
factory = WorkflowFactory()
workflow = factory.create_workflow_from_yaml_path("workflow.yaml")
result = await workflow.run({})  # Wrong — agent "MyAgent" referenced in YAML but not registered
```

#### INCORRECT: Wrong agent reference in YAML

```yaml
- kind: InvokeAzureAgent
  agentName: MyAgent             # Wrong — use "agent.name", not "agentName"
```

## 8. Human-in-the-Loop

#### CORRECT: Question with default

```yaml
- kind: Question
  question:
    text: "What is your name?"
  variable: Local.userName
  default: "Guest"
```

#### CORRECT: Confirmation

```yaml
- kind: Confirmation
  question:
    text: "Are you sure?"
  variable: Local.confirmed
```

#### INCORRECT: Wrong property structure

```yaml
- kind: Question
  text: "What is your name?"     # Wrong — must be nested under question.text
  variable: Local.userName
```

## 9. SendActivity

#### CORRECT: Literal and expression text

```yaml
- kind: SendActivity
  activity:
    text: "Welcome!"

- kind: SendActivity
  activity:
    text: =Concat("Hello, ", Workflow.Inputs.name, "!")
```

#### INCORRECT: Missing activity wrapper

```yaml
- kind: SendActivity
  text: "Welcome!"               # Wrong — text must be nested under activity.text
```

## 10. Workflow Trigger Structure

#### CORRECT: Triggered workflow (for agent-driven scenarios)

```yaml
name: my-workflow
kind: Workflow
trigger:
  kind: OnConversationStart
  id: my_workflow_trigger
  actions:
    - kind: SendActivity
      activity:
        text: "Workflow started!"
```

#### CORRECT: Simple workflow (for direct invocation)

```yaml
name: my-workflow
actions:
  - kind: SendActivity
    activity:
      text: "Hello!"
```

## 11. Python Execution

#### CORRECT: Load and run a workflow

```python
import asyncio
from pathlib import Path
from agent_framework.declarative import WorkflowFactory

async def main():
    factory = WorkflowFactory()
    workflow = factory.create_workflow_from_yaml_path(
        Path(__file__).parent / "my-workflow.yaml"
    )
    result = await workflow.run({"name": "Alice"})
    for output in result.get_outputs():
        print(f"Output: {output}")

asyncio.run(main())
```

#### CORRECT: Install the right package

```bash
pip install agent-framework-declarative --pre
```

#### INCORRECT: Wrong package name

```bash
pip install agent-framework-workflows --pre   # Wrong package name
pip install agent-framework --pre             # Wrong — declarative needs its own package
```

## 12. Common Anti-Patterns

#### INCORRECT: Infinite loop without exit condition

```yaml
- kind: SetVariable
  id: loop_start
  variable: Local.counter
  value: =Local.counter + 1

- kind: GotoAction
  actionId: loop_start           # Wrong — no exit condition, infinite loop
```

#### CORRECT: Loop with max iterations guard

```yaml
- kind: SetVariable
  id: loop_start
  variable: Local.counter
  value: =Local.counter + 1

- kind: If
  condition: =Local.counter < 10
  then:
    - kind: GotoAction
      actionId: loop_start
  else:
    - kind: SendActivity
      activity:
        text: "Loop complete"
```

#### INCORRECT: Writing to read-only namespaces

```yaml
- kind: SetVariable
  variable: System.ConversationId   # Wrong — System.* is read-only
  value: "my-id"

- kind: SetVariable
  variable: Workflow.Inputs.name    # Wrong — Workflow.Inputs.* is read-only
  value: "Alice"
```
