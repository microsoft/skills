# Declarative Workflows — Actions Reference

Complete reference for all action types available in Microsoft Agent Framework Python declarative workflows.

## Table of Contents

- **Variable Management Actions** — SetVariable, SetMultipleVariables, AppendValue, ResetVariable
- **Control Flow Actions** — If, ConditionGroup, Foreach, RepeatUntil, BreakLoop, ContinueLoop, GotoAction
- **Output Actions** — SetOutput pattern, SendActivity, EmitEvent
- **Agent Invocation Actions** — InvokeAzureAgent (basic, with I/O config, external loop), Python agent registration
- **Human-in-the-Loop Actions** — Question, Confirmation, RequestExternalInput, WaitForInput
- **Workflow Control Actions** — EndWorkflow, EndConversation, CreateConversation
- **Quick Reference Table** — All 20 actions at a glance

## Overview

Actions are the building blocks of declarative workflows. Each action performs a specific operation; actions execute sequentially in the order they appear in the YAML file.

### Action Structure

All actions share common properties:

```yaml
- kind: ActionType      # Required: The type of action
  id: unique_id         # Optional: Unique identifier for referencing
  displayName: Name     # Optional: Human-readable name for logging
  # Action-specific properties...
```

## Variable Management Actions

### SetVariable

Sets a variable to a specified value.

```yaml
- kind: SetVariable
  id: set_greeting
  displayName: Set greeting message
  variable: Local.greeting
  value: Hello World
```

With an expression:

```yaml
- kind: SetVariable
  variable: Local.fullName
  value: =Concat(Workflow.Inputs.firstName, " ", Workflow.Inputs.lastName)
```

| Property | Required | Description |
|----------|----------|-------------|
| `variable` | Yes | Variable path (e.g., `Local.name`, `Workflow.Outputs.result`) |
| `value` | Yes | Value to set (literal or expression) |

### SetMultipleVariables

Sets multiple variables in a single action.

```yaml
- kind: SetMultipleVariables
  id: initialize_vars
  displayName: Initialize variables
  variables:
    Local.counter: 0
    Local.status: pending
    Local.message: =Concat("Processing order ", Workflow.Inputs.orderId)
```

| Property | Required | Description |
|----------|----------|-------------|
| `variables` | Yes | Map of variable paths to values |

### AppendValue

Appends a value to a list or concatenates to a string.

```yaml
- kind: AppendValue
  id: add_item
  variable: Local.items
  value: =Workflow.Inputs.newItem
```

| Property | Required | Description |
|----------|----------|-------------|
| `variable` | Yes | Variable path to append to |
| `value` | Yes | Value to append |

### ResetVariable

Clears a variable's value.

```yaml
- kind: ResetVariable
  id: clear_counter
  variable: Local.counter
```

| Property | Required | Description |
|----------|----------|-------------|
| `variable` | Yes | Variable path to reset |

## Control Flow Actions

### If

Executes actions conditionally based on a condition.

```yaml
- kind: If
  id: check_age
  displayName: Check user age
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

Nested conditions:

```yaml
- kind: If
  condition: =Workflow.Inputs.role = "admin"
  then:
    - kind: SendActivity
      activity:
        text: "Admin access granted"
  else:
    - kind: If
      condition: =Workflow.Inputs.role = "user"
      then:
        - kind: SendActivity
          activity:
            text: "User access granted"
      else:
        - kind: SendActivity
          activity:
            text: "Access denied"
```

| Property | Required | Description |
|----------|----------|-------------|
| `condition` | Yes | Expression that evaluates to true/false |
| `then` | Yes | Actions to execute if condition is true |
| `else` | No | Actions to execute if condition is false |

### ConditionGroup

Evaluates multiple conditions like a switch/case statement.

```yaml
- kind: ConditionGroup
  id: route_by_category
  displayName: Route based on category
  conditions:
    - condition: =Workflow.Inputs.category = "electronics"
      id: electronics_branch
      actions:
        - kind: SetVariable
          variable: Local.department
          value: Electronics Team
    - condition: =Workflow.Inputs.category = "clothing"
      id: clothing_branch
      actions:
        - kind: SetVariable
          variable: Local.department
          value: Clothing Team
    - condition: =Workflow.Inputs.category = "food"
      id: food_branch
      actions:
        - kind: SetVariable
          variable: Local.department
          value: Food Team
  elseActions:
    - kind: SetVariable
      variable: Local.department
      value: General Support
