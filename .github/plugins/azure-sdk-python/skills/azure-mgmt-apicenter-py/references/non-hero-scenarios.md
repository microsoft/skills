# azure-mgmt-apicenter-py non-hero scenarios

These scenarios are intentionally separate from hero flows in `SKILL.md`.
They cover secondary/advanced patterns typically used after the primary end-to-end path is working.

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
    print(f"{api.name}: {api.properties.title} ({api.properties.kind})")
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
