# Observability Setup - Microsoft Agent Framework Python

This reference covers configuring OpenTelemetry observability for Microsoft Agent Framework Python: `configure_otel_providers`, environment variables, Azure Monitor, Aspire Dashboard, Langfuse, and GenAI semantic conventions.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Five Configuration Patterns](#five-configuration-patterns)
- [Environment Variables](#environment-variables)
- [Dependencies](#dependencies)
- [Azure Monitor Setup](#azure-monitor-setup)
- [Aspire Dashboard](#aspire-dashboard)
- [Langfuse Integration](#langfuse-integration)
- [GenAI Semantic Conventions](#genai-semantic-conventions)
- [Custom Spans and Metrics](#custom-spans-and-metrics)
- [Example Trace Output](#example-trace-output)
- [Minimal Complete Example](#minimal-complete-example)
- [Samples](#samples)

---

## Prerequisites

Install the Agent Framework with observability support:

```bash
pip install agent-framework --pre
```

For console output during development, no additional packages are needed. For other exporters, install as needed (see Dependencies below).

---

## Five Configuration Patterns

### 1. Standard OpenTelemetry Environment Variables (Recommended)

Configure everything via environment variables. Call `configure_otel_providers()` without arguments to read `OTEL_EXPORTER_OTLP_*` and related variables automatically:

```python
from agent_framework.observability import configure_otel_providers

# Reads OTEL_EXPORTER_OTLP_* environment variables automatically
configure_otel_providers()
```

For local development with console output:

```python
configure_otel_providers(enable_console_exporters=True)
```

Example environment setup:

```bash
export ENABLE_INSTRUMENTATION=true
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

### 2. Custom Exporters

Create exporters explicitly and pass them to `configure_otel_providers()`:

```python
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.common import Compression
from agent_framework.observability import configure_otel_providers

exporters = [
    OTLPSpanExporter(endpoint="http://localhost:4317", compression=Compression.Gzip),
    OTLPLogExporter(endpoint="http://localhost:4317"),
    OTLPMetricExporter(endpoint="http://localhost:4317"),
]

configure_otel_providers(exporters=exporters, enable_sensitive_data=True)
```

Install gRPC exporters:

```bash
pip install opentelemetry-exporter-otlp-proto-grpc
```

For HTTP protocol:

```bash
pip install opentelemetry-exporter-otlp-proto-http
```

### 3. Third-Party Setup (Azure Monitor, Langfuse)

When using third-party packages with their own setup, configure them first, then call `enable_instrumentation()` to activate Agent Framework's telemetry code paths.

#### Azure Monitor

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

Install the Azure Monitor package:

```bash
pip install azure-monitor-opentelemetry
```

#### Langfuse

```python
from agent_framework.observability import enable_instrumentation
from langfuse import get_client

langfuse = get_client()

if langfuse.auth_check():
    print("Langfuse client is authenticated and ready!")

enable_instrumentation(enable_sensitive_data=False)
```

`enable_instrumentation()` is optional if `ENABLE_INSTRUMENTATION` and/or `ENABLE_SENSITIVE_DATA` are set in environment variables.

### 4. Manual Setup

For complete control, set up exporters, providers, and instrumentation manually. Use `create_resource()` to create a resource with the appropriate service name and version:

```python
from agent_framework.observability import create_resource, enable_instrumentation

resource = create_resource()  # Uses OTEL_SERVICE_NAME, OTEL_SERVICE_VERSION, etc.
enable_instrumentation()
```

See the [OpenTelemetry Python documentation](https://opentelemetry.io/docs/languages/python/instrumentation/) for manual instrumentation details.

### 5. Auto-Instrumentation (Zero-Code)

Use the OpenTelemetry CLI to instrument without code changes:

```bash
opentelemetry-instrument \
    --traces_exporter console,otlp \
    --metrics_exporter console \
    --service_name your-service-name \
    --exporter_otlp_endpoint 0.0.0.0:4317 \
    python agent_framework_app.py
```

See [OpenTelemetry Zero-code Python documentation](https://opentelemetry.io/docs/zero-code/python/) for details.

---

## Environment Variables

### Agent Framework Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_INSTRUMENTATION` | `false` | Set to `true` to enable OpenTelemetry instrumentation |
| `ENABLE_SENSITIVE_DATA` | `false` | Set to `true` to log prompts, responses, function args. Use only in dev/test |
| `ENABLE_CONSOLE_EXPORTERS` | `false` | Set to `true` to enable console output for telemetry |
| `VS_CODE_EXTENSION_PORT` | — | Port for AI Toolkit or Azure AI Foundry VS Code extension integration |

### Standard OpenTelemetry Variables

`configure_otel_providers()` reads these automatically:

**OTLP configuration** (Aspire Dashboard, Jaeger, etc.):

| Variable | Description |
|----------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Base endpoint for all signals (e.g., `http://localhost:4317`) |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Traces-specific endpoint (overrides base) |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | Metrics-specific endpoint (overrides base) |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | Logs-specific endpoint (overrides base) |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | Protocol: `grpc` or `http` (default: `grpc`) |
| `OTEL_EXPORTER_OTLP_HEADERS` | Headers for all signals (e.g., `key1=value1,key2=value2`) |

**Service identification:**

| Variable | Description |
|----------|-------------|
| `OTEL_SERVICE_NAME` | Service name (default: `agent_framework`) |
| `OTEL_SERVICE_VERSION` | Service version (default: package version) |
| `OTEL_RESOURCE_ATTRIBUTES` | Additional resource attributes |

See the [OpenTelemetry spec](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/) for more details.

---

## Dependencies

### Included Packages

These OpenTelemetry packages are installed by default with `agent-framework`:

- [opentelemetry-api](https://pypi.org/project/opentelemetry-api/)
- [opentelemetry-sdk](https://pypi.org/project/opentelemetry-sdk/)
- [opentelemetry-semantic-conventions-ai](https://pypi.org/project/opentelemetry-semantic-conventions-ai/)

### Exporters

Install as needed:

- **gRPC**: `pip install opentelemetry-exporter-otlp-proto-grpc`
- **HTTP**: `pip install opentelemetry-exporter-otlp-proto-http`
- **Azure Application Insights**: `pip install azure-monitor-opentelemetry`

Use the [OpenTelemetry Registry](https://opentelemetry.io/ecosystem/registry/?language=python&component=instrumentation) for other exporters.

---

## Azure Monitor Setup

### Microsoft Foundry (Azure AI Foundry)

For Azure AI Foundry projects with Azure Monitor configured, use `configure_azure_monitor()` on the client:

```python
from agent_framework.azure import AzureAIClient
from azure.ai.projects.aio import AIProjectClient
from azure.identity.aio import AzureCliCredential

async def main():
    async with (
        AzureCliCredential() as credential,
        AIProjectClient(endpoint="https://<your-project>.foundry.azure.com", credential=credential) as project_client,
        AzureAIClient(project_client=project_client) as client,
    ):
        await client.configure_azure_monitor(enable_live_metrics=True)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

The connection string is automatically retrieved from the project.

### Custom Agents (Non-Foundry)

For custom agents not created through Foundry, register them in the Foundry portal and use the same OpenTelemetry agent ID:

1. See [Register custom agent](https://learn.microsoft.com/azure/ai-foundry/control-plane/register-custom-agent) for setup.
2. Configure Azure Monitor manually:

```python
from azure.monitor.opentelemetry import configure_azure_monitor
from agent_framework.observability import create_resource, enable_instrumentation
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient

configure_azure_monitor(
    connection_string="InstrumentationKey=...",
    resource=create_resource(),
    enable_live_metrics=True,
)
enable_instrumentation()

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    name="My Agent",
    instructions="You are a helpful assistant.",
    id="<OpenTelemetry agent ID>"  # Must match ID registered in Foundry
)
```

---

## Aspire Dashboard

For local development without Azure, use the Aspire Dashboard to visualize traces and metrics.

### Run Aspire Dashboard with Docker

```bash
docker run --rm -it -d \
    -p 18888:18888 \
    -p 4317:18889 \
    --name aspire-dashboard \
    mcr.microsoft.com/dotnet/aspire-dashboard:latest
```

- **Web UI**: http://localhost:18888
- **OTLP endpoint**: http://localhost:4317

### Configure Application

```bash
ENABLE_INSTRUMENTATION=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

Or in a `.env` file. Then run your application; telemetry appears in the dashboard. See the [Aspire Dashboard exploration guide](https://learn.microsoft.com/dotnet/aspire/fundamentals/dashboard/explore) for details.

---

## Langfuse Integration

Langfuse provides tracing and evaluation for LLM applications. Integrate with Agent Framework as follows:

1. Install Langfuse and configure your Langfuse project.
2. Use Langfuse's OpenTelemetry integration or custom exporters if supported.
3. Call `enable_instrumentation()` to activate Agent Framework spans:

```python
from agent_framework.observability import enable_instrumentation
from langfuse import get_client

langfuse = get_client()
if langfuse.auth_check():
    enable_instrumentation(enable_sensitive_data=False)
```

See [Langfuse Microsoft Agent Framework integration](https://langfuse.com/integrations/frameworks/microsoft-agent-framework) for current setup instructions.

---

## GenAI Semantic Conventions

Agent Framework emits spans and attributes according to [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/).

### Spans

| Span Name | Description |
|-----------|-------------|
| `invoke_agent <agent_name>` | Top-level span for each agent invocation |
| `chat <model_name>` | Span when the agent calls the chat model |
| `execute_tool <function_name>` | Span when the agent calls a function tool |

### Attributes (Examples)

- `gen_ai.operation.name` – e.g., `invoke_agent`, `chat`
- `gen_ai.agent.name` – Agent name
- `gen_ai.agent.id` – Agent ID
- `gen_ai.system` – AI system (e.g., `openai`)
- `gen_ai.usage.input_tokens` – Input token count
- `gen_ai.usage.output_tokens` – Output token count
- `gen_ai.response.id` – Response ID from the model

When `enable_sensitive_data=True`, spans may include prompts, responses, function arguments, and results. Use only in development or testing.

### Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `gen_ai.client.operation.duration` | Histogram | Duration of each operation (seconds) |
| `gen_ai.client.token.usage` | Histogram | Token usage (count) |
| `agent_framework.function.invocation.duration` | Histogram | Function execution duration (seconds) |

---

## Custom Spans and Metrics

Use `get_tracer()` and `get_meter()` for custom instrumentation:

```python
from agent_framework.observability import get_tracer, get_meter

tracer = get_tracer()
meter = get_meter()

with tracer.start_as_current_span("my_custom_span"):
    # your code
    pass

counter = meter.create_counter("my_custom_counter")
counter.add(1, {"key": "value"})
```

These return tracers/meters from the global provider with `agent_framework` as the instrumentation library name by default.

---

## Example Trace Output

With console exporters enabled, trace output resembles:

```text
{
    "name": "invoke_agent Joker",
    "context": {
        "trace_id": "0xf2258b51421fe9cf4c0bd428c87b1ae4",
        "span_id": "0x2cad6fc139dcf01d"
    },
    "attributes": {
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.agent.name": "Joker",
        "gen_ai.usage.input_tokens": 26,
        "gen_ai.usage.output_tokens": 29
    }
}
```

---

## Minimal Complete Example

```python
import asyncio
from agent_framework.observability import configure_otel_providers
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient

configure_otel_providers(enable_console_exporters=True)

agent = ChatAgent(
    chat_client=OpenAIChatClient(),
    name="Joker",
    instructions="You are good at telling jokes."
)

async def main():
    result = await agent.run("Tell me a joke about a pirate.")
    print(result.text)

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Samples

See the [observability samples folder](https://github.com/microsoft/agent-framework/tree/main/python/samples/getting_started/observability) in the Microsoft Agent Framework repository for complete examples, including zero-code telemetry.
