# Declarative Workflows — Expressions and Variables

Reference for the expression language and variable management system in Microsoft Agent Framework Python declarative workflows.

## Table of Contents

- **Variable Namespaces** — Local, Workflow.Inputs, Workflow.Outputs, System, Agent scopes and access levels
- **Expression Language** — Literal vs expression syntax, comparison/logical/mathematical operators
- **String Functions** — Concat, IsBlank
- **Conditional Expressions** — If function, nested conditions
- **Additional Functions** — Find (string search)
- **Python Examples** — User categorization, conditional greeting, input validation

## Overview

Declarative workflows use a namespaced variable system and a PowerFx-like expression language to manage state and compute dynamic values. Reference variables within expressions using the full path (e.g., `Workflow.Inputs.name`, `Local.message`). Prefix values with `=` to evaluate them at runtime.

## Variable Namespaces

### Available Namespaces

| Namespace | Description | Access |
|-----------|-------------|--------|
| `Local.*` | Workflow-local variables | Read/Write |
| `Workflow.Inputs.*` | Input parameters passed to the workflow | Read-only |
| `Workflow.Outputs.*` | Values returned from the workflow | Read/Write |
| `System.*` | System-provided values | Read-only |
| `Agent.*` | Results from agent invocations | Read-only |

### Local Variables

Use `Local.*` for temporary values during workflow execution:

```yaml
actions:
  - kind: SetVariable
    variable: Local.counter
    value: 0

  - kind: SetVariable
    variable: Local.message
    value: "Processing..."

  - kind: SetVariable
    variable: Local.items
    value: []
```

### Workflow Inputs

Access input parameters using `Workflow.Inputs.*`:

```yaml
name: process-order
inputs:
  orderId:
    type: string
    description: The order ID to process
  quantity:
    type: integer
    description: Number of items

actions:
  - kind: SetVariable
    variable: Local.order
    value: =Workflow.Inputs.orderId

  - kind: SetVariable
    variable: Local.total
    value: =Workflow.Inputs.quantity
```

### Workflow Outputs

Store results in `Workflow.Outputs.*` to return values from the workflow:

```yaml
actions:
  - kind: SetVariable
    variable: Local.result
    value: "Calculation complete"

  - kind: SetVariable
    variable: Workflow.Outputs.status
    value: success

  - kind: SetVariable
    variable: Workflow.Outputs.message
    value: =Local.result
```

### System Variables

Access system-provided values through the `System.*` namespace:

| Variable | Description |
|----------|-------------|
| `System.ConversationId` | Current conversation identifier |
| `System.LastMessage` | The most recent message |
| `System.Timestamp` | Current timestamp |

```yaml
actions:
  - kind: SetVariable
    variable: Local.conversationRef
    value: =System.ConversationId
```

### Agent Variables

After invoking an agent, access response data through the output variable path (e.g., `Local.AgentResult` when using `output.responseObject`):

```yaml
actions:
  - kind: InvokeAzureAgent
    id: call_assistant
    agent:
      name: MyAgent
    output:
      responseObject: Local.AgentResult

  - kind: SendActivity
    activity:
      text: =Local.AgentResult.text
```

## Expression Language

### Expression Syntax

Values prefixed with `=` are evaluated as expressions at runtime. Reference variables by their full path within the expression.

```yaml
# Literal string (stored as-is)
value: Hello World

# Expression (evaluated at runtime)
value: =Concat("Hello ", Workflow.Inputs.name)

# Literal number
value: 42

# Expression returning a number
value: =Workflow.Inputs.quantity * 2
```

### Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equal to | `=Workflow.Inputs.status = "active"` |
| `<>` | Not equal to | `=Workflow.Inputs.status <> "deleted"` |
| `<` | Less than | `=Workflow.Inputs.age < 18` |
| `>` | Greater than | `=Workflow.Inputs.count > 0` |
| `<=` | Less than or equal | `=Workflow.Inputs.score <= 100` |
| `>=` | Greater than or equal | `=Workflow.Inputs.quantity >= 1` |

### Logical Operators

Use `And`, `Or`, and `Not` for boolean logic:

```yaml
# Or - returns true if any condition is true
condition: =Or(Workflow.Inputs.role = "admin", Workflow.Inputs.role = "moderator")

# And - returns true if all conditions are true
condition: =And(Workflow.Inputs.age >= 18, Workflow.Inputs.hasConsent)

# Not - negates a condition
condition: =Not(IsBlank(Workflow.Inputs.email))
```

