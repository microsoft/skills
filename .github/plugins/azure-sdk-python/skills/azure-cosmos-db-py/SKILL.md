---
name: azure-cosmos-db-py
description: Build Azure Cosmos DB NoSQL services with Python/FastAPI following production-grade patterns. Use when implementing database client setup with dual auth (DefaultAzureCredential + emulator), service layer classes with CRUD operations, partition key strategies, parameterized queries, or TDD patterns for Cosmos. Triggers on phrases like "Cosmos DB", "NoSQL database", "document store", "add persistence", "database service layer", or "Python Cosmos SDK".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: azure-cosmos
---

# Cosmos DB Service Implementation

Build production-grade Azure Cosmos DB NoSQL services following clean code, security best practices, and TDD principles.

## Installation

```bash
pip install azure-cosmos azure-identity
```

## Environment Variables

```bash
COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/  # Required for all auth methods
COSMOS_DATABASE_NAME=<database-name>  # Required for all auth methods
COSMOS_CONTAINER_ID=<container-id>  # Required for all auth methods
# For emulator only (not production)
COSMOS_KEY=<emulator-key>  # Only required for key-based auth or emulator
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

**DefaultAzureCredential (preferred)**:
```python
import os
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential

# Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()

with CosmosClient(
    url=os.environ["COSMOS_ENDPOINT"],
    credential=credential
) as client:
    # Use client here (see following sections for operations)
    ...
```

**Emulator (local development)**:
```python
from azure.cosmos import CosmosClient

with CosmosClient(
    url="https://localhost:8081",
    credential=os.environ["COSMOS_KEY"],
    connection_verify=False
) as client:
    # Use client here (see following sections for operations)
    ...
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FastAPI Router                          │
│  - Auth dependencies (get_current_user, get_current_user_required)
│  - HTTP error responses (HTTPException)                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                        Service Layer                            │
│  - Business logic and validation                                │
│  - Document ↔ Model conversion                                  │
│  - Graceful degradation when Cosmos unavailable                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                     Cosmos DB Client Module                     │
│  - Singleton container initialization                           │
│  - Dual auth: DefaultAzureCredential (Azure) / Key (emulator)   │
│  - Async wrapper via run_in_threadpool                          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Client Module Setup

Create a singleton Cosmos client with dual authentication:

```python
# db/cosmos.py
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential
from starlette.concurrency import run_in_threadpool

_cosmos_container = None

def _is_emulator_endpoint(endpoint: str) -> bool:
    return "localhost" in endpoint or "127.0.0.1" in endpoint

async def get_container():
    global _cosmos_container
    if _cosmos_container is None:
        # Singleton: client lives for the FastAPI app lifetime; close in a lifespan shutdown handler.
        if _is_emulator_endpoint(settings.cosmos_endpoint):
            client = CosmosClient(
                url=settings.cosmos_endpoint,
                credential=settings.cosmos_key,
                connection_verify=False
            )
        else:
            client = CosmosClient(
                url=settings.cosmos_endpoint,
                credential=DefaultAzureCredential()
            )
        db = client.get_database_client(settings.cosmos_database_name)
        _cosmos_container = db.get_container_client(settings.cosmos_container_id)
    return _cosmos_container
```

**Full implementation**: See [references/client-setup.md](references/client-setup.md)

### 2. Pydantic Model Hierarchy

Use five-tier model pattern for clean separation:

```python
class ProjectBase(BaseModel):           # Shared fields
    name: str = Field(..., min_length=1, max_length=200)

class ProjectCreate(ProjectBase):       # Creation request
    workspace_id: str = Field(..., alias="workspaceId")

class ProjectUpdate(BaseModel):         # Partial updates (all optional)
    name: Optional[str] = Field(None, min_length=1)

class Project(ProjectBase):             # API response
    id: str
    created_at: datetime = Field(..., alias="createdAt")

class ProjectInDB(Project):             # Internal with docType
    doc_type: str = "project"
```

### 3. Service Layer Pattern

