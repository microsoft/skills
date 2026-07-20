# Azure SDK Patterns by Language

Reference for creating skills that teach agents to write code following official Azure SDK guidelines.

**Official Documentation:** <https://azure.github.io/azure-sdk/>

---

## Table of Contents

1. [Core Principles (All Languages)](#core-principles-all-languages)
2. [Skill Reference Directory Pattern](#skill-reference-directory-pattern)
3. [Standard Naming Conventions](#standard-naming-conventions)
4. [Python Patterns](#python-patterns)
5. [.NET (C#) Patterns](#net-c-patterns)
6. [Java Patterns](#java-patterns)
7. [TypeScript/JavaScript Patterns](#typescriptjavascript-patterns)
8. [Rust Patterns](#rust-patterns)
9. [Authentication (All Languages)](#authentication-all-languages)
10. [Quick Reference Tables](#quick-reference-tables)

---

## Core Principles (All Languages)

Azure SDKs follow five design principles. Skills should reinforce these:

| Principle | Meaning |
|-----------|---------|
| **Idiomatic** | Follow language conventions; feel natural to developers |
| **Consistent** | APIs feel like a single product from a single team |
| **Approachable** | Great docs, predictable defaults, progressive disclosure |
| **Diagnosable** | Clear logging, errors are actionable and human-readable |
| **Dependable** | No breaking changes without major version bump |

**Consistency Priority:** Language conventions > Service conventions > Cross-language conventions

---

## Skill Reference Directory Pattern

For Azure SDK skills, keep `SKILL.md` focused on hero flows and use `references/` for overflow details:

- `references/capabilities.md` is an index only: each hero scenario plus where it is covered (`SKILL.md` or a bundled reference), the non-hero scenario list, and links to deep-dive reference files.
- `references/non-hero-scenarios.md` contains concrete non-hero examples intentionally kept out of `SKILL.md`.
- Additional `references/*.md` files are optional for specialized topics (operation groups, evaluator/tool matrices, migration notes).

Use present-tense guidance in reference files; avoid historical migration notes in user-facing capability indexes.

For Python SDK skills that provide both sync and async clients, present both forms as first-class options with equal priority. Do not encode a blanket preference for either mode in capability prioritization. When the SDK is sync-only or async-only, document the available mode only.

---

## Standard Naming Conventions

### Namespace/Package Format

`<Azure>.<group>.<service>`

| Group | Area | Examples |
|-------|------|----------|
| `ai` | AI/ML services | `Azure.AI.OpenAI`, `azure-ai-agents` |
| `data` | Databases | `Azure.Data.Cosmos`, `azure-cosmos` |
| `storage` | Storage services | `Azure.Storage.Blobs`, `@azure/storage-blob` |
| `identity` | Auth/Identity | `Azure.Identity`, `azure-identity` |
| `messaging` | Messaging | `Azure.Messaging.ServiceBus` |
| `security` | Security/Crypto | `Azure.Security.KeyVault` |

### Standard Verb Prefixes (All Languages)

| Verb | Behavior | Returns |
|------|----------|---------|
| `create` | Create new; fail if exists | Created item |
| `upsert` | Create or update (database-like) | Item |
| `set` | Create or update (dictionary-like) | Item |
| `update` | Fail if doesn't exist | Updated item |
| `get` | Retrieve single; error if missing | Item |
| `list` | Return collection (empty if none) | Pageable |
| `delete` | Succeed even if doesn't exist | void/None |
| `exists` | Check existence | boolean |
| `begin` | Start long-running operation | Poller |

---

## Python Patterns

### Client Naming

```python
# Sync client
class ConfigurationClient:
    pass

# Async client - use Async prefix
class AsyncConfigurationClient:
    pass
```

### Sync vs Async: Don't Mix Within a Call Path

**Rule:** Within a single module, script, or code path, use **either** the sync client **or** the async client — never both.

- Sync clients live in `azure.<service>` (e.g., `azure.ai.projects.AIProjectClient`).
- Async clients live in `azure.<service>.aio` (e.g., `azure.ai.projects.aio.AIProjectClient`).
- Mixing sync calls inside an `async def` (or awaiting inside a sync function) blocks the event loop, breaks context managers, and produces subtle concurrency bugs.

```python
# Setup used by the snippets below
endpoint = "https://example.services.ai.azure.com/api/projects/example"

# ✅ Good — all sync
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

with AIProjectClient(endpoint=endpoint, credential=DefaultAzureCredential()) as client:
    agent = client.agents.get_agent("agent-id")

# ✅ Good — all async
from azure.ai.projects.aio import AIProjectClient as AsyncAIProjectClient
from azure.identity.aio import DefaultAzureCredential as AsyncDefaultAzureCredential

async def run_async():
    async with AsyncDefaultAzureCredential() as credential, \
               AsyncAIProjectClient(endpoint=endpoint, credential=credential) as client:
        agent = await client.agents.get_agent("agent-id")

# ❌ Bad — sync client (azure.ai.projects) called from an async function:
# the synchronous HTTP call blocks the event loop for the entire request.
async def run_bad():
    from azure.ai.projects import AIProjectClient  # sync client lives in azure.<service>
    with AIProjectClient(endpoint=endpoint, credential=DefaultAzureCredential()) as client:
        client.agents.get_agent("agent-id")  # ← blocking call inside `async def`

# ❌ Bad — async client (azure.<service>.aio) paired with sync DefaultAzureCredential:
# the async client expects an async credential from azure.identity.aio.
async def run_also_bad():
    from azure.identity import DefaultAzureCredential          # sync
    from azure.ai.projects.aio import AIProjectClient          # async
    async with AIProjectClient(endpoint=endpoint, credential=DefaultAzureCredential()) as client:
        await client.agents.get_agent("agent-id")  # credential.get_token() will block
```

When writing a skill, present both sync and async forms as first-class options with equal priority when the SDK provides both. Do not encode a preference for either mode. When the SDK is sync-only or async-only, document the available mode only.

### Pagination: ItemPaged / AsyncItemPaged

```python
from azure.core.paging import ItemPaged

# Sync iteration
for item in client.list_items():
    print(item.name)

# Page-by-page
for page in client.list_items().by_page():
    for item in page:
        print(item.name)

# With continuation token
for page in client.list_items().by_page(continuation_token="..."):
    print(page)

# Async iteration
async for item in async_client.list_items():
    print(item.name)
```

### Long-Running Operations: LROPoller / AsyncLROPoller

```python
from azure.core.polling import LROPoller

# Start LRO
poller: LROPoller[Result] = client.begin_create_resource(config)

# Check status
if poller.done():
    result = poller.result()

# Wait with timeout
result = poller.result(timeout=60)

# Async LRO
async_poller = await async_client.begin_create_resource(config)
result = await async_poller.result()
```

### Context Managers (Strongly Preferred)

**Always prefer context managers (`with` / `async with`) over manually constructing and closing clients.** They guarantee the underlying HTTP transport and credential sessions are closed, even on exceptions, and make the sync/async choice explicit at the call site.

```python
# ✅ Preferred — sync
with ConfigurationClient(endpoint, credential) as client:
    setting = client.get_setting("key")

# ✅ Preferred — async (also wrap the async credential)
from azure.identity.aio import DefaultAzureCredential

async with DefaultAzureCredential() as credential, \
           AsyncConfigurationClient(endpoint, credential) as client:
    setting = await client.get_setting("key")

# ⚠️ Only acceptable when the client lifetime spans the whole app
# (e.g., FastAPI lifespan, long-running service). Close it explicitly.
client = ConfigurationClient(endpoint, credential)
try:
    setting = client.get_setting("key")
finally:
    client.close()  # or `await client.close()` for async clients
```

Skills should show the context-manager form first. Only introduce the explicit `close()` pattern when the scenario genuinely requires a long-lived client (e.g., dependency-injected singletons), and always pair it with `try/finally` or a framework lifecycle hook.

### Error Handling

```python
from azure.core.exceptions import (
    ResourceNotFoundError,
    ResourceExistsError,
    HttpResponseError,
)

try:
    item = client.get_item("key")
except ResourceNotFoundError:
    print("Not found")
except HttpResponseError as e:
    print(f"HTTP {e.status_code}: {e.message}")
```

### Docstring Format (Sphinx-style)

```python
def get_setting(self, key: str, **kwargs) -> "ConfigurationSetting":
    """Retrieve a configuration setting.

    :param key: The key of the setting.
    :type key: str
    :keyword timeout: Operation timeout in seconds.
    :paramtype timeout: int
    :returns: The configuration setting.
    :rtype: ~azure.appconfig.ConfigurationSetting
    :raises ~azure.core.exceptions.ResourceNotFoundError: If setting not found.
    """
```

---

## .NET (C#) Patterns

### Client Naming

```csharp
namespace Azure.Data.Configuration
{
    // Service client with Client suffix
    public class ConfigurationClient { }
    
    // Options class
    public class ConfigurationClientOptions : ClientOptions { }
}
```

### Response Wrapper: Response<T>

```csharp
// Single item
public Response<ConfigurationSetting> GetSetting(string key);
public Task<Response<ConfigurationSetting>> GetSettingAsync(string key);

// No content
public Response DeleteSetting(string key);
public Task<Response> DeleteSettingAsync(string key);
```

### Pagination: Pageable<T> / AsyncPageable<T>

```csharp
// Sync
foreach (ConfigurationSetting setting in client.GetSettings())
{
    Console.WriteLine(setting.Key);
}

// Async
await foreach (ConfigurationSetting setting in client.GetSettingsAsync())
{
    Console.WriteLine(setting.Key);
}
```

### Long-Running Operations: Operation<T>

```csharp
// With WaitUntil parameter
Operation<AnalyzeResult> operation = await client.StartAnalyzeAsync(
    WaitUntil.Completed,  // or WaitUntil.Started
    document);

AnalyzeResult result = operation.Value;

// Manual polling
Operation<AnalyzeResult> operation = await client.StartAnalyzeAsync(
    WaitUntil.Started, document);

while (!operation.HasCompleted)
{
    await operation.UpdateStatusAsync();
    await Task.Delay(1000);
}
```

### Mocking Support

```csharp
public class ConfigurationClient
{
    // Protected parameterless constructor for mocking
    protected ConfigurationClient() { }
    
    // Virtual methods for mocking
    public virtual Response<ConfigurationSetting> GetSetting(string key);
}
```

### Error Handling

```csharp
try
{
    var setting = await client.GetSettingAsync("key");
}
catch (RequestFailedException ex) when (ex.Status == 404)
{
    Console.WriteLine("Not found");
}
catch (RequestFailedException ex)
{
    Console.WriteLine($"Error: {ex.Status} - {ex.ErrorCode}");
}
```

---

## Java Patterns

### Client Naming

```java
// Sync client
public final class ConfigurationClient { }

// Async client
public final class ConfigurationAsyncClient { }

// Builder (the ONLY way to create clients)
public final class ConfigurationClientBuilder {
    public ConfigurationClient buildClient() { }
    public ConfigurationAsyncClient buildAsyncClient() { }
}
```

### Builder Pattern

```java
ConfigurationClient client = new ConfigurationClientBuilder()
    .endpoint(endpoint)
    .credential(new DefaultAzureCredentialBuilder().build())
    .serviceVersion(ConfigurationServiceVersion.V2023_10_01)
    .buildClient();
```

### Pagination: PagedIterable<T> / PagedFlux<T>

```java
// Sync - standard for loop
for (ConfigurationSetting setting : client.listSettings()) {
    System.out.println(setting.getKey());
}

// Sync - Stream API
client.listSettings().stream()
    .filter(s -> s.getKey().startsWith("app"))
    .forEach(System.out::println);

// Async - Reactor
client.listSettings()
    .subscribe(setting -> System.out.println(setting.getKey()));
```

### Long-Running Operations: SyncPoller<T,U> / PollerFlux<T,U>

```java
// Sync
SyncPoller<OperationResult, AnalyzeResult> poller = 
    client.beginAnalyze(document);
poller.waitForCompletion();
AnalyzeResult result = poller.getFinalResult();

// Async
client.beginAnalyze(document)
    .last()
    .flatMap(AsyncPollResponse::getFinalResult)
    .subscribe(result -> System.out.println(result));
```

### Reactor Types

| Type | Purpose |
|------|---------|
| `Mono<T>` | 0 or 1 item |
| `Flux<T>` | 0 to N items |
| `PagedFlux<T>` | Paginated collections |
| `PollerFlux<T,U>` | Long-running operations |

### Annotations

```java
@ServiceClient(builder = ConfigurationClientBuilder.class)
public final class ConfigurationClient {
    
    @ServiceMethod(returns = ReturnType.SINGLE)
    public ConfigurationSetting getSetting(String key) { }
    
    @ServiceMethod(returns = ReturnType.COLLECTION)
    public PagedIterable<ConfigurationSetting> listSettings() { }
}
```

---

## TypeScript/JavaScript Patterns

### Package Naming

```typescript
// Package: @azure/service-name (kebab-case)
// Client: ServiceClient (PascalCase with Client suffix)

import { ServiceClient } from "@azure/service-name";
```

### Pagination: PagedAsyncIterableIterator

```typescript
// Iterate items
for await (const item of client.listItems()) {
    console.log(item.name);
}

// Iterate by page
for await (const page of client.listItems().byPage()) {
    console.log(`Page has ${page.length} items`);
}

// With continuation token
const iterator = client.listItems().byPage({ continuationToken });
```

### Long-Running Operations

```typescript
// Methods starting LRO use 'begin' prefix
const poller = await client.beginAnalyzeDocument(modelId, document, {
    pollInterval: 2000
});

// Wait for completion
const result = await poller.pollUntilDone();

// Serialize state for later
const state = poller.toString();
const restored = await client.beginAnalyzeDocument(modelId, document, {
    resumeFrom: state
});
```

### Cancellation: AbortSignal

```typescript
import { AbortController } from "@azure/abort-controller";

const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

try {
    const item = await client.createItem({
        abortSignal: controller.signal
    });
} catch (e) {
    if (e.name === "AbortError") {
        console.log("Cancelled");
    }
}
```

### Options Pattern

```typescript
interface CreateItemOptions {
    abortSignal?: AbortSignalLike;
    timeoutInMs?: number;        // Duration suffix: InMs, InSeconds
    onlyIfChanged?: boolean;     // Conditional request
}
```

### Error Handling

```typescript
import { RestError } from "@azure/core-rest-pipeline";

try {
    await client.createItem(item);
} catch (e) {
    // Check name, not instanceof
    if (e.name === "RestError") {
        console.error(`HTTP ${e.statusCode}: ${e.message}`);
    }
}
```

---

## Rust Patterns

> **IMPORTANT:** Only use the official `azure_*` crates published by the [azure-sdk](https://crates.io/users/azure-sdk) crates.io user (e.g., `azure_core`, `azure_identity`, `azure_security_keyvault_secrets`). Do **NOT** use the deprecated unofficial crates (`azure_sdk_*` from MindFlavor/AzureSDKForRust) or the community crates (e.g., `azure_storage`, or `azure_storage_blobs` from the `azure_sdk_for_rust` ecosystem). The official crates use underscores in their names and are installed via `cargo add`. None of the official crates have a version number of 0.21.0. **Only create or modify crates using `cargo` commands; avoid modifying `Cargo.toml` files directly if at all possible.**
>
> **Source:** All examples below are derived from the official [azure-sdk-for-rust](https://github.com/Azure/azure-sdk-for-rust) repository README files and examples.
>
> **Dependency rule:** If your Rust code imports `azure_core` types directly (for example, `azure_core::http::Url`, `azure_core::http::RequestContent`, or `azure_core::error::ErrorKind`), add `azure_core` to `Cargo.toml`. If you only use types re-exported by service crates, a direct `azure_core` dependency is optional.

### Installation (Rust)

For Rust SDK skills, include the Installation section as:

```markdown
## Installation

\`\`\`sh
cargo add <crate1> <crate2> <crate3> ...
\`\`\`

> If your code uses \`azure_core\` types directly (for example, \`azure_core::http::Url\` or \`azure_core::http::RequestContent\`), add \`azure_core\` to \`Cargo.toml\`. If you only use types re-exported by service crates, direct \`azure_core\` dependency is optional.
```

**Key points:**

- Always use `cargo add`, never show `Cargo.toml` manual edits
- List all direct dependencies needed for the examples in the skill
- Include the optional note about `azure_core` (copy verbatim) so users understand when to add it explicitly
- If examples use `RequestContent::from()`, include `azure_core` in the install list since that's a direct `azure_core` type usage

### Regenerating Rust SDK Skills from Latest Sources

When a Rust skill appears stale (wrong signatures, outdated examples, deprecated guidance),
regenerate it from current upstream sources before editing anything else.

1. Collect authoritative sources:
    - crate README: `sdk/<service>/<crate>/README.md`
    - executable examples: `sdk/<service>/<crate>/examples/*.rs`
    - if needed, public API surface in `src/clients` / `src/generated`

2. Rebuild skill snippets from those sources:
    - prefer README + examples over ad-hoc internet snippets
    - align constructor signatures, async patterns, pager/poller usage, and error handling
    - keep crate guidance strict: official `azure_*` crates published by `azure-sdk`

3. Re-validate quality gates:
    - run harness scenarios for the affected skill
    - run Vally eval if the skill has one (for example, `tests/scenarios/azure-storage-blob-rust/vally/eval.yaml`)

4. Update reference links in the skill to the exact crate docs and source directory used.

### Crate Naming

```rust
// Crate: azure_<group>_<service> (underscores, all lowercase)
// Client: ServiceClient (PascalCase with Client suffix)

use azure_security_keyvault_secrets::SecretClient;
use azure_security_keyvault_keys::KeyClient;
use azure_security_keyvault_certificates::CertificateClient;
use azure_storage_blob::BlobClient;
use azure_data_cosmos::CosmosClient;
use azure_messaging_eventhubs::ProducerClient;
```

### Client Construction

Client construction varies by service. Some use `Client::new()`, others use builders.

#### Key Vault: `Client::new()` function

```rust
use azure_identity::DeveloperToolsCredential;
use azure_security_keyvault_secrets::SecretClient;

let credential = DeveloperToolsCredential::new(None)?;
let client = SecretClient::new(
    "https://<your-key-vault-name>.vault.azure.net/",
    credential.clone(),
    None, // Optional SecretClientOptions
)?;

// Get a secret
let secret = client.get_secret("secret-name", None).await?.into_model()?;
println!("Secret: {:?}", secret.value);
```


```rust
use azure_core::http::Url;
use azure_identity::DeveloperToolsCredential;
use azure_storage_blob::BlobServiceClient;

let credential = DeveloperToolsCredential::new(None)?;
let service_client = BlobServiceClient::new(service_url, Some(credential), None)?;
let blob_client = service_client.blob_client("<container_name>", "<blob_name>");
```


```rust
use azure_identity::DeveloperToolsCredential;
use azure_data_cosmos::{CosmosClient, AccountReference, AccountEndpoint};

let credential = DeveloperToolsCredential::new(None)?;
let endpoint: AccountEndpoint = "https://myaccount.documents.azure.com/".parse()?;
let account = AccountReference::with_credential(endpoint, credential);
let cosmos_client = CosmosClient::builder().build(account).await?;
```

#### Event Hubs: Builder with `open()`

```rust
use azure_identity::DeveloperToolsCredential;
use azure_messaging_eventhubs::ProducerClient;

let credential = DeveloperToolsCredential::new(None)?;
let producer = ProducerClient::builder()
    .open("<EVENTHUBS_HOST>", "<EVENTHUB_NAME>", credential.clone())
    .await?;
```

### Response Wrapper: `Response<T>`

```rust
// Call a service method returning Response<T>
let response = client.get_secret("secret-name", None).await?;

// Deserialize into a model
let secret = response.into_model()?;

// Or deconstruct for HTTP details
let (status, headers, body) = response.deconstruct();
```

### Pagination: `Pager<T>`

```rust
use futures::TryStreamExt;

// Iterate all items across all pages
let mut pager = client.list_secret_properties(None)?;
while let Some(secret) = pager.try_next().await? {
    let name = secret.resource_id()?.name;
    println!("Found Secret: {}", name);
}

```

The `ResourceExt` trait provides `resource_id()` for parsing names and versions from resource IDs:

```rust
use azure_security_keyvault_secrets::ResourceExt;

let secret = client.get_secret("my-secret", None).await?.into_model()?;
let id = secret.resource_id()?;
println!("Name: {}, Version: {:?}", id.name, id.version);
```

### Long-Running Operations: `Poller<T>`

LRO methods use the `begin_` prefix. The `Poller` implements `IntoFuture` — just await it:

```rust
use azure_security_keyvault_certificates::models::{
    CertificatePolicy, CreateCertificateParameters, IssuerParameters, X509CertificateProperties,
};

let policy = CertificatePolicy {
    x509_certificate_properties: Some(X509CertificateProperties {
        subject: Some("CN=DefaultPolicy".into()),
        ..Default::default()
    }),
    issuer_parameters: Some(IssuerParameters {
        name: Some("Self".into()),
        ..Default::default()
    }),
    ..Default::default()
};
let body = CreateCertificateParameters {
    certificate_policy: Some(policy),
    ..Default::default()
};

// Wait for completion — Poller implements IntoFuture and automatically waits between polls
let certificate = client
    .begin_create_certificate("cert-name", body.try_into()?, None)?
    .await?
    .into_model()?;
```

### Error Handling

Key Vault services return structured errors via `err.into_inner()?`:

```rust
match client.get_secret("secret-name", None).await {
    Ok(response) => println!("Secret Value: {:?}", response.into_model()?.value),
    Err(err) => println!("Error: {:#?}", err.into_inner()?),
}
// Error output includes structured ErrorResponse with code and message:
// ErrorResponse {
//     error: ErrorDetails {
//         code: Some("SecretNotFound"),
//         message: Some("A secret with (name/id) secret-name was not found..."),
//     },
//     ..
// }
```

Storage client error handling uses `StorageError`:

```rust
use azure_core::error::ErrorKind;
use azure_storage_blob::StorageError;
use azure_storage_blob::models::StorageErrorCode;

match blob_client.download(None).await {
    Ok(response) => { /* process response */ }
    Err(error) => {
        if matches!(error.kind(), ErrorKind::HttpResponse { .. }) {
            let storage_error: StorageError = error.try_into()?;
            println!("Status: {}", storage_error.status_code);
            if let Some(error_code) = &storage_error.error_code {
                match error_code {
                    StorageErrorCode::BlobNotFound => println!("Blob does not exist."),
                    StorageErrorCode::ContainerNotFound => println!("Container does not exist."),
                    StorageErrorCode::AuthorizationFailure => println!("Auth failed."),
                    _ => println!("Other error: {error_code}"),
                }
            }
        }
    }
}
```

Note that `StorageError::try_into` requires an owned error object, it will not compile if handed a reference to an error.

### Model Types

```rust
// Request/response models: Clone + Default + Serialize/Deserialize
// All non-vector fields are Option<T>
// Response-only models are #[non_exhaustive]
// Use ..Default::default() for struct update syntax
let parameters = UpdateSecretPropertiesParameters {
    content_type: Some("text/plain".into()),
    tags: Some(HashMap::from_iter(vec![("key".into(), "value".into())])),
    ..Default::default()
};

// Cosmos DB uses serde for document types
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
struct Item {
    pub id: String,
    pub partition_key: String,
    pub value: String,
}
```

### Async Only

The Rust SDK provides **only async** methods. No sync wrappers:

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let credential = DeveloperToolsCredential::new(None)?;
    let client = SecretClient::new(endpoint, credential.clone(), None)?;
    let secret = client.get_secret("name", None).await?.into_model()?;
    Ok(())
}
```

### Key Differences from Other Azure SDKs

| Aspect | Rust | Other Languages |
|--------|------|----------------|
| Auth default | `DeveloperToolsCredential` | `DefaultAzureCredential` |
| Client creation | `Client::new()` or builder pattern (varies by service) | Constructors or builders |
| Sync support | Async only (tokio) | Sync + Async |
| Options | `Option<ClientOptions>` param | Separate options class |
| Response access | `response.into_model()?` | Direct return or `.Value` |
| LRO prefix | `begin_` prefix (e.g., `begin_create_certificate`) | `begin_` or `Begin` |
| Debug safety | `SafeDebug` derive (redacts PII) | Standard debug |
| Pagination stream | `futures::TryStreamExt` | Language iterators |
| Serialization | `serde` for Cosmos DB documents | Built-in serializers |
| Thread safety | All clients are `Send + Sync`; reuse is safe | Same guarantee |

---

## Authentication (All Languages)

**Always use `DefaultAzureCredential` as the primary pattern:**

### Python

```python
from azure.identity import DefaultAzureCredential
credential = DefaultAzureCredential()
client = ServiceClient(endpoint, credential)
```

### .NET

```csharp
var credential = new DefaultAzureCredential();
var client = new ServiceClient(new Uri(endpoint), credential);
```

### Java

```java
TokenCredential credential = new DefaultAzureCredentialBuilder().build();
ServiceClient client = new ServiceClientBuilder()
    .endpoint(endpoint)
    .credential(credential)
    .buildClient();
```

### TypeScript

```typescript
import { DefaultAzureCredential } from "@azure/identity";
const credential = new DefaultAzureCredential();
const client = new ServiceClient(endpoint, credential);
```

### Rust

```rust
use azure_identity::DeveloperToolsCredential;

// Key Vault, Storage: Client::new()
let credential = DeveloperToolsCredential::new(None)?;
let client = SecretClient::new(endpoint, credential.clone(), None)?;

// Cosmos DB: Builder pattern
let account = AccountReference::with_credential(endpoint.parse()?, credential);
let cosmos_client = CosmosClient::builder().build(account).await?;

// Event Hubs: Builder with open()
let producer = ProducerClient::builder()
    .open(host, eventhub, credential.clone())
    .await?;
```

> **Note:** Rust does not have `DefaultAzureCredential`. Use `DeveloperToolsCredential` for development (tries Azure CLI, then Azure Developer CLI). Use `ManagedIdentityCredential` for production on Azure-hosted apps. See [Credential structures](https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/identity/azure_identity#credential-structures) for the full list.

**Rules:**

- Never hardcode credentials
- Never persist/cache tokens manually (credential handles refresh)
- Use environment variables for configuration

---

## Quick Reference Tables

### Client Types by Language

| Pattern | Python | .NET | Java | TypeScript | Rust |
|---------|--------|------|------|------------|------|
| Sync Client | `Client` | `Client` | `Client` | `Client` | N/A (Async only) |
| Async Client | `AsyncClient` | N/A (Async methods) | `AsyncClient` | N/A (Promise) | `Client` |
| Builder | N/A | N/A | `ClientBuilder` | N/A | `new()` or builder (varies by service) |

### Pagination Types

| Language | Sync | Async |
|----------|------|-------|
| Python | `ItemPaged[T]` | `AsyncItemPaged[T]` |
| .NET | `Pageable<T>` | `AsyncPageable<T>` |
| Java | `PagedIterable<T>` | `PagedFlux<T>` |
| TypeScript | N/A | `PagedAsyncIterableIterator<T>` |
| Rust | N/A | `Pager<T>` (via `futures::TryStreamExt`) |

### LRO Types

| Language | Sync | Async |
|----------|------|-------|
| Python | `LROPoller[T]` | `AsyncLROPoller[T]` |
| .NET | `Operation<T>` | `Operation<T>` |
| Java | `SyncPoller<T,U>` | `PollerFlux<T,U>` |
| TypeScript | N/A | `PollerLike<T>` |
| Rust | N/A | `Poller<T>` (implements `IntoFuture` + `Stream`) |

### Response Wrappers

| Language | Single Item | Collection |
|----------|-------------|------------|
| Python | Direct return | `ItemPaged[T]` |
| .NET | `Response<T>` | `Pageable<T>` |
| Java | Direct return | `PagedIterable<T>` |
| TypeScript | `Promise<T>` | `PagedAsyncIterableIterator<T>` |
| Rust | `Response<T>` | `Pager<T>` |

---

## Official Documentation Links

- **General Guidelines:** <https://azure.github.io/azure-sdk/general_introduction.html>
- **Python:** <https://azure.github.io/azure-sdk/python_design.html>
- **.NET:** <https://azure.github.io/azure-sdk/dotnet_introduction.html>
- **Java:** <https://azure.github.io/azure-sdk/java_introduction.html>
- **TypeScript:** <https://azure.github.io/azure-sdk/typescript_introduction.html>
- **Rust:** <https://azure.github.io/azure-sdk/rust_introduction.html>

When creating Azure SDK skills, reference these docs via the `microsoft-docs` MCP for current API signatures.
