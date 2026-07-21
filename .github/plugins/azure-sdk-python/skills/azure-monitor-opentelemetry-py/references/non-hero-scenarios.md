# azure-monitor-opentelemetry-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

## Custom Traces

```python
from opentelemetry import trace
from azure.monitor.opentelemetry import configure_azure_monitor

configure_azure_monitor()

tracer = trace.get_tracer(__name__)

with tracer.start_as_current_span("my-operation") as span:
    span.set_attribute("custom.attribute", "value")
    # Do work...
```

## Custom Metrics

```python
from opentelemetry import metrics
from azure.monitor.opentelemetry import configure_azure_monitor

configure_azure_monitor()

meter = metrics.get_meter(__name__)
counter = meter.create_counter("my_counter")

counter.add(1, {"dimension": "value"})
```

## Custom Logs

```python
import logging
from azure.monitor.opentelemetry import configure_azure_monitor

configure_azure_monitor()

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

logger.info("This will appear in Application Insights")
logger.error("Errors are captured too", exc_info=True)
```

## Sampling

```python
from azure.monitor.opentelemetry import configure_azure_monitor

# Sample 10% of requests
configure_azure_monitor(
    sampling_ratio=0.1
)
```

## Cloud Role Name

Set cloud role name for Application Map:

```python
from azure.monitor.opentelemetry import configure_azure_monitor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME

configure_azure_monitor(
    resource=Resource.create({SERVICE_NAME: "my-service-name"})
)
```

## Disable Specific Instrumentations

Use `instrumentation_options` to selectively enable or disable individual libraries. Libraries not
listed remain enabled by default:

```python
from azure.monitor.opentelemetry import configure_azure_monitor

# Disable Django and psycopg2; leave flask, requests, urllib, urllib3 etc. enabled
configure_azure_monitor(
    instrumentation_options={
        "django": {"enabled": False},
        "psycopg2": {"enabled": False},
    }
)
```

## Enable Live Metrics

```python
from azure.monitor.opentelemetry import configure_azure_monitor

configure_azure_monitor(
    enable_live_metrics=True
)
```

## Azure AD Authentication

```python
from azure.monitor.opentelemetry import configure_azure_monitor
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential

# Local dev: DefaultAzureCredential. In production, set AZURE_TOKEN_CREDENTIALS=prod or use a specific credential.
credential = DefaultAzureCredential()
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

configure_azure_monitor(
    credential=credential
)
```

## Auto-Instrumentations Included

| Library | Telemetry Type |
|---------|---------------|
| Flask | Traces |
| Django | Traces |
| FastAPI | Traces |
| Requests | Traces |
| urllib | Traces |
| urllib3 | Traces |
| psycopg2 | Traces |
| Azure SDK | Traces |

## Configuration Options

| Parameter | Description | Default |
|-----------|-------------|---------|
| `connection_string` | Application Insights connection string | From env var |
| `credential` | Azure credential for AAD auth | None |
| `sampling_ratio` | Sampling rate (0.0 to 1.0) | 1.0 |
| `resource` | OpenTelemetry Resource | Auto-detected |
| `instrumentation_options` | Dict controlling per-library `enabled` flags | All enabled |
| `enable_live_metrics` | Enable Live Metrics stream | False |
