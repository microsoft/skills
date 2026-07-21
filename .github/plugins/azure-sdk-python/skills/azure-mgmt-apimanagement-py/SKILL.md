---
name: azure-mgmt-apimanagement-py
description: |
  Azure API Management SDK for Python. Use for managing APIM services, APIs, products, subscriptions, and policies.
  Triggers: "azure-mgmt-apimanagement", "ApiManagementClient", "APIM", "API gateway", "API Management".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-mgmt-apimanagement
---

# Azure API Management SDK for Python

Manage Azure API Management services, APIs, products, and policies.

## Installation

```bash
pip install azure-mgmt-apimanagement
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
from azure.mgmt.apimanagement import ApiManagementClient
import os

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

with ApiManagementClient(
    credential=credential,
    subscription_id=os.environ["AZURE_SUBSCRIPTION_ID"]
) as client:
    # Use `client` for all subsequent operations (see examples below)
    ...
```

## Create APIM Service

```python
from azure.mgmt.apimanagement.models import (
    ApiManagementServiceResource,
    ApiManagementServiceSkuProperties,
    SkuType
)

service = client.api_management_service.begin_create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-apim",
    parameters=ApiManagementServiceResource(
        location="eastus",
        publisher_email="admin@example.com",
        publisher_name="My Organization",
        sku=ApiManagementServiceSkuProperties(
            name=SkuType.DEVELOPER,
            capacity=1
        )
    )
).result()

print(f"Created APIM: {service.name}")
```

## Import API from OpenAPI

```python
from azure.mgmt.apimanagement.models import (
    ApiCreateOrUpdateParameter,
    ContentFormat,
    Protocol
)

api = client.api.begin_create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-apim",
    api_id="my-api",
    parameters=ApiCreateOrUpdateParameter(
        display_name="My API",
        path="myapi",
        protocols=[Protocol.HTTPS],
        format=ContentFormat.OPENAPI_JSON,
        value='{"openapi": "3.0.0", "info": {"title": "My API", "version": "1.0"}, "paths": {"/health": {"get": {"responses": {"200": {"description": "OK"}}}}}}'
    )
).result()

print(f"Imported API: {api.display_name}")
```

## Import API from URL

```python
api = client.api.begin_create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-apim",
    api_id="petstore",
    parameters=ApiCreateOrUpdateParameter(
        display_name="Petstore API",
        path="petstore",
        protocols=[Protocol.HTTPS],
        format=ContentFormat.OPENAPI_LINK,
        value="https://petstore.swagger.io/v2/swagger.json"
    )
).result()
```

## List APIs

```python
apis = client.api.list_by_service(
    resource_group_name="my-resource-group",
    service_name="my-apim"
)

for api in apis:
    print(f"{api.name}: {api.display_name} - {api.path}")
```

## Create Product

```python
from azure.mgmt.apimanagement.models import ProductContract

product = client.product.create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-apim",
    product_id="premium",
    parameters=ProductContract(
        display_name="Premium",
        description="Premium tier with unlimited access",
        subscription_required=True,
        approval_required=False,
        state="published"
    )
)

print(f"Created product: {product.display_name}")
```

## Add API to Product

```python
client.product_api.create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-apim",
    product_id="premium",
    api_id="my-api"
)
```

## Create Subscription

```python
from azure.mgmt.apimanagement.models import SubscriptionCreateParameters

subscription = client.subscription.create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-apim",
    sid="my-subscription",
    parameters=SubscriptionCreateParameters(
        display_name="My Subscription",
        scope=f"/products/premium",
        state="active"
    )
)

print(f"Subscription key: {subscription.primary_key}")
```

## Set API Policy

```python
from azure.mgmt.apimanagement.models import PolicyContract

policy_xml = """
<policies>
    <inbound>
        <rate-limit calls="100" renewal-period="60" />
        <set-header name="X-Custom-Header" exists-action="override">
            <value>CustomValue</value>
        </set-header>
    </inbound>
    <backend>
        <forward-request />
    </backend>
    <outbound />
    <on-error />
</policies>
"""

client.api_policy.create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-apim",
    api_id="my-api",
    policy_id="policy",
    parameters=PolicyContract(
        value=policy_xml,
        format="xml"
    )
)
```

## Create Named Value (Secret)

```python
from azure.mgmt.apimanagement.models import NamedValueCreateContract

named_value = client.named_value.begin_create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-apim",
    named_value_id="backend-api-key",
    parameters=NamedValueCreateContract(
        display_name="Backend API Key",
        value="secret-key-value",
        secret=True
    )
).result()
```

## Create Backend

```python
from azure.mgmt.apimanagement.models import BackendContract

backend = client.backend.create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-apim",
    backend_id="my-backend",
    parameters=BackendContract(
        url="https://api.backend.example.com",
        protocol="http",
        description="My backend service"
    )
)
```

## Create User

```python
from azure.mgmt.apimanagement.models import UserCreateParameters

user = client.user.create_or_update(
    resource_group_name="my-resource-group",
    service_name="my-apim",
    user_id="newuser",
    parameters=UserCreateParameters(
        email="user@example.com",
        first_name="John",
        last_name="Doe"
    )
)
```

## Operation Groups

| Group | Purpose |
|-------|---------|
| `api_management_service` | APIM instance management |
| `api` | API operations |
| `api_operation` | API operation details |
| `api_policy` | API-level policies |
| `product` | Product management |
| `product_api` | Product-API associations |
| `subscription` | Subscription management |
| `user` | User management |
| `named_value` | Named values/secrets |
| `backend` | Backend services |
| `certificate` | Certificates |
| `gateway` | Self-hosted gateways |

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.xxx` sync clients with `azure.xxx.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use named values** for secrets and configuration
4. **Apply policies** at appropriate scopes (global, product, API, operation)
5. **Use products** to bundle APIs and manage access
6. **Enable Application Insights** for monitoring
7. **Use backends** to abstract backend services
8. **Version your APIs** using APIM's versioning features

## Reference Files

| File | Contents |
|------|----------|
| [references/capabilities.md](references/capabilities.md) | Additional non-hero capabilities, operation-group coverage, and production checklists. |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Dedicated non-hero examples for secondary/advanced scenarios. |
