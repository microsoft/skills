---
name: azure-maf-middleware-observability-py
description: This skill should be used when the user asks about "middleware", "observability", "OpenTelemetry", "logging", "telemetry", "Purview", "governance", "agent middleware", "function middleware", "tracing", "@agent_middleware", "@function_middleware", or needs guidance on cross-cutting concerns, monitoring, validation, or compliance in Microsoft Agent Framework Python. Make sure to use this skill whenever the user mentions intercepting agent runs, validating function arguments, logging agent calls, configuring traces or metrics, Azure Monitor for agents, Aspire Dashboard, DLP policies for AI, or any request/response transformation pipeline, even if they don't explicitly say "middleware" or "observability".
version: 0.1.0
---

# MAF Middleware and Observability

This skill provides guidance for cross-cutting concerns in Microsoft Agent Framework Python: logging, validation, telemetry, and governance. Use it when implementing middleware pipelines, OpenTelemetry observability, or Microsoft Purview policy enforcement for agents.

## Middleware Types Overview

Agent Framework Python supports three types of middleware, each with its own context and interception point:

### 1. Agent Run Middleware

Intercepts agent run execution (input messages, output response). Use for logging runs, timing, security checks, or modifying agent responses. Context: `AgentRunContext` (agent, messages, is_streaming, metadata, result, terminate, kwargs). Decorate with `@agent_middleware` or extend `AgentMiddleware`.

### 2. Function Middleware

Intercepts function tool invocations. Use for validating arguments, logging function calls, rate limiting, or replacing function results. Context: `FunctionInvocationContext` (function, arguments, metadata, result, terminate, kwargs). Decorate with `@function_middleware` or extend `FunctionMiddleware`.

### 3. Chat Middleware

Intercepts chat requests sent to the AI model. Use for inspecting or modifying prompts before they reach the inference service, or transforming responses. Context: `ChatContext` (chat_client, messages, options, is_streaming, metadata, result, terminate, kwargs). Decorate with `@chat_middleware` or extend `ChatMiddleware`.

## Middleware Registration Scopes

Register middleware at two levels:

- **Agent-level**: Pass `middleware=[...]` when creating the agent. Applies to all runs.
- **Run-level**: Pass `middleware=[...]` to `agent.run()`. Applies only to that specific run.

Execution order: agent middleware (outermost) → run middleware (innermost) → agent execution.

## Middleware Control Flow

- **Continue**: Call `await next(context)` to pass control down the chain. The agent or function executes, and context.result is populated.
- **Terminate**: Set `context.terminate = True` and return without calling `next`. Skips execution. Optionally set `context.result` to provide feedback.
- **Result override**: After `await next(context)`, modify `context.result` to transform the output. Handle both non-streaming (`AgentResponse`) and streaming (async generator) via `context.is_streaming`.

If docs/examples use `call_next`, treat it as the same middleware continuation concept and prefer the signature used by your installed SDK.

## OpenTelemetry Observability Basics

Agent Framework emits traces, logs, and metrics according to [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/).

### Quick Setup

Call `configure_otel_providers()` before creating agents. For local development with console output:

```python
from agent_framework.observability import configure_otel_providers

configure_otel_providers(enable_console_exporters=True)
```

For OTLP export (e.g., Aspire Dashboard, Jaeger):

```bash
export ENABLE_INSTRUMENTATION=true
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

```python
configure_otel_providers()  # Reads OTEL_EXPORTER_OTLP_* automatically
```

### Spans and Metrics

- **invoke_agent &lt;agent_name&gt;**: Top-level span for each agent invocation.
- **chat &lt;model_name&gt;**: Span for chat model calls.
- **execute_tool &lt;function_name&gt;**: Span for function tool execution.

Metrics include `gen_ai.client.operation.duration`, `gen_ai.client.token.usage`, and `agent_framework.function.invocation.duration`.

### Environment Variables

- `ENABLE_INSTRUMENTATION` – Default `false`. Set to `true` to enable instrumentation.
- `ENABLE_SENSITIVE_DATA` – Default `false`. Set to `true` only in dev/test to log prompts, responses, function args.
- `ENABLE_CONSOLE_EXPORTERS` – Default `false`. Set to `true` for console output.
- `OTEL_EXPORTER_OTLP_*`, `OTEL_SERVICE_NAME`, etc. – Standard OpenTelemetry variables.

### Supported Observability Setup Patterns

1. Environment variable-only setup for fast onboarding.
2. Programmatic setup with custom exporters/processors.
3. Third-party backend integration (for example, Langfuse-compatible OpenTelemetry ingestion).
4. Azure Monitor integration where supported by the client/runtime.
5. Zero-code or auto-instrumentation patterns where available in your deployment environment.

## Governance with Microsoft Purview

Microsoft Purview provides DLP policy enforcement and audit logging for AI applications. Integrate via `PurviewPolicyMiddleware` to block sensitive content and log agent interactions for compliance.

### Installation

```bash
pip install agent-framework-purview
```

### Basic Integration

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

Purview middleware intercepts prompts and responses; DLP policies configured in Purview determine what gets blocked or logged. Requires Entra app registration with appropriate Microsoft Graph permissions and Purview policy configuration.

## When to Use Each Concern

| Concern | Use Case |
|---------|----------|
| Agent middleware | Request/response logging, timing, security validation, response transformation |
| Function middleware | Argument validation, function call logging, rate limiting, result replacement |
| Chat middleware | Prompt sanitization, AI input/output inspection, chat-level transforms |
| OpenTelemetry | Traces, metrics, logs for dashboards and monitoring |
| Purview | DLP blocking, audit logging, compliance with organizational policies |

## Additional Resources

### Reference Files

For detailed patterns, setup, and full code examples:

- **`references/middleware-patterns.md`** – AgentRunContext, FunctionInvocationContext, ChatContext, decorators (`@agent_middleware`, `@function_middleware`, `@chat_middleware`), class-based middleware, termination, result override, factory patterns
- **`references/observability-setup.md`** – `configure_otel_providers()`, Azure Monitor, Aspire Dashboard, Langfuse, GenAI semantic conventions, environment variables
- **`references/governance.md`** – PurviewPolicyMiddleware, PurviewSettings, DLP policies, audit logging, compliance patterns
- **`references/acceptance-criteria.md`** – Correct/incorrect patterns for agent/function/chat middleware, registration scopes, termination, result overrides, OpenTelemetry configuration, custom spans/metrics, and Purview integration

### Provider and Version Caveats

- Middleware context types and callback names can differ slightly between releases; align to current Python API docs.
- Purview auth setup may require environment-based app configuration in enterprise deployments.
