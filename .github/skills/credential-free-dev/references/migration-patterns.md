# Migration Patterns: Keys to Credential-Free

Detailed before/after code for migrating Azure services from connection strings and keys to credential-free authentication.

## Azure SQL Database

```python
# BEFORE (connection string with password)
conn_str = "Server=myserver.database.windows.net;Database=mydb;User Id=myuser;Password=mypassword;"

# AFTER (managed identity — production)
from azure.identity import ManagedIdentityCredential
import pyodbc

credential = ManagedIdentityCredential()
token = credential.get_token("https://database.windows.net/.default")
conn = pyodbc.connect(
    "Driver={ODBC Driver 18 for SQL Server};"
    "Server=myserver.database.windows.net;"
    "Database=mydb;",
    attrs_before={1256: token.token.encode("UTF-16-LE")}
)
```

### Steps

1. Enable system-assigned MI on your App Service / Container App
2. Create a contained database user mapped to the MI:
   ```sql
   CREATE USER [my-app-name] FROM EXTERNAL PROVIDER;
   ```
3. Grant appropriate roles:
   ```sql
   ALTER ROLE db_datareader ADD MEMBER [my-app-name];
   ```
4. Remove the password from your connection string
5. Use `ManagedIdentityCredential` in code to acquire tokens

---

## Azure Storage (Blob)

```python
# BEFORE (account key)
from azure.storage.blob import BlobServiceClient
client = BlobServiceClient.from_connection_string(
    "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=..."
)

# AFTER (managed identity)
from azure.identity import ManagedIdentityCredential
from azure.storage.blob import BlobServiceClient
client = BlobServiceClient(
    account_url="https://mystorageaccount.blob.core.windows.net",
    credential=ManagedIdentityCredential()
)
```

### Steps

1. Enable MI on your compute resource
2. Assign `Storage Blob Data Reader` (or `Contributor`/`Owner`) role to the MI on the storage account
3. Replace connection string with account URL + `ManagedIdentityCredential`
4. Remove the storage account key from all config

---

## Azure Cosmos DB

```python
# BEFORE (primary key)
from azure.cosmos import CosmosClient
client = CosmosClient(
    "https://myaccount.documents.azure.com:443/",
    "primary-key-here"
)

# AFTER (managed identity via Entra RBAC)
from azure.identity import ManagedIdentityCredential
from azure.cosmos import CosmosClient
client = CosmosClient(
    "https://myaccount.documents.azure.com:443/",
    credential=ManagedIdentityCredential()
)
```

### Steps

1. Enable Entra auth on Cosmos DB account (may need to disable key-based auth)
2. Assign `Cosmos DB Built-in Data Reader` (or `Contributor`) role
3. Replace key with `ManagedIdentityCredential`

---

## Azure Service Bus

```python
# BEFORE (connection string with SAS key)
from azure.servicebus import ServiceBusClient
client = ServiceBusClient.from_connection_string(
    "Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=..."
)

# AFTER (managed identity)
from azure.identity import ManagedIdentityCredential
from azure.servicebus import ServiceBusClient
client = ServiceBusClient(
    fully_qualified_namespace="my-namespace.servicebus.windows.net",
    credential=ManagedIdentityCredential()
)
```

### Steps

1. Enable MI on your compute resource
2. Assign `Azure Service Bus Data Sender` and/or `Azure Service Bus Data Receiver` role
3. Replace connection string with namespace + `ManagedIdentityCredential`

---

## Azure Event Hubs

```python
# BEFORE (connection string with SAS key)
from azure.eventhub import EventHubProducerClient
client = EventHubProducerClient.from_connection_string(
    "Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...",
    eventhub_name="my-hub"
)

# AFTER (managed identity)
from azure.identity import ManagedIdentityCredential
from azure.eventhub import EventHubProducerClient
client = EventHubProducerClient(
    fully_qualified_namespace="my-namespace.servicebus.windows.net",
    eventhub_name="my-hub",
    credential=ManagedIdentityCredential()
)
```

### Steps

