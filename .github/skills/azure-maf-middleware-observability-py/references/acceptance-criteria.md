# Acceptance Criteria — maf-middleware-observability-py

Patterns and anti-patterns to validate code generated using this skill.

---

## 0a. Import Paths

#### CORRECT: Middleware imports
```python
from agent_framework import AgentRunContext, FunctionInvocationContext, ChatContext
from agent_framework import AgentMiddleware, agent_middleware, function_middleware, chat_middleware
```

#### CORRECT: Observability imports
```python
from agent_framework.observability import configure_otel_providers, get_tracer, get_meter
from agent_framework.observability import create_resource, enable_instrumentation
```

#### CORRECT: Purview imports
```python
from agent_framework.microsoft import PurviewPolicyMiddleware, PurviewSettings
```

#### INCORRECT: Wrong module paths
```python
from agent_framework.middleware import AgentMiddleware       # Wrong — top-level import
from agent_framework.middleware import agent_middleware      # Wrong — top-level import
from agent_framework import configure_otel_providers        # Wrong — use agent_framework.observability
from agent_framework.purview import PurviewPolicyMiddleware  # Wrong — use agent_framework.microsoft
```

---

## 0b. Authentication Patterns

#### CORRECT: Purview with InteractiveBrowserCredential
```python
from azure.identity import InteractiveBrowserCredential

purview_middleware = PurviewPolicyMiddleware(
    credential=InteractiveBrowserCredential(client_id="<clientId>"),
    settings=PurviewSettings(app_name="My Secure Agent")
)
```

#### CORRECT: Azure Monitor with connection string
```python
from azure.monitor.opentelemetry import configure_azure_monitor

configure_azure_monitor(connection_string="InstrumentationKey=...")
```

#### CORRECT: Azure AI Foundry client for telemetry
```python
from agent_framework.azure import AzureAIClient
from azure.identity.aio import AzureCliCredential

async with (
    AzureCliCredential() as credential,
    AzureAIClient(project_client=project_client) as client,
):
    await client.configure_azure_monitor(enable_live_metrics=True)
```

#### INCORRECT: Missing Purview package
```python
from agent_framework.microsoft import PurviewPolicyMiddleware
# Fails if agent-framework-purview is not installed
```

---

## 0c. Async Variants

#### CORRECT: All middleware functions are async
```python
import asyncio

async def my_middleware(context: AgentRunContext, next) -> None:
    print("Before")
    await next(context)  # Must await
    print("After")

async def main():
    agent = ChatAgent(chat_client=client, instructions="...", middleware=[my_middleware])
    result = await agent.run("Hello")

asyncio.run(main())
```

#### INCORRECT: Synchronous middleware
```python
def my_middleware(context: AgentRunContext, next) -> None:  # Wrong — must be async def
    next(context)  # Wrong — must await
```

#### Key Rules

- All middleware functions must be `async def`.
- Must `await next(context)` to continue the middleware chain.
- `configure_otel_providers()` is synchronous — call it before creating agents.
- `enable_instrumentation()` is synchronous.
- `AzureAIClient.configure_azure_monitor()` is async — must await inside async context.
- There are no synchronous variants of middleware functions.

---

## 1. Agent Run Middleware

#### CORRECT: Function-based agent middleware

```python
from agent_framework import AgentRunContext
from typing import Awaitable, Callable

async def logging_agent_middleware(
    context: AgentRunContext,
    next: Callable[[AgentRunContext], Awaitable[None]],
) -> None:
    print("[Agent] Starting execution")
    await next(context)
    print("[Agent] Execution completed")
```

#### CORRECT: Decorator-based agent middleware

```python
from agent_framework import agent_middleware

@agent_middleware
async def simple_agent_middleware(context, next):
    print("Before agent execution")
    await next(context)
    print("After agent execution")
```

#### CORRECT: Class-based agent middleware

```python
from agent_framework import AgentMiddleware, AgentRunContext

class LoggingAgentMiddleware(AgentMiddleware):
    async def process(self, context: AgentRunContext, next) -> None:
        print("[Agent] Starting")
        await next(context)
        print("[Agent] Done")
```

#### INCORRECT: Wrong base class or decorator

```python
from agent_framework import FunctionMiddleware

class MyAgentMiddleware(FunctionMiddleware):  # Wrong — should extend AgentMiddleware
    async def process(self, context, next):
        await next(context)
```

