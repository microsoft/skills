# Backend Tools, Frontend Tools, HITL, and State (Python)

This reference covers backend tools with `@ai_function`, frontend tools with `AGUIClientWithTools`, human-in-the-loop (HITL) approvals, and bidirectional state management with Pydantic and JSON Patch.

## Table of Contents

- [Backend Tools](#backend-tools) — `@ai_function`, multiple tools, tool events, class organization, error handling
- [Frontend Tools](#frontend-tools) — Defining frontend tools, `AGUIClientWithTools`, protocol flow
- [Human-in-the-Loop (HITL)](#human-in-the-loop-hitl) — Approval modes, `AgentFrameworkAgent` wrapper, approval events, custom confirmation
- [State Management](#state-management) — Pydantic state, `state_schema`, `predict_state_config`, `STATE_SNAPSHOT`, `STATE_DELTA`, client handling

## Backend Tools

Backend tools execute on the server. Results are streamed to the client in real-time.

### Basic Function Tool

Use the `@ai_function` decorator to register a function as a tool:

```python
from typing import Annotated
from pydantic import Field
from agent_framework import ai_function


@ai_function
def get_weather(
    location: Annotated[str, Field(description="The city")],
) -> str:
    """Get the current weather for a location."""
    return f"The weather in {location} is sunny with a temperature of 22°C."
```

### Key Concepts

- **`@ai_function` decorator**: Marks a function as available to the agent
- **Type annotations**: Provide type information for parameters
- **`Annotated` and `Field`**: Add descriptions to help the agent
- **Docstring**: Describes what the function does
- **Return value**: Result returned to the agent and streamed to the client

### Multiple Tools

```python
from typing import Any
from agent_framework import ai_function


@ai_function
def get_weather(
    location: Annotated[str, Field(description="The city.")],
) -> str:
    """Get the current weather for a location."""
    return f"The weather in {location} is sunny with a temperature of 22°C."


@ai_function
def get_forecast(
    location: Annotated[str, Field(description="The city.")],
    days: Annotated[int, Field(description="Number of days to forecast")] = 3,
) -> dict[str, Any]:
    """Get the weather forecast for a location."""
    return {
        "location": location,
        "days": days,
        "forecast": [
            {"day": 1, "weather": "Sunny", "high": 24, "low": 18},
            {"day": 2, "weather": "Partly cloudy", "high": 22, "low": 17},
            {"day": 3, "weather": "Rainy", "high": 19, "low": 15},
        ],
    }
```

### Tool Events Streaming

When the agent calls a tool, the client receives:

```python
# 1. TOOL_CALL_START - Tool execution begins
{"type": "TOOL_CALL_START", "toolCallId": "call_abc123", "toolCallName": "get_weather"}

# 2. TOOL_CALL_ARGS - Tool arguments (may stream in chunks)
{"type": "TOOL_CALL_ARGS", "toolCallId": "call_abc123", "delta": "{\"location\": \"Paris, France\"}"}

# 3. TOOL_CALL_END - Arguments complete
{"type": "TOOL_CALL_END", "toolCallId": "call_abc123"}

# 4. TOOL_CALL_RESULT - Tool execution result
{"type": "TOOL_CALL_RESULT", "toolCallId": "call_abc123", "content": "The weather in Paris, France is sunny with a temperature of 22°C."}
```

### Tool Organization with Classes

```python
from agent_framework import ai_function


class WeatherTools:
    """Collection of weather-related tools."""

    def __init__(self, api_key: str):
        self.api_key = api_key

    @ai_function
    def get_current_weather(
        self,
        location: Annotated[str, Field(description="The city.")],
    ) -> str:
        """Get current weather for a location."""
        return f"Current weather in {location}: Sunny, 22°C"

    @ai_function
    def get_forecast(
        self,
        location: Annotated[str, Field(description="The city.")],
        days: Annotated[int, Field(description="Number of days")] = 3,
    ) -> dict[str, Any]:
        """Get weather forecast for a location."""
        return {"location": location, "forecast": [...]}


weather_tools = WeatherTools(api_key="your-api-key")

agent = ChatAgent(
    name="WeatherAgent",
    tools=[weather_tools.get_current_weather, weather_tools.get_forecast],
    ...
)
```

### Error Handling in Tools

```python
@ai_function
def get_weather(
    location: Annotated[str, Field(description="The city.")],
) -> str:
    """Get the current weather for a location."""
    try:
        result = call_weather_api(location)
        return f"The weather in {location} is {result['condition']} with temperature {result['temp']}°C."
    except Exception as e:
        return f"Unable to retrieve weather for {location}. Error: {str(e)}"
```

## Frontend Tools

Frontend tools execute on the client. The server sends `TOOL_CALL_REQUEST`; the client executes and returns results.

### Defining Frontend Tools

```python
from typing import Annotated
from pydantic import BaseModel, Field


class SensorReading(BaseModel):
    """Sensor reading from client device."""
    temperature: float
    humidity: float
    air_quality_index: int


def read_climate_sensors(
    include_temperature: Annotated[bool, Field(description="Include temperature")] = True,
    include_humidity: Annotated[bool, Field(description="Include humidity")] = True,
) -> SensorReading:
    """Read climate sensor data from the client device."""
    return SensorReading(
        temperature=22.5 if include_temperature else 0.0,
        humidity=45.0 if include_humidity else 0.0,
        air_quality_index=75,
    )


def get_user_location() -> dict:
    """Get the user's current GPS location."""
    return {"latitude": 52.3676, "longitude": 4.9041, "accuracy": 10.0, "city": "Amsterdam"}
```

### AGUIClientWithTools

```python
FRONTEND_TOOLS = {
    "read_climate_sensors": read_climate_sensors,
    "get_user_location": get_user_location,
}


class AGUIClientWithTools:
    """AG-UI client with frontend tool support."""

    def __init__(self, server_url: str, tools: dict):
        self.server_url = server_url
        self.tools = tools
        self.thread_id: str | None = None

    async def send_message(self, message: str) -> AsyncIterator[dict]:
        """Send a message and handle streaming response with tool execution."""
        tool_declarations = []
        for name, func in self.tools.items():
            tool_declarations.append({"name": name, "description": func.__doc__ or ""})

        request_data = {
            "messages": [
                {"role": "system", "content": "You are a helpful assistant with access to client tools."},
                {"role": "user", "content": message},
            ],
            "tools": tool_declarations,
        }

        if self.thread_id:
            request_data["thread_id"] = self.thread_id

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", self.server_url, json=request_data, headers={"Accept": "text/event-stream"}) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        event = json.loads(line[6:])
                        if event.get("type") == "TOOL_CALL_REQUEST":
                            await self._handle_tool_call(event, client)
                        else:
                            yield event
                        if event.get("type") == "RUN_STARTED" and not self.thread_id:
                            self.thread_id = event.get("threadId")

    async def _handle_tool_call(self, event: dict, client: httpx.AsyncClient):
        """Execute frontend tool and send result back to server."""
        tool_name = event.get("toolName")
        tool_call_id = event.get("toolCallId")
        arguments = event.get("arguments", {})

        tool_func = self.tools.get(tool_name)
        if not tool_func:
            raise ValueError(f"Unknown tool: {tool_name}")

        result = tool_func(**arguments)
        if hasattr(result, "model_dump"):
            result = result.model_dump()

        await client.post(
            f"{self.server_url}/tool_result",
            json={"tool_call_id": tool_call_id, "result": result},
        )
```

### Protocol Flow for Frontend Tools

1. **Client Registration**: Client sends tool declarations (names, descriptions, parameters) to server
2. **Server Orchestration**: AI agent decides when to call frontend tools
3. **TOOL_CALL_REQUEST**: Server sends event to client via SSE
4. **Client Execution**: Client executes the tool locally
5. **Result Submission**: Client POSTs result to server
6. **Agent Processing**: Server incorporates result and continues

## Human-in-the-Loop (HITL)

HITL requires user approval before executing certain tools.

### Marking Tools for Approval

Use `approval_mode="always_require"` in the `@ai_function` decorator:

```python
from agent_framework import ai_function
from typing import Annotated
from pydantic import Field


@ai_function(approval_mode="always_require")
def send_email(
    to: Annotated[str, Field(description="Email recipient address")],
    subject: Annotated[str, Field(description="Email subject line")],
    body: Annotated[str, Field(description="Email body content")],
) -> str:
    """Send an email to the specified recipient."""
    return f"Email sent to {to} with subject '{subject}'"


@ai_function(approval_mode="always_require")
def transfer_money(
    from_account: Annotated[str, Field(description="Source account number")],
    to_account: Annotated[str, Field(description="Destination account number")],
    amount: Annotated[float, Field(description="Amount to transfer")],
    currency: Annotated[str, Field(description="Currency code")] = "USD",
) -> str:
    """Transfer money between accounts."""
    return f"Transferred {amount} {currency} from {from_account} to {to_account}"
```

### Approval Modes

- **`always_require`**: Always request approval before execution
- **`never_require`**: Never request approval (default)
- **`conditional`**: Request approval based on custom logic

### Server with HITL

Wrap the agent with `AgentFrameworkAgent` and set `require_confirmation=True`:

```python
from agent_framework_ag_ui import AgentFrameworkAgent, add_agent_framework_fastapi_endpoint

agent = ChatAgent(
    name="BankingAssistant",
    instructions="You are a banking assistant. Always confirm details before performing transfers.",
    chat_client=chat_client,
    tools=[transfer_money, cancel_subscription, check_balance],
)

wrapped_agent = AgentFrameworkAgent(
    agent=agent,
    require_confirmation=True,
)

add_agent_framework_fastapi_endpoint(app, wrapped_agent, "/")
```

### Approval Events

**Approval Request:**

```python
{
    "type": "APPROVAL_REQUEST",
    "approvalId": "approval_abc123",
    "steps": [
        {
            "toolCallId": "call_xyz789",
            "toolCallName": "transfer_money",
            "arguments": {
                "from_account": "1234567890",
                "to_account": "0987654321",
                "amount": 500.00,
                "currency": "USD"
            }
        }
    ],
    "message": "Do you approve the following actions?"
}
```

**Approval Response (client sends):**

```python
# Approve
{"type": "APPROVAL_RESPONSE", "approvalId": "approval_abc123", "approved": True}

# Reject
{"type": "APPROVAL_RESPONSE", "approvalId": "approval_abc123", "approved": False}
```

### Custom Confirmation Strategy

```python
from typing import Any
from agent_framework_ag_ui import AgentFrameworkAgent, ConfirmationStrategy


class BankingConfirmationStrategy(ConfirmationStrategy):
    def on_approval_accepted(self, steps: list[dict[str, Any]]) -> str:
        tool_name = steps[0].get("toolCallName", "action")
        return f"Thank you for confirming. Proceeding with {tool_name}..."

    def on_approval_rejected(self, steps: list[dict[str, Any]]) -> str:
        return "Action cancelled. No changes have been made to your account."

    def on_state_confirmed(self) -> str:
        return "Changes confirmed and applied."

    def on_state_rejected(self) -> str:
        return "Changes discarded."


wrapped_agent = AgentFrameworkAgent(
    agent=agent,
    require_confirmation=True,
    confirmation_strategy=BankingConfirmationStrategy(),
)
```

## State Management

State management enables bidirectional sync between client and server.

### Define State with Pydantic

```python
from enum import Enum
from pydantic import BaseModel, Field


class SkillLevel(str, Enum):
    BEGINNER = "Beginner"
    INTERMEDIATE = "Intermediate"
    ADVANCED = "Advanced"


class Ingredient(BaseModel):
    icon: str = Field(..., description="Emoji icon, e.g., 🥕")
    name: str = Field(..., description="Name of the ingredient")
    amount: str = Field(..., description="Amount or quantity")


class Recipe(BaseModel):
    title: str = Field(..., description="The title of the recipe")
    skill_level: SkillLevel = Field(..., description="Skill level required")
    special_preferences: list[str] = Field(default_factory=list)
    cooking_time: str = Field(..., description="Estimated cooking time")
    ingredients: list[Ingredient] = Field(..., description="Ingredients")
    instructions: list[str] = Field(..., description="Step-by-step instructions")
```

### state_schema and predict_state_config

```python
state_schema = {
    "recipe": {"type": "object", "description": "The current recipe"},
}

predict_state_config = {
    "recipe": {"tool": "update_recipe", "tool_argument": "recipe"},
}
```

`predict_state_config` maps the `recipe` state field to the `recipe` argument of the `update_recipe` tool. As the LLM streams tool arguments, `STATE_DELTA` events are emitted for optimistic UI updates.

### State Update Tool

```python
@ai_function
def update_recipe(recipe: Recipe) -> str:
    """Update the recipe with new or modified content.

    You MUST write the complete recipe with ALL fields.
    When modifying, include ALL existing ingredients and instructions plus changes.
    NEVER delete existing data - only add or modify.
    """
    return "Recipe updated."
```

The parameter name `recipe` must match `tool_argument` in `predict_state_config`.

### Agent with State

```python
from agent_framework_ag_ui import AgentFrameworkAgent, RecipeConfirmationStrategy

recipe_agent = AgentFrameworkAgent(
    agent=agent,
    name="RecipeAgent",
    description="Creates and modifies recipes with streaming state updates",
    state_schema={"recipe": {"type": "object", "description": "The current recipe"}},
    predict_state_config={"recipe": {"tool": "update_recipe", "tool_argument": "recipe"}},
    confirmation_strategy=RecipeConfirmationStrategy(),
)
```

### STATE_SNAPSHOT Event

Full state emitted when the tool completes:

```json
{
    "type": "STATE_SNAPSHOT",
    "snapshot": {
        "recipe": {
            "title": "Classic Pasta Carbonara",
            "skill_level": "Intermediate",
            "cooking_time": "30 min",
            "ingredients": [
                {"icon": "🍝", "name": "Spaghetti", "amount": "400g"}
            ],
            "instructions": ["Bring a large pot of salted water to boil", "..."]
        }
    }
}
```

### STATE_DELTA Event

Incremental updates using JSON Patch, streamed as the LLM generates tool arguments:

```json
{
    "type": "STATE_DELTA",
    "delta": [
        {
            "op": "replace",
            "path": "/recipe",
            "value": {
                "title": "Classic Pasta Carbonara",
                "skill_level": "Intermediate",
                "ingredients": [{"icon": "🍝", "name": "Spaghetti", "amount": "400g"}]
            }
        }
    ]
}
```

Apply deltas on the client with `jsonpatch`:

```python
import jsonpatch

patch = jsonpatch.JsonPatch(content.delta)
state = patch.apply(state)
```

### Client State Handling

```python
state: dict[str, Any] = {}

async for update in agent.run_stream(message, thread=thread):
    if update.text:
        print(update.text, end="", flush=True)

    for content in update.contents:
        if hasattr(content, 'media_type') and content.media_type == 'application/json':
            state_data = json.loads(content.data.decode() if isinstance(content.data, bytes) else content.data)
            state = state_data
        if hasattr(content, 'delta') and content.delta:
            patch = jsonpatch.JsonPatch(content.delta)
            state = patch.apply(state)
```

### State with HITL

Combine state and approvals:

```python
recipe_agent = AgentFrameworkAgent(
    agent=agent,
    state_schema={"recipe": {"type": "object", "description": "The current recipe"}},
    predict_state_config={"recipe": {"tool": "update_recipe", "tool_argument": "recipe"}},
    require_confirmation=True,
    confirmation_strategy=RecipeConfirmationStrategy(),
)
```

When enabled: state updates stream via `STATE_DELTA`; agent requests approval; if approved, tool executes and `STATE_SNAPSHOT` is emitted; if rejected, predictive changes are discarded.

### Multiple State Fields

```python
predict_state_config = {
    "steps": {"tool": "generate_task_steps", "tool_argument": "steps"},
    "preferences": {"tool": "update_preferences", "tool_argument": "preferences"},
}
```

### Confirmation Strategies

- `DefaultConfirmationStrategy()` – Generic messages
- `RecipeConfirmationStrategy()` – Recipe-specific messages
- `DocumentWriterConfirmationStrategy()` – Document editing
- `TaskPlannerConfirmationStrategy()` – Task planning
- Custom: Inherit from `ConfirmationStrategy` and implement required methods