```

| Property | Required | Description |
|----------|----------|-------------|
| `conditions` | Yes | List of condition/actions pairs (first match wins) |
| `elseActions` | No | Actions if no condition matches |

### Foreach

Iterates over a collection.

```yaml
- kind: Foreach
  id: process_items
  displayName: Process each item
  source: =Workflow.Inputs.items
  itemName: item
  indexName: index
  actions:
    - kind: SendActivity
      activity:
        text: =Concat("Processing item ", index, ": ", item)
```

| Property | Required | Description |
|----------|----------|-------------|
| `source` | Yes | Expression returning a collection |
| `itemName` | No | Variable name for current item (default: `item`) |
| `indexName` | No | Variable name for current index (default: `index`) |
| `actions` | Yes | Actions to execute for each item |

### RepeatUntil

Repeats actions until a condition becomes true.

```yaml
- kind: SetVariable
  variable: Local.counter
  value: 0

- kind: RepeatUntil
  id: count_loop
  displayName: Count to 5
  condition: =Local.counter >= 5
  actions:
    - kind: SetVariable
      variable: Local.counter
      value: =Local.counter + 1
    - kind: SendActivity
      activity:
        text: =Concat("Counter: ", Local.counter)
```

| Property | Required | Description |
|----------|----------|-------------|
| `condition` | Yes | Loop continues until this is true |
| `actions` | Yes | Actions to repeat |

### BreakLoop

Exits the current loop immediately.

```yaml
- kind: Foreach
  source: =Workflow.Inputs.items
  actions:
    - kind: If
      condition: =item = "stop"
      then:
        - kind: BreakLoop
    - kind: SendActivity
      activity:
        text: =item
```

### ContinueLoop

Skips to the next iteration of the loop.

```yaml
- kind: Foreach
  source: =Workflow.Inputs.numbers
  actions:
    - kind: If
      condition: =item < 0
      then:
        - kind: ContinueLoop
    - kind: SendActivity
      activity:
        text: =Concat("Positive number: ", item)
```

### GotoAction

Jumps to a specific action by ID.

```yaml
- kind: SetVariable
  id: start_label
  variable: Local.attempts
  value: =Local.attempts + 1

- kind: SendActivity
  activity:
    text: =Concat("Attempt ", Local.attempts)

- kind: If
  condition: =And(Local.attempts < 3, Not(Local.success))
  then:
    - kind: GotoAction
      actionId: start_label
```

| Property | Required | Description |
|----------|----------|-------------|
| `actionId` | Yes | ID of the action to jump to |

## Output Actions

### SetOutput Pattern

Use `SetVariable` with `Workflow.Outputs.*` to return values:

```yaml
- kind: SetVariable
  variable: Workflow.Outputs.greeting
  value: =Local.message
```

### SendActivity

Sends a message to the user.

```yaml
- kind: SendActivity
  id: send_welcome
  displayName: Send welcome message
  activity:
    text: "Welcome to our service!"
```

With an expression:

```yaml
- kind: SendActivity
  activity:
    text: =Concat("Hello, ", Workflow.Inputs.name, "! How can I help you today?")
```

| Property | Required | Description |
|----------|----------|-------------|
| `activity` | Yes | The activity to send |
| `activity.text` | Yes | Message text (literal or expression) |

### EmitEvent

Emits a custom event.

```yaml
- kind: EmitEvent
  id: emit_status
  displayName: Emit status event
  eventType: order_status_changed
  data:
    orderId: =Workflow.Inputs.orderId
    status: =Local.newStatus
```

| Property | Required | Description |
|----------|----------|-------------|
| `eventType` | Yes | Type identifier for the event |
| `data` | No | Event payload data |

## Agent Invocation Actions

### InvokeAzureAgent

Invokes an Azure AI agent.

Basic invocation:

```yaml
- kind: InvokeAzureAgent
  id: call_assistant
  displayName: Call assistant agent
  agent:
    name: AssistantAgent
  conversationId: =System.ConversationId
```

With input and output configuration:

```yaml
- kind: InvokeAzureAgent
  id: call_analyst
  displayName: Call analyst agent
  agent:
    name: AnalystAgent
  conversationId: =System.ConversationId
  input:
    messages: =Local.userMessage
    arguments:
      topic: =Workflow.Inputs.topic
  output:
    responseObject: Local.AnalystResult
    messages: Local.AnalystMessages
    autoSend: true