### Mathematical Operators

```yaml
# Addition
value: =Workflow.Inputs.price + Workflow.Inputs.tax

# Subtraction
value: =Workflow.Inputs.total - Workflow.Inputs.discount

# Multiplication
value: =Workflow.Inputs.quantity * Workflow.Inputs.unitPrice

# Division
value: =Workflow.Inputs.total / Workflow.Inputs.count
```

### String Functions

#### Concat

Concatenate multiple strings:

```yaml
value: =Concat("Hello, ", Workflow.Inputs.name, "!")
# Result: "Hello, Alice!" (if Workflow.Inputs.name is "Alice")

value: =Concat(Local.firstName, " ", Local.lastName)
# Result: "John Doe"
```

#### IsBlank

Check if a value is empty or undefined:

```yaml
condition: =IsBlank(Workflow.Inputs.optionalParam)
# Returns true if the parameter is not provided

value: =If(IsBlank(Workflow.Inputs.name), "Guest", Workflow.Inputs.name)
# Returns "Guest" if name is blank, otherwise returns the name
```

### Conditional Expressions

#### If Function

Return different values based on a condition:

```yaml
value: =If(Workflow.Inputs.age < 18, "minor", "adult")

value: =If(Local.count > 0, "Items found", "No items")

# Nested conditions
value: =If(Workflow.Inputs.role = "admin", "Full access", If(Workflow.Inputs.role = "user", "Limited access", "No access"))
```

### Additional Functions

#### Find

Search within a string:

```yaml
condition: =Not(IsBlank(Find("congratulations", Local.TeacherResponse)))
```

#### Upper and Lower

Normalize string casing when comparing or formatting output:

```yaml
value: =Upper(Workflow.Inputs.countryCode)
# Example result: "US"

value: =Lower(Workflow.Inputs.emailDomain)
# Example result: "example.com"
```

## Python Examples

### User Categorization

```yaml
name: categorize-user
inputs:
  age:
    type: integer
    description: User's age

actions:
  - kind: SetVariable
    variable: Local.age
    value: =Workflow.Inputs.age

  - kind: SetVariable
    variable: Local.category
    value: =If(Local.age < 13, "child", If(Local.age < 20, "teenager", If(Local.age < 65, "adult", "senior")))

  - kind: SendActivity
    activity:
      text: =Concat("You are categorized as: ", Local.category)

  - kind: SetVariable
    variable: Workflow.Outputs.category
    value: =Local.category
```

### Conditional Greeting

```yaml
name: smart-greeting
inputs:
  name:
    type: string
    description: User's name (optional)
  timeOfDay:
    type: string
    description: morning, afternoon, or evening

actions:
  - kind: SetVariable
    variable: Local.timeGreeting
    value: =If(Workflow.Inputs.timeOfDay = "morning", "Good morning", If(Workflow.Inputs.timeOfDay = "afternoon", "Good afternoon", "Good evening"))

  - kind: SetVariable
    variable: Local.userName
    value: =If(IsBlank(Workflow.Inputs.name), "friend", Workflow.Inputs.name)

  - kind: SetVariable
    variable: Local.fullGreeting
    value: =Concat(Local.timeGreeting, ", ", Local.userName, "!")

  - kind: SendActivity
    activity:
      text: =Local.fullGreeting
```

### Input Validation

```yaml
name: validate-order
inputs:
  quantity:
    type: integer
    description: Number of items to order
  email:
    type: string
    description: Customer email

actions:
  - kind: SetVariable
    variable: Local.isValidQuantity
    value: =And(Workflow.Inputs.quantity > 0, Workflow.Inputs.quantity <= 100)

  - kind: SetVariable
    variable: Local.hasEmail
    value: =Not(IsBlank(Workflow.Inputs.email))

  - kind: SetVariable
    variable: Local.isValid
    value: =And(Local.isValidQuantity, Local.hasEmail)

  - kind: If
    condition: =Local.isValid
    then:
      - kind: SendActivity
        activity:
          text: "Order validated successfully!"
    else:
      - kind: SendActivity
        activity:
          text: =If(Not(Local.isValidQuantity), "Invalid quantity (must be 1-100)", "Email is required")
```
