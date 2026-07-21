---
name: azure-mgmt-apicenter-py
description: |
  Azure API Center Management SDK for Python. Use for managing API inventory, metadata, and governance across your organization.
  Triggers: "azure-mgmt-apicenter", "ApiCenterMgmtClient", "API Center", "API inventory", "API governance".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-mgmt-apicenter
---

# Azure API Center Management SDK for Python

Manage API inventory, metadata, and governance in Azure API Center.

## Installation

```bash
pip install azure-mgmt-apicenter
pip install azure-identity
```

## Environment Variables

```bash
AZURE_SUBSCRIPTION_ID=your-subscription-id  # Required for all auth methods
AZURE_TOKEN_CREDENTIALS=prod # Required only if DefaultAzureCredential is used in production
```

## Authentication & Lifecycle

> **🔑 Two rules apply to every code sample below:**
>
> 1. **Prefer `DefaultAzureCredential`.** It works locally (Azure CLI / VS Code / Developer CLI) and in Azure (managed identity, workload identity) with no code change. Avoid connection strings, account/API keys — they bypass Entra audit and rotation.
>    - Local dev: `DefaultAzureCredential` works as-is.
>    - Production: set `AZURE_TOKEN_CREDENTIALS=prod` (or `AZURE_TOKEN_CREDENTIALS=<specific_credential>`) to constrain the credential chain to production-safe credentials.
> 2. **Wrap every client in a context manager** so HTTP transports, sockets, and token caches are released deterministically:
>    - Sync: `with <Client>(...) as client:`
>    - Async: `async with <Client>(...) as client:` **and** `async with DefaultAzureCredential() as credential:` (from `azure.identity.aio`)
>
> Snippets may abbreviate this setup, but production code should always follow both rules.

```python
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
from azure.mgmt.apicenter import ApiCenterMgmtClient
import os

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

with ApiCenterMgmtClient(
    credential=credential,
    subscription_id=os.environ["AZURE_SUBSCRIPTION_ID"]
) as client:
    # Use `client` for all subsequent operations (see examples below)
    ...
```

## Create API Center

```python
from azure.mgmt.apicenter.models import Service

api_center = client.services.create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-api-center",
    resource=Service(
        location="eastus",
        tags={"environment": "production"}
    )
)

print(f"Created API Center: {api_center.name}")
```

## List API Centers

```python
api_centers = client.services.list_by_subscription()

for api_center in api_centers:
    print(f"{api_center.name} - {api_center.location}")
```

## Register an API

```python
from azure.mgmt.apicenter.models import Api, ApiKind, ApiProperties

api = client.apis.create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-api-center",
    workspace_name="default",
    api_name="my-api",
    resource=Api(
        properties=ApiProperties(
            title="My API",
            description="A sample API for demonstration",
            kind=ApiKind.REST,
            terms_of_service={"url": "https://example.com/terms"},
            contacts=[{"name": "API Team", "email": "api-team@example.com"}],
        )
    ),
)

print(f"Registered API: {api.properties.title}")
```

## Create API Version

```python
from azure.mgmt.apicenter.models import ApiVersion, ApiVersionProperties, LifecycleStage

version = client.api_versions.create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-api-center",
    workspace_name="default",
    api_name="my-api",
    version_name="v1",
    resource=ApiVersion(
        properties=ApiVersionProperties(
            title="Version 1.0",
            lifecycle_stage=LifecycleStage.PRODUCTION,
        )
    ),
)

print(f"Created version: {version.properties.title}")
```

## Add API Definition

```python
from azure.mgmt.apicenter.models import ApiDefinition, ApiDefinitionProperties

definition = client.api_definitions.create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-api-center",
    workspace_name="default",
    api_name="my-api",
    version_name="v1",
    definition_name="openapi",
    resource=ApiDefinition(
        properties=ApiDefinitionProperties(
            title="OpenAPI Definition",
            description="OpenAPI 3.0 specification",
        )
    ),
)
```

## Import API Specification

```python
from azure.mgmt.apicenter.models import ApiSpecImportRequest, ApiSpecImportSourceFormat

# Import from inline content
client.api_definitions.begin_import_specification(
    resource_group_name="my-resource-group",
    service_name="my-api-center",
    workspace_name="default",
    api_name="my-api",
    version_name="v1",
    definition_name="openapi",
    body=ApiSpecImportRequest(
        format=ApiSpecImportSourceFormat.INLINE,
        value='{"openapi": "3.0.0", "info": {"title": "My API", "version": "1.0"}, "paths": {}}',
    )
).result()
```

## List APIs

```python
apis = client.apis.list(
    resource_group_name="my-resource-group",
    service_name="my-api-center",
    workspace_name="default"
)

for api in apis:
    print(f"{api.name}: {api.title} ({api.kind})")
```

## Create Environment

```python
from azure.mgmt.apicenter.models import Environment, EnvironmentKind, EnvironmentProperties

environment = client.environments.create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-api-center",
    workspace_name="default",
    environment_name="production",
    resource=Environment(
        properties=EnvironmentProperties(
            title="Production",
            description="Production environment",
            kind=EnvironmentKind.PRODUCTION,
            server={"type": "Azure API Management", "management_portal_uri": ["https://portal.azure.com"]},
        )
    ),
)
```

## Create Deployment

```python
from azure.mgmt.apicenter.models import Deployment, DeploymentProperties, DeploymentState

deployment = client.deployments.create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-api-center",
    workspace_name="default",
    api_name="my-api",
    deployment_name="prod-deployment",
    resource=Deployment(
        properties=DeploymentProperties(
            title="Production Deployment",
            description="Deployed to production APIM",
            environment_id="/workspaces/default/environments/production",
            definition_id="/workspaces/default/apis/my-api/versions/v1/definitions/openapi",
            state=DeploymentState.ACTIVE,
            server={"runtime_uri": ["https://api.example.com"]},
        )
    ),
)
```

## Define Custom Metadata

```python
from azure.mgmt.apicenter.models import MetadataSchema, MetadataSchemaProperties

metadata = client.metadata_schemas.create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-api-center",
    metadata_schema_name="data-classification",
    resource=MetadataSchema(
        properties=MetadataSchemaProperties(
            schema='{"type": "string", "title": "Data Classification", "enum": ["public", "internal", "confidential"]}'
        )
    ),
)
```

## Client Types

| Client | Purpose |
|--------|---------|
| `ApiCenterMgmtClient` | Main client for all operations |

## Operations

| Operation Group | Purpose |
|----------------|---------|
| `services` | API Center service management |
| `workspaces` | Workspace management |
| `apis` | API registration and management |
| `api_versions` | API version management |
| `api_definitions` | API definition management |
| `deployments` | Deployment tracking |
| `environments` | Environment management |
| `metadata_schemas` | Custom metadata definitions |

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.xxx` sync clients with `azure.xxx.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use workspaces** to organize APIs by team or domain
4. **Define metadata schemas** for consistent governance
5. **Track deployments** to understand where APIs are running
6. **Import specifications** to enable API analysis and linting
7. **Use lifecycle stages** to track API maturity
8. **Add contacts** for API ownership and support

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
