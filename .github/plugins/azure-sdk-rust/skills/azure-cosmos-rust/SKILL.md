---
name: azure-cosmos-rust
description: |
  Azure Cosmos DB library for Rust (NoSQL API). Document CRUD, containers, and globally distributed data.
  Triggers: "cosmos db rust", "CosmosClient rust", "document crud rust", "NoSQL rust", "partition key rust".
license: MIT
metadata:
  author: Microsoft
  package: azure_data_cosmos
---

# Azure Cosmos DB library for Rust

Client library for Azure Cosmos DB NoSQL API — document CRUD, containers, and globally distributed data.

Use this skill when:

- An app needs to store or query documents in Cosmos DB from Rust
- You need CRUD operations on items with partition keys
- You need key-based auth as an alternative to Entra ID

> **IMPORTANT:** Only use the official `azure_data_cosmos` crate published by the [azure-sdk](https://crates.io/users/azure-sdk) crates.io user. Do NOT use the unofficial `azure_cosmos` or `azure_sdk_for_rust` community crates. Official crates use underscores in names and none have version 0.21.0.

## Installation

```sh
cargo add azure_data_cosmos azure_identity serde serde_json tokio
```

> If your code uses `azure_core` types directly (for example, `azure_core::credentials::TokenCredential`), add `azure_core` to `Cargo.toml`. If you only use `azure_data_cosmos` re-exports, direct `azure_core` dependency is optional.

## Environment Variables

```bash
COSMOS_ENDPOINT=https://<account>.documents.azure.com/ # Required for all operations
```

## Authentication

Rust Azure SDK code must not use `DefaultAzureCredential`. The Rust identity crate does not provide that type.

```rust
use azure_identity::DeveloperToolsCredential;
use azure_data_cosmos::{
    CosmosClient, AccountReference, AccountEndpoint, RoutingStrategy,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Local dev: DeveloperToolsCredential. Production: use ManagedIdentityCredential.
    let credential = DeveloperToolsCredential::new(None)?;
    let endpoint: AccountEndpoint = "https://<account>.documents.azure.com/"
        .parse()?;
    let account = AccountReference::with_credential(endpoint, credential);
    let client = CosmosClient::builder()
        .build(account, RoutingStrategy::ProximityTo("East US".into()))
        .await?;
    Ok(())
}
```

Prefer the crate README/examples when checking builder signatures and CRUD method shapes instead of reconstructing APIs from memory or generated internals.

## Client Hierarchy

| Client            | Purpose                   | Access                                          |
| ----------------- | ------------------------- | ----------------------------------------------- |
| `CosmosClient`    | Account-level operations  | `CosmosClient::builder().build(account).await?` |
| `DatabaseClient`  | Database operations       | `client.database_client("db")`                  |
| `ContainerClient` | Container/item operations | `database.container_client("c").await`          |

## Core Workflow

```rust
use serde::{Serialize, Deserialize};
use azure_data_cosmos::CosmosClient;

#[derive(Serialize, Deserialize)]
struct Item {
    pub id: String,
    pub partition_key: String,
    pub value: String,
}

async fn crud(client: CosmosClient) -> Result<(), Box<dyn std::error::Error>> {
    let container = client
        .database_client("myDatabase")
        .container_client("myContainer")
        .await;

    let item = Item {
        id: "1".into(),
        partition_key: "pk1".into(),
        value: "hello".into(),
    };

    // Create
    container.create_item("pk1", "1", item, None).await?;

    // Read
    let resp = container.read_item("pk1", "1", None).await?;
    let mut item: Item = resp.into_model()?;

    // Update
    item.value = "updated".into();
    container.replace_item("pk1", "1", item, None).await?;

    // Delete
    container.delete_item("pk1", "1", None).await?;
    Ok(())
}
```

### Patch Item

```rust
use azure_data_cosmos::{PatchInstructions, PatchOperation};

let patch = PatchInstructions::from(vec![
    PatchOperation::set("/value", serde_json::json!("patched")),
]);
let patched: Item = container
    .patch_item("pk1", "1", patch, None)
    .await?
    .into_model()?;
println!("Patched value: {}", patched.value);
```

## Key Auth (Optional)

Enable account key authentication with the feature flag:

```sh
cargo add azure_data_cosmos --features key_auth
```

## RBAC Roles

For Entra ID auth, assign one of these built-in Cosmos DB roles:

| Role                                  | Access     |
| ------------------------------------- | ---------- |
| `Cosmos DB Built-in Data Reader`      | Read-only  |
| `Cosmos DB Built-in Data Contributor` | Read/write |

## Best Practices

1. **Use `cargo add` to manage dependencies, never edit `Cargo.toml` directly.** Add and remove Rust SDK dependencies with cargo commands instead of manual manifest edits.
2. **Add `azure_core` only when importing `azure_core` types directly.** If your code imports `azure_core::http::Url`, `azure_core::http::RequestContent`, or `azure_core::error::ErrorKind`, include `azure_core`; otherwise a direct dependency is optional.
3. **Use `DeveloperToolsCredential`** for local dev, **`ManagedIdentityCredential`** for production — Rust does not provide a single `DefaultAzureCredential` type
4. **Never hardcode credentials** — use environment variables or managed identity
5. **Reuse `CosmosClient`** — clients are thread-safe; create once, share across tasks
6. **Use `RoutingStrategy::ProximityTo`** — route to the nearest region for lowest latency
7. **Always specify partition key** for item operations — Cosmos DB requires it for all CRUD
8. **Run `cargo clippy -- -D warnings`** when the prompt, eval, or CI expects lint-clean output
9. **Future-proof `#[non_exhaustive]` SDK models** — when constructing SDK model/options structs, end the initializer with `..Default::default()` (add `#[allow(clippy::needless_update)]`) and use a `_` wildcard arm when matching SDK enums, so new service-added fields/variants don't break your build

## Reference Links

| Resource      | Link                                                                               |
| ------------- | ---------------------------------------------------------------------------------- |
| API Reference | https://docs.rs/azure_data_cosmos/latest/azure_data_cosmos                         |
| crates.io     | https://crates.io/crates/azure_data_cosmos                                         |
| Source Code   | https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/cosmos/azure_data_cosmos |
