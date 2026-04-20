# Declarative Workflows — Advanced Patterns

Advanced orchestration patterns for Microsoft Agent Framework Python declarative workflows: multi-agent pipelines, loop control, human-in-the-loop, naming conventions, and error handling.

## Table of Contents

- **Multi-Agent Orchestration** — Sequential pipeline, conditional routing, external loop
- **Loop Control Patterns** — RepeatUntil with max iterations, counter-based GotoAction loops, early exit with BreakLoop, iterative agent conversation (student-teacher)
- **Human-in-the-Loop Patterns** — Survey-style multi-field input, approval gate pattern
- **Complete Support Ticket Workflow** — Full example combining routing, HITL, and escalation
- **Naming Conventions** — Action IDs, variables, display names
- **Organizing Large Workflows** — Section comments, logical grouping
- **Error Handling** — Guard against null/blank, defaults, infinite loop prevention, debug logging
- **Testing Strategies** — Start simple, defaults, logging, edge cases

## Overview

As workflows grow in complexity, use patterns for multi-step processes, agent coordination, and interactive scenarios. This guide provides templates and best practices for common advanced use cases.

## Multi-Agent Orchestration

### Sequential Agent Pipeline

Pass work through multiple agents in sequence, where each agent builds on the previous agent's output.

**Use case**: Content creation pipelines where different specialists handle research, writing, and editing.

```yaml
name: content-pipeline
description: Sequential agent pipeline for content creation

kind: Workflow
trigger:
  kind: OnConversationStart
  id: content_workflow
  actions:
    - kind: InvokeAzureAgent
      id: invoke_researcher
      displayName: Research phase
      conversationId: =System.ConversationId
      agent:
        name: ResearcherAgent

    - kind: InvokeAzureAgent
      id: invoke_writer
      displayName: Writing phase
      conversationId: =System.ConversationId
      agent:
        name: WriterAgent

    - kind: InvokeAzureAgent
      id: invoke_editor
      displayName: Editing phase
      conversationId: =System.ConversationId
      agent:
        name: EditorAgent
```

**Python setup**:

```python
from agent_framework.declarative import WorkflowFactory

factory = WorkflowFactory()
factory.register_agent("ResearcherAgent", researcher_agent)
factory.register_agent("WriterAgent", writer_agent)
factory.register_agent("EditorAgent", editor_agent)

workflow = factory.create_workflow_from_yaml_path("content-pipeline.yaml")
result = await workflow.run({"topic": "AI in healthcare"})
```

### Conditional Agent Routing

Route requests to different agents based on the input or intermediate results.

**Use case**: Support systems that route to specialized agents based on issue type.

```yaml
name: support-router
description: Route to specialized support agents

inputs:
  category:
    type: string
    description: Support category (billing, technical, general)

actions:
  - kind: ConditionGroup
    id: route_request
    displayName: Route to appropriate agent
    conditions:
      - condition: =Workflow.Inputs.category = "billing"
        id: billing_route
        actions:
          - kind: InvokeAzureAgent
            id: billing_agent
            agent:
              name: BillingAgent
            conversationId: =System.ConversationId
      - condition: =Workflow.Inputs.category = "technical"
        id: technical_route
        actions:
          - kind: InvokeAzureAgent
            id: technical_agent
            agent:
              name: TechnicalAgent
            conversationId: =System.ConversationId
    elseActions:
      - kind: InvokeAzureAgent
        id: general_agent
        agent:
          name: GeneralAgent
        conversationId: =System.ConversationId
```

### Agent with External Loop

Continue agent interaction until a condition is met, such as the issue being resolved.

```yaml
name: support-conversation
description: Continue support until resolved

actions:
  - kind: SetVariable
    variable: Local.IsResolved
    value: false

  - kind: InvokeAzureAgent
    id: support_agent
    displayName: Support agent with external loop
    agent:
      name: SupportAgent
    conversationId: =System.ConversationId
    input:
      externalLoop:
        when: =Not(Local.IsResolved)
    output:
      responseObject: Local.SupportResult

  - kind: SendActivity
    activity:
      text: "Thank you for contacting support. Your issue has been resolved."
```