#### INCORRECT: Forgetting to call next

```python
async def bad_middleware(context: AgentRunContext, next) -> None:
    print("Processing...")
    # Wrong — must call await next(context) to continue the chain
    # unless intentionally terminating
```

---

## 2. Function Middleware

#### CORRECT: Function-based function middleware

```python
from agent_framework import FunctionInvocationContext
from typing import Awaitable, Callable

async def logging_function_middleware(
    context: FunctionInvocationContext,
    next: Callable[[FunctionInvocationContext], Awaitable[None]],
) -> None:
    print(f"[Function] Calling {context.function.name}")
    await next(context)
    print(f"[Function] {context.function.name} completed, result: {context.result}")
```

#### CORRECT: Decorator-based function middleware

```python
from agent_framework import function_middleware

@function_middleware
async def simple_function_middleware(context, next):
    print(f"Calling function: {context.function.name}")
    await next(context)
```

#### INCORRECT: Using wrong context type

```python
async def bad_function_middleware(
    context: AgentRunContext,  # Wrong — should be FunctionInvocationContext
    next,
) -> None:
    await next(context)
```

---

## 3. Chat Middleware

#### CORRECT: Function-based chat middleware

```python
from agent_framework import ChatContext
from typing import Awaitable, Callable

async def logging_chat_middleware(
    context: ChatContext,
    next: Callable[[ChatContext], Awaitable[None]],
) -> None:
    print(f"[Chat] Sending {len(context.messages)} messages to AI")
    await next(context)
    print("[Chat] AI response received")
```

#### CORRECT: Decorator-based chat middleware

```python
from agent_framework import chat_middleware

@chat_middleware
async def simple_chat_middleware(context, next):
    print(f"Processing {len(context.messages)} chat messages")
    await next(context)
```

---

## 4. Middleware Registration

#### CORRECT: Agent-level middleware (all runs)

```python
agent = ChatAgent(
    chat_client=client,
    instructions="You are helpful.",
    middleware=[logging_agent_middleware, logging_function_middleware]
)
```

#### CORRECT: Run-level middleware (single run)

```python
result = await agent.run(
    "Hello",
    middleware=[logging_chat_middleware]
)
```

#### CORRECT: Mixed agent-level and run-level

```python
agent = ChatAgent(
    chat_client=client,
    instructions="...",
    middleware=[security_middleware],  # All runs
)
result = await agent.run(
    "Query",
    middleware=[extra_logging],  # This run only
)
```

#### INCORRECT: Passing middleware as positional argument

```python
result = await agent.run("Hello", [logging_middleware])
# Wrong — middleware must be a keyword argument
```

---

## 5. Middleware Termination

#### CORRECT: Terminate with feedback

```python
async def blocking_middleware(context: AgentRunContext, next) -> None:
    if "blocked" in (context.messages[-1].text or "").lower():
        context.terminate = True
        return
    await next(context)
```

#### CORRECT: Function middleware termination with result

```python
async def rate_limit_middleware(context: FunctionInvocationContext, next) -> None:
    if not check_rate_limit(context.function.name):
        context.result = "Rate limit exceeded."
        context.terminate = True
        return
    await next(context)
```

#### INCORRECT: Setting terminate but still calling next

```python
async def bad_termination(context: AgentRunContext, next) -> None:
    context.terminate = True
    await next(context)  # Wrong — should return without calling next when terminating
```

---

## 6. Result Override

#### CORRECT: Non-streaming result override

```python
from agent_framework import AgentResponse, ChatMessage, Role

async def override_middleware(context: AgentRunContext, next) -> None:
    await next(context)
    if context.result is not None and not context.is_streaming:
        context.result = AgentResponse(
            messages=[ChatMessage(role=Role.ASSISTANT, text="Custom response")]
        )
```

#### CORRECT: Streaming result override

```python
from agent_framework import AgentResponseUpdate, TextContent

async def streaming_override(context: AgentRunContext, next) -> None:
    await next(context)
    if context.result is not None and context.is_streaming:
        async def override_stream():
            yield AgentResponseUpdate(contents=[TextContent(text="Custom chunk")])
        context.result = override_stream()
```

#### INCORRECT: Not checking is_streaming