1. Enable MI on your compute resource
2. Assign `Azure Event Hubs Data Sender` and/or `Azure Event Hubs Data Receiver` role
3. Replace connection string with namespace + `ManagedIdentityCredential`

---

## Azure Key Vault

```python
# Key Vault already requires Entra auth — but ensure you're using MI, not client secret

# CORRECT (production)
from azure.identity import ManagedIdentityCredential
from azure.keyvault.secrets import SecretClient
client = SecretClient(
    vault_url="https://my-vault.vault.azure.net",
    credential=ManagedIdentityCredential()
)
```

### Steps

1. Enable MI on your compute resource
2. Assign `Key Vault Secrets User` (for reading secrets) or `Key Vault Secrets Officer` (for read/write)
3. Use vault URL + `ManagedIdentityCredential`

---

## Azure App Configuration

```python
# BEFORE (connection string)
from azure.appconfiguration import AzureAppConfigurationClient
client = AzureAppConfigurationClient.from_connection_string(
    "Endpoint=https://myconfig.azconfig.io;Id=...;Secret=..."
)

# AFTER (managed identity)
from azure.identity import ManagedIdentityCredential
from azure.appconfiguration import AzureAppConfigurationClient
client = AzureAppConfigurationClient(
    base_url="https://myconfig.azconfig.io",
    credential=ManagedIdentityCredential()
)
```

### Steps

1. Enable MI on your compute resource
2. Assign `App Configuration Data Reader` role
3. Replace connection string with endpoint URL + `ManagedIdentityCredential`

---

## .NET Examples

### Azure Storage (Blob)

```csharp
// BEFORE
var client = new BlobServiceClient("DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...");

// AFTER
var client = new BlobServiceClient(
    new Uri("https://mystorageaccount.blob.core.windows.net"),
    new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned));
```

### Azure Service Bus

```csharp
// BEFORE
var client = new ServiceBusClient("Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...");

// AFTER
var client = new ServiceBusClient(
    "my-namespace.servicebus.windows.net",
    new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned));
```

### Azure Cosmos DB

```csharp
// BEFORE
var client = new CosmosClient("https://myaccount.documents.azure.com:443/", "primary-key-here");

// AFTER
var client = new CosmosClient(
    "https://myaccount.documents.azure.com:443/",
    new ManagedIdentityCredential(ManagedIdentityId.SystemAssigned));
```

---

## TypeScript Examples

### Azure Storage (Blob)

```typescript
// BEFORE
const client = BlobServiceClient.fromConnectionString("DefaultEndpointsProtocol=https;...");

// AFTER
import { ManagedIdentityCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";
const client = new BlobServiceClient(
    "https://mystorageaccount.blob.core.windows.net",
    new ManagedIdentityCredential()
);
```

### Azure Service Bus

```typescript
// BEFORE
const client = new ServiceBusClient("Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...");

// AFTER
import { ManagedIdentityCredential } from "@azure/identity";
import { ServiceBusClient } from "@azure/service-bus";
const client = new ServiceBusClient(
    "my-namespace.servicebus.windows.net",
    new ManagedIdentityCredential()
);
```

---

## Java Examples

### Azure Storage (Blob)

```java
// BEFORE
BlobServiceClient client = new BlobServiceClientBuilder()
    .connectionString("DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...")
    .buildClient();

// AFTER
ManagedIdentityCredential credential = new ManagedIdentityCredentialBuilder().build();
BlobServiceClient client = new BlobServiceClientBuilder()
    .endpoint("https://mystorageaccount.blob.core.windows.net")
    .credential(credential)
    .buildClient();
```

### Azure Service Bus

```java
// BEFORE
ServiceBusClientBuilder builder = new ServiceBusClientBuilder()
    .connectionString("Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...");

// AFTER
ManagedIdentityCredential credential = new ManagedIdentityCredentialBuilder().build();
ServiceBusClientBuilder builder = new ServiceBusClientBuilder()
    .fullyQualifiedNamespace("my-namespace.servicebus.windows.net")
    .credential(credential);
```