## Loop Control Patterns

### RepeatUntil with Max Iterations

Implement loops with an explicit maximum iteration count to avoid infinite loops:

```yaml
name: safe-repeat
description: RepeatUntil with max iterations

actions:
  - kind: SetVariable
    variable: Local.counter
    value: 0

  - kind: SetVariable
    variable: Local.maxIterations
    value: 10

  - kind: RepeatUntil
    id: safe_loop
    condition: =Local.counter >= Local.maxIterations
    actions:
      - kind: SetVariable
        variable: Local.counter
        value: =Local.counter + 1
      - kind: SendActivity
        activity:
          text: =Concat("Iteration ", Local.counter)
```

### Counter-Based Loops with GotoAction

Implement traditional counting loops using variables and GotoAction for non-linear flow:

```yaml
name: counter-loop
description: Process items with a counter

actions:
  - kind: SetVariable
    variable: Local.counter
    value: 0

  - kind: SetVariable
    variable: Local.maxIterations
    value: 5

  - kind: SetVariable
    id: loop_start
    variable: Local.counter
    value: =Local.counter + 1

  - kind: SendActivity
    activity:
      text: =Concat("Processing iteration ", Local.counter)

  - kind: SetVariable
    variable: Local.result
    value: =Concat("Result from iteration ", Local.counter)

  - kind: If
    condition: =Local.counter < Local.maxIterations
    then:
      - kind: GotoAction
        actionId: loop_start
    else:
      - kind: SendActivity
        activity:
          text: "Loop complete!"
```

### Early Exit with BreakLoop

Use BreakLoop to exit Foreach or RepeatUntil when a condition is met:

```yaml
name: search-workflow
description: Search through items and stop when found

actions:
  - kind: SetVariable
    variable: Local.found
    value: false

  - kind: Foreach
    source: =Workflow.Inputs.items
    itemName: currentItem
    actions:
      - kind: If
        condition: =currentItem.id = Workflow.Inputs.targetId
        then:
          - kind: SetVariable
            variable: Local.found
            value: true
          - kind: SetVariable
            variable: Local.result
            value: =currentItem
          - kind: BreakLoop

      - kind: SendActivity
        activity:
          text: =Concat("Checked item: ", currentItem.name)

  - kind: If
    condition: =Local.found
    then:
      - kind: SendActivity
        activity:
          text: =Concat("Found: ", Local.result.name)
    else:
      - kind: SendActivity
        activity:
          text: "Item not found"
```

### Iterative Agent Conversation (Student-Teacher)

Create back-and-forth conversations between agents with controlled iteration using GotoAction:

```yaml
name: student-teacher
description: Iterative learning conversation

kind: Workflow
trigger:
  kind: OnConversationStart
  id: learning_session
  actions:
    - kind: SetVariable
      id: init_counter
      variable: Local.TurnCount
      value: 0

    - kind: SendActivity
      id: start_message
      activity:
        text: =Concat("Starting session for: ", Workflow.Inputs.problem)

    - kind: SendActivity
      id: student_label
      activity:
        text: "\n[Student]:"

    - kind: InvokeAzureAgent
      id: student_attempt
      conversationId: =System.ConversationId
      agent:
        name: StudentAgent

    - kind: SendActivity
      id: teacher_label
      activity:
        text: "\n[Teacher]:"

    - kind: InvokeAzureAgent
      id: teacher_review
      conversationId: =System.ConversationId
      agent:
        name: TeacherAgent
      output:
        messages: Local.TeacherResponse

    - kind: SetVariable
      id: increment
      variable: Local.TurnCount
      value: =Local.TurnCount + 1

    - kind: ConditionGroup
      id: check_completion
      conditions:
        - condition: =Not(IsBlank(Find("congratulations", Local.TeacherResponse)))
          id: success_check
          actions:
            - kind: SendActivity
              activity:
                text: "Session complete - student succeeded!"
            - kind: SetVariable
              variable: Workflow.Outputs.result
              value: success
        - condition: =Local.TurnCount < 4
          id: continue_check
          actions:
            - kind: GotoAction
              actionId: student_label
      elseActions:
        - kind: SendActivity
          activity:
            text: "Session ended - turn limit reached."
        - kind: SetVariable
          variable: Workflow.Outputs.result
          value: timeout
```