```python
async def bad_override(context: AgentRunContext, next) -> None:
    await next(context)
    context.result = AgentResponse(...)  # Wrong if is_streaming=True — would break streaming
```

---

## 7. OpenTelemetry Configuration

#### CORRECT: Console exporters for development

```python
from agent_framework.observability import configure_otel_providers

configure_otel_providers(enable_console_exporters=True)
```

#### CORRECT: OTLP via environment variables

```bash
export ENABLE_INSTRUMENTATION=true
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

```python
configure_otel_providers()
```

#### CORRECT: Custom exporters

```python
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from agent_framework.observability import configure_otel_providers

exporters = [OTLPSpanExporter(endpoint="http://localhost:4317")]
configure_otel_providers(exporters=exporters, enable_sensitive_data=True)
```

#### CORRECT: Third-party setup (Azure Monitor)

```python
from azure.monitor.opentelemetry import configure_azure_monitor
from agent_framework.observability import create_resource, enable_instrumentation

configure_azure_monitor(
    connection_string="InstrumentationKey=...",
    resource=create_resource(),
    enable_live_metrics=True,
)
enable_instrumentation(enable_sensitive_data=False)
```

#### CORRECT: Azure AI Foundry client setup

```python
from agent_framework.azure import AzureAIClient
from azure.ai.projects.aio import AIProjectClient
from azure.identity.aio import AzureCliCredential

async with (
    AzureCliCredential() as credential,
    AIProjectClient(endpoint="https://<project>.foundry.azure.com", credential=credential) as project_client,
    AzureAIClient(project_client=project_client) as client,
):
    await client.configure_azure_monitor(enable_live_metrics=True)
```

#### INCORRECT: Calling configure_otel_providers after agent creation

```python
agent = ChatAgent(...)
result = await agent.run("Hello")
configure_otel_providers(enable_console_exporters=True)  # Wrong — must configure before creating agents
```

#### INCORRECT: Enabling sensitive data in production

```python
configure_otel_providers(enable_sensitive_data=True)
# Wrong for production — exposes prompts, responses, function args in traces
```

---

## 8. Custom Spans and Metrics

#### CORRECT: Using get_tracer and get_meter

```python
from agent_framework.observability import get_tracer, get_meter

tracer = get_tracer()
meter = get_meter()

with tracer.start_as_current_span("my_custom_operation"):
    pass

counter = meter.create_counter("my_custom_counter")
counter.add(1, {"key": "value"})
```

#### INCORRECT: Creating tracer directly without helper

```python
from opentelemetry import trace

tracer = trace.get_tracer("my_app")  # Works but won't use agent_framework instrumentation library name
```

---

## 9. Purview Integration

#### CORRECT: PurviewPolicyMiddleware setup

```python
from agent_framework.microsoft import PurviewPolicyMiddleware, PurviewSettings
from azure.identity import InteractiveBrowserCredential

purview_middleware = PurviewPolicyMiddleware(
    credential=InteractiveBrowserCredential(client_id="<clientId>"),
    settings=PurviewSettings(app_name="My Secure Agent")
)
agent = ChatAgent(
    chat_client=chat_client,
    instructions="You are a secure assistant.",
    middleware=[purview_middleware]
)
```

#### CORRECT: Install Purview package

```bash
pip install agent-framework-purview
```

#### INCORRECT: Wrong import path for Purview

```python
from agent_framework.purview import PurviewPolicyMiddleware  # Wrong module
from agent_framework.microsoft import PurviewPolicyMiddleware  # Correct
```

#### INCORRECT: Missing Purview package

```python
from agent_framework.microsoft import PurviewPolicyMiddleware
# Will fail if agent-framework-purview is not installed
```

---

## 10. Environment Variables Summary

| Variable | Default | Purpose |
|---|---|---|
| `ENABLE_INSTRUMENTATION` | `false` | Enable OpenTelemetry instrumentation |
| `ENABLE_SENSITIVE_DATA` | `false` | Log prompts, responses, function args (dev only) |
| `ENABLE_CONSOLE_EXPORTERS` | `false` | Console output for telemetry |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | OTLP collector endpoint |
| `OTEL_SERVICE_NAME` | `agent_framework` | Service name in traces |
| `VS_CODE_EXTENSION_PORT` | — | AI Toolkit / Azure AI Foundry VS Code extension |
