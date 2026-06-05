# Acceptance Criteria: credential-free-dev

**Packages**: `azure-identity` (Python), `Azure.Identity` (.NET), `@azure/identity` (TypeScript), `com.azure:azure-identity` (Java)
**Purpose**: Skill testing acceptance criteria for credential-free development patterns

---

## 1. Authentication Patterns

### 1.1 Production Credential Selection

#### ✅ CORRECT: ManagedIdentityCredential for production
```python
from azure.identity import ManagedIdentityCredential
from azure.storage.blob import BlobServiceClient

credential = ManagedIdentityCredential()
client = BlobServiceClient(
    account_url="https://mystorageaccount.blob.core.windows.net",
    credential=credential
)
```

#### ✅ CORRECT: DefaultAzureCredential for local development
```python
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

credential = DefaultAzureCredential(require_envvar=True)
client = BlobServiceClient(
    account_url="https://mystorageaccount.blob.core.windows.net",
    credential=credential
)
```

#### ❌ INCORRECT: DefaultAzureCredential in production
```python
# WRONG — DefaultAzureCredential's credential chain probing causes subtle failures,
# latency, and silent fallback to unintended credentials in production.
# Use ManagedIdentityCredential explicitly.
from azure.identity import DefaultAzureCredential
credential = DefaultAzureCredential()  # Don't use in production
```

#### ❌ INCORRECT: Hardcoded key in code
```python
from azure.storage.blob import BlobServiceClient
client = BlobServiceClient.from_connection_string(
    "DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=abc123..."
)
```

#### ❌ INCORRECT: Hardcoded client secret
```python
from azure.identity import ClientSecretCredential
credential = ClientSecretCredential(
    tenant_id="...",
    client_id="...",
    client_secret="hardcoded-secret-value"  # Never hardcode
)
```

### 1.2 Environment Variables for Credentials

#### ✅ CORRECT: Read from environment
```python
import os
from azure.identity import ClientSecretCredential

credential = ClientSecretCredential(
    tenant_id=os.environ["AZURE_TENANT_ID"],
    client_id=os.environ["AZURE_CLIENT_ID"],
    client_secret=os.environ["AZURE_CLIENT_SECRET"],
)
```

#### ❌ INCORRECT: Inline secrets
```python
credential = ClientSecretCredential(
    tenant_id="12345-abcde",
    client_id="67890-fghij",
    client_secret="super-secret-value",
)
```

---

## 2. Service Client Initialization

### 2.1 Storage Blob

#### ✅ CORRECT: Endpoint URL + ManagedIdentityCredential
```python
client = BlobServiceClient(
    account_url="https://myaccount.blob.core.windows.net",
    credential=ManagedIdentityCredential()
)
```

#### ❌ INCORRECT: Connection string with key
```python
client = BlobServiceClient.from_connection_string("...AccountKey=...")
```

### 2.2 Service Bus

#### ✅ CORRECT: Namespace + ManagedIdentityCredential
```python
client = ServiceBusClient(
    fully_qualified_namespace="my-namespace.servicebus.windows.net",
    credential=ManagedIdentityCredential()
)
```

#### ❌ INCORRECT: Connection string with SAS
```python
client = ServiceBusClient.from_connection_string("...SharedAccessKey=...")
```

### 2.3 Cosmos DB

#### ✅ CORRECT: URL + ManagedIdentityCredential
```python
client = CosmosClient(
    "https://myaccount.documents.azure.com:443/",
    credential=ManagedIdentityCredential()
)
```

#### ❌ INCORRECT: URL + primary key
```python
client = CosmosClient("https://myaccount.documents.azure.com:443/", "primary-key-here")
```

---

## 3. RBAC Role Guidance

### 3.1 Least Privilege

#### ✅ CORRECT: Narrow role scoped to resource
```
Assign "Storage Blob Data Reader" on the specific storage account
```

#### ❌ INCORRECT: Overly broad role
```
Assign "Contributor" on the resource group
```

#### ❌ INCORRECT: Key operator instead of data role
```
Assign "Storage Account Key Operator Service Role" — this grants key access, not data access
```

---

## 4. Managed Identity Selection

### 4.1 System vs User-Assigned

#### ✅ CORRECT: System-assigned for single-purpose
```
Single App Service accessing one storage account → system-assigned MI
```

#### ✅ CORRECT: User-assigned for shared permissions
```
Three Container Apps needing same Cosmos DB access → one user-assigned MI, one RBAC assignment
```

#### ❌ INCORRECT: System-assigned with duplicated RBAC
```
Three Container Apps each with system-assigned MI, each needing identical RBAC → 3x role assignments to maintain
```

---

## 5. Workload Identity Federation

### 5.1 GitHub Actions

#### ✅ CORRECT: OIDC login without secret
```yaml
- uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

#### ❌ INCORRECT: Client secret in GitHub Actions
```yaml
- uses: azure/login@v2
  with:
    creds: ${{ secrets.AZURE_CREDENTIALS }}  # Contains client_secret — use WIF instead
```