```

With external loop (continues until condition is met):

```yaml
- kind: InvokeAzureAgent
  id: support_agent
  agent:
    name: SupportAgent
  input:
    externalLoop:
      when: =Not(Local.IsResolved)
  output:
    responseObject: Local.SupportResult
```

| Property | Required | Description |
|----------|----------|-------------|
| `agent.name` | Yes | Name of the registered agent |
| `conversationId` | No | Conversation context identifier |
| `input.messages` | No | Messages to send to the agent |
| `input.arguments` | No | Additional arguments for the agent |
| `input.externalLoop.when` | No | Condition to continue agent loop |
| `output.responseObject` | No | Path to store agent response |
| `output.messages` | No | Path to store conversation messages |
| `output.autoSend` | No | Automatically send response to user |

**Python setup**: Register agents before loading workflows:

```python
factory = WorkflowFactory()
factory.register_agent("AssistantAgent", assistant_agent_instance)
workflow = factory.create_workflow_from_yaml_path("workflow.yaml")
```

## Human-in-the-Loop Actions

### Question

Asks the user a question and stores the response.

```yaml
- kind: Question
  id: ask_name
  displayName: Ask for user name
  question:
    text: "What is your name?"
  variable: Local.userName
  default: "Guest"
```

| Property | Required | Description |
|----------|----------|-------------|
| `question.text` | Yes | The question to ask |
| `variable` | Yes | Path to store the response |
| `default` | No | Default value if no response |

### Confirmation

Asks the user for a yes/no confirmation.

```yaml
- kind: Confirmation
  id: confirm_delete
  displayName: Confirm deletion
  question:
    text: "Are you sure you want to delete this item?"
  variable: Local.confirmed
```

| Property | Required | Description |
|----------|----------|-------------|
| `question.text` | Yes | The confirmation question |
| `variable` | Yes | Path to store boolean result |

### RequestExternalInput

Requests input from an external system or process.

```yaml
- kind: RequestExternalInput
  id: request_approval
  displayName: Request manager approval
  prompt:
    text: "Please provide approval for this request."
  variable: Local.approvalResult
  default: "pending"
```

| Property | Required | Description |
|----------|----------|-------------|
| `prompt.text` | Yes | Description of required input |
| `variable` | Yes | Path to store the input |
| `default` | No | Default value |

### WaitForInput

Pauses the workflow and waits for external input.

```yaml
- kind: WaitForInput
  id: wait_for_response
  variable: Local.externalResponse
```

| Property | Required | Description |
|----------|----------|-------------|
| `variable` | Yes | Path to store the input when received |

## Workflow Control Actions

### EndWorkflow

Terminates the workflow execution.

```yaml
- kind: EndWorkflow
  id: finish
  displayName: End workflow
```

### EndConversation

Ends the current conversation.

```yaml
- kind: EndConversation
  id: end_chat
  displayName: End conversation
```

### CreateConversation

Creates a new conversation context.

```yaml
- kind: CreateConversation
  id: create_new_conv
  displayName: Create new conversation
  conversationId: Local.NewConversationId
```

| Property | Required | Description |
|----------|----------|-------------|
| `conversationId` | Yes | Path to store the new conversation ID |

## Quick Reference Table

| Action | Category | Description |
|--------|----------|-------------|
| `SetVariable` | Variable | Set a single variable |
| `SetMultipleVariables` | Variable | Set multiple variables |
| `AppendValue` | Variable | Append to list/string |
| `ResetVariable` | Variable | Clear a variable |
| `If` | Control Flow | Conditional branching |
| `ConditionGroup` | Control Flow | Multi-branch switch |
| `Foreach` | Control Flow | Iterate over collection |
| `RepeatUntil` | Control Flow | Loop until condition |
| `BreakLoop` | Control Flow | Exit current loop |
| `ContinueLoop` | Control Flow | Skip to next iteration |
| `GotoAction` | Control Flow | Jump to action by ID |
| `SendActivity` | Output | Send message to user |
| `EmitEvent` | Output | Emit custom event |
| `InvokeAzureAgent` | Agent | Call Azure AI agent |
| `Question` | Human-in-the-Loop | Ask user a question |
| `Confirmation` | Human-in-the-Loop | Yes/no confirmation |
| `RequestExternalInput` | Human-in-the-Loop | Request external input |
| `WaitForInput` | Human-in-the-Loop | Wait for input |
| `EndWorkflow` | Workflow Control | Terminate workflow |
| `EndConversation` | Workflow Control | End conversation |
| `CreateConversation` | Workflow Control | Create new conversation |