## Human-in-the-Loop Patterns

### Survey-Style Multi-Field Input

Collect multiple pieces of information from the user:

```yaml
name: customer-survey
description: Interactive customer feedback survey

actions:
  - kind: SendActivity
    activity:
      text: "Welcome to our customer feedback survey!"

  - kind: Question
    id: ask_name
    question:
      text: "What is your name?"
    variable: Local.userName
    default: "Anonymous"

  - kind: SendActivity
    activity:
      text: =Concat("Nice to meet you, ", Local.userName, "!")

  - kind: Question
    id: ask_rating
    question:
      text: "How would you rate our service? (1-5)"
    variable: Local.rating
    default: "3"

  - kind: If
    condition: =Local.rating >= 4
    then:
      - kind: SendActivity
        activity:
          text: "Thank you for the positive feedback!"
    else:
      - kind: Question
        id: ask_improvement
        question:
          text: "What could we improve?"
        variable: Local.feedback

  - kind: RequestExternalInput
    id: additional_comments
    prompt:
      text: "Any additional comments? (optional)"
    variable: Local.comments
    default: ""

  - kind: SendActivity
    activity:
      text: =Concat("Thank you, ", Local.userName, "! Your feedback has been recorded.")

  - kind: SetVariable
    variable: Workflow.Outputs.survey
    value:
      name: =Local.userName
      rating: =Local.rating
      feedback: =Local.feedback
      comments: =Local.comments
```

### Approval Gate Pattern

Request approval before proceeding:

```yaml
name: approval-workflow
description: Request approval before processing

inputs:
  requestType:
    type: string
    description: Type of request
  amount:
    type: number
    description: Request amount

actions:
  - kind: SendActivity
    activity:
      text: =Concat("Processing ", Workflow.Inputs.requestType, " request for $", Workflow.Inputs.amount)

  - kind: If
    condition: =Workflow.Inputs.amount > 1000
    then:
      - kind: SendActivity
        activity:
          text: "This request requires manager approval."

      - kind: Confirmation
        id: get_approval
        question:
          text: =Concat("Do you approve this ", Workflow.Inputs.requestType, " request for $", Workflow.Inputs.amount, "?")
        variable: Local.approved

      - kind: If
        condition: =Local.approved
        then:
          - kind: SendActivity
            activity:
              text: "Request approved. Processing..."
          - kind: SetVariable
            variable: Workflow.Outputs.status
            value: approved
        else:
          - kind: SendActivity
            activity:
              text: "Request denied."
          - kind: SetVariable
            variable: Workflow.Outputs.status
            value: denied
    else:
      - kind: SendActivity
        activity:
          text: "Request auto-approved (under threshold)."
      - kind: SetVariable
        variable: Workflow.Outputs.status
        value: auto_approved
```

## Complete Support Ticket Workflow

Comprehensive example combining multi-agent routing, conditional logic, and conversation management:

```yaml
name: support-ticket-workflow
description: Complete support ticket handling with escalation

kind: Workflow
trigger:
  kind: OnConversationStart
  id: support_workflow
  actions:
    - kind: InvokeAzureAgent
      id: self_service
      displayName: Self-service agent
      agent:
        name: SelfServiceAgent
      conversationId: =System.ConversationId
      input:
        externalLoop:
          when: =Not(Local.ServiceResult.IsResolved)
      output:
        responseObject: Local.ServiceResult

    - kind: If
      condition: =Local.ServiceResult.IsResolved
      then:
        - kind: SendActivity
          activity:
            text: "Issue resolved through self-service."
        - kind: SetVariable
          variable: Workflow.Outputs.resolution
          value: self_service
        - kind: EndWorkflow
          id: end_resolved

    - kind: SendActivity
      activity:
        text: "Creating support ticket..."

    - kind: SetVariable
      variable: Local.TicketId
      value: =Concat("TKT-", System.ConversationId)

    - kind: ConditionGroup
      id: route_ticket
      conditions:
        - condition: =Local.ServiceResult.Category = "technical"
          id: technical_route
          actions:
            - kind: InvokeAzureAgent
              id: technical_support
              agent:
                name: TechnicalSupportAgent
              conversationId: =System.ConversationId
              output:
                responseObject: Local.TechResult
        - condition: =Local.ServiceResult.Category = "billing"
          id: billing_route
          actions:
            - kind: InvokeAzureAgent
              id: billing_support
              agent:
                name: BillingSupportAgent
              conversationId: =System.ConversationId
              output:
                responseObject: Local.BillingResult
      elseActions:
        - kind: SendActivity
          activity:
            text: "Escalating to human support..."
        - kind: SetVariable
          variable: Workflow.Outputs.resolution
          value: escalated

    - kind: SendActivity
      activity:
        text: =Concat("Ticket ", Local.TicketId, " has been processed.")
```

## Naming Conventions

Use clear, descriptive names for actions and variables:

```yaml
# Good
- kind: SetVariable
  id: calculate_total_price
  variable: Local.orderTotal

# Avoid
- kind: SetVariable
  id: sv1
  variable: Local.x
```

### Recommended Patterns

- **Action IDs**: Use snake_case descriptive names (`check_age`, `route_by_category`, `send_welcome`)
- **Variables**: Use camelCase for semantic clarity (`Local.orderTotal`, `Local.userName`)
- **Display names**: Human-readable for logging (`"Set greeting message"`, `"Route to appropriate agent"`)

## Organizing Large Workflows

Break complex workflows into logical sections with comments:

```yaml
actions:
  # === INITIALIZATION ===
  - kind: SetVariable
    id: init_status
    variable: Local.status
    value: started

  # === DATA COLLECTION ===
  - kind: Question
    id: collect_name
    question:
      text: "What is your name?"
    variable: Local.userName

  # === PROCESSING ===
  - kind: InvokeAzureAgent
    id: process_request
    agent:
      name: ProcessingAgent
    output:
      responseObject: Local.AgentResult

  # === OUTPUT ===
  - kind: SendActivity
    id: send_result
    activity:
      text: =Local.AgentResult.message
```

## Error Handling

Use conditional checks to handle potential issues:

```yaml
actions:
  - kind: SetVariable
    variable: Local.hasError
    value: false

  - kind: InvokeAzureAgent
    id: call_agent
    agent:
      name: ProcessingAgent
    output:
      responseObject: Local.AgentResult

  - kind: If
    condition: =IsBlank(Local.AgentResult)
    then:
      - kind: SetVariable
        variable: Local.hasError
        value: true
      - kind: SendActivity
        activity:
          text: "An error occurred during processing."
    else:
      - kind: SendActivity
        activity:
          text: =Local.AgentResult.message
```

### Error Handling Practices

1. **Guard against null/blank**: Use `IsBlank()` before accessing agent or workflow outputs
2. **Provide defaults**: Use `default` on Question and RequestExternalInput for optional user input
3. **Avoid infinite loops**: Ensure GotoAction and RepeatUntil have clear exit conditions; use max iterations when appropriate
4. **Debug with SendActivity**: Emit state for troubleshooting during development:

```yaml
- kind: SendActivity
  id: debug_log
  activity:
    text: =Concat("[DEBUG] Current state: counter=", Local.counter, ", status=", Local.status)
```

### Testing Strategies

1. **Start simple**: Test basic flows before adding complexity
2. **Use default values**: Provide sensible defaults for inputs
3. **Add logging**: Use SendActivity for debugging during development
4. **Test edge cases**: Verify behavior with missing or invalid inputs