```python
class ProjectService:
    def _use_cosmos(self) -> bool:
        return get_container() is not None
    
    async def get_by_id(self, project_id: str, workspace_id: str) -> Project | None:
        if not self._use_cosmos():
            return None
        doc = await get_document(project_id, partition_key=workspace_id)
        if doc is None:
            return None
        return self._doc_to_model(doc)
```

**Full patterns**: See [references/service-layer.md](references/service-layer.md)

## Core Principles

### Security Requirements

1. **RBAC Authentication**: Use `DefaultAzureCredential` in Azure — never store keys in code
2. **Emulator-Only Keys**: Hardcode the well-known emulator key only for local development
3. **Parameterized Queries**: Always use `@parameter` syntax — never string concatenation
4. **Partition Key Validation**: Validate partition key access matches user authorization

### Clean Code Conventions

1. **Single Responsibility**: Client module handles connection; services handle business logic
2. **Graceful Degradation**: Services return `None`/`[]` when Cosmos unavailable
3. **Consistent Naming**: `_doc_to_model()`, `_model_to_doc()`, `_use_cosmos()`
4. **Type Hints**: Full typing on all public methods
5. **CamelCase Aliases**: Use `Field(alias="camelCase")` for JSON serialization

### TDD Requirements

Write tests BEFORE implementation using these patterns:

```python
@pytest.fixture
def mock_cosmos_container(mocker):
    container = mocker.MagicMock()
    mocker.patch("app.db.cosmos.get_container", return_value=container)
    return container

@pytest.mark.asyncio
async def test_get_project_by_id_returns_project(mock_cosmos_container):
    # Arrange
    mock_cosmos_container.read_item.return_value = {"id": "123", "name": "Test"}
    
    # Act
    result = await project_service.get_by_id("123", "workspace-1")
    
    # Assert
    assert result.id == "123"
    assert result.name == "Test"
```

**Full testing guide**: See [references/testing.md](references/testing.md)

## Best Practices

1. **Pick sync OR async and stay consistent.** Do not mix `azure.xxx` sync clients with `azure.xxx.aio` async clients in the same call path. Choose one mode per module.
2. **Always use context managers for clients and async credentials.** Wrap the client in `async with CosmosClient(...) as client:` (or manage its lifetime via FastAPI lifespan and close it explicitly). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.

## Reference Files

| File | When to Read |
|------|--------------|
| [references/client-setup.md](references/client-setup.md) | Setting up Cosmos client with dual auth, SSL config, singleton pattern |
| [references/service-layer.md](references/service-layer.md) | Implementing full service class with CRUD, conversions, graceful degradation |
| [references/testing.md](references/testing.md) | Writing pytest tests, mocking Cosmos, integration test setup |
| [references/partitioning.md](references/partitioning.md) | Choosing partition keys, cross-partition queries, move operations |
| [references/error-handling.md](references/error-handling.md) | Handling CosmosResourceNotFoundError, logging, HTTP error mapping |

## Template Files

| File | Purpose |
|------|---------|
| [assets/cosmos_client_template.py](assets/cosmos_client_template.py) | Ready-to-use client module |
| [assets/service_template.py](assets/service_template.py) | Service class skeleton |
| [assets/conftest_template.py](assets/conftest_template.py) | pytest fixtures for Cosmos mocking |

## Quality Attributes (NFRs)

### Reliability
- Graceful degradation when Cosmos unavailable
- Retry logic with exponential backoff for transient failures
- Connection pooling via singleton pattern

### Security
- Zero secrets in code (RBAC via DefaultAzureCredential)
- Parameterized queries prevent injection
- Partition key isolation enforces data boundaries

### Maintainability
- Five-tier model pattern enables schema evolution
- Service layer decouples business logic from storage
- Consistent patterns across all entity services

### Testability
- Dependency injection via `get_container()`
- Easy mocking with module-level globals
- Clear separation enables unit testing without Cosmos

### Performance
- Partition key queries avoid cross-partition scans
- Async wrapping prevents blocking FastAPI event loop
- Minimal document conversion overhead
