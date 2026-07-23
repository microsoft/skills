---
name: azure-keyvault-secrets-rust
description: |
  Azure Key Vault Secrets library for Rust. Store and retrieve secrets, passwords, and API keys.
  Triggers: "keyvault secrets rust", "SecretClient rust", "get secret rust", "set secret rust", "list secrets rust".
license: MIT
metadata:
  author: Microsoft
  package: azure_security_keyvault_secrets
---

# Azure Key Vault Secrets library for Rust

Secure storage for passwords, API keys, and connection strings.

Use this skill when:

- An app needs to store or retrieve secrets from Azure Key Vault in Rust
- You need to set, get, update, or delete secrets
- You need to list secret properties with pagination
- You need error handling for missing secrets

> **IMPORTANT:** Only use the official `azure_security_keyvault_secrets` crate published by the [azure-sdk](https://crates.io/users/azure-sdk) crates.io user. Do NOT use unofficial or community crates. Official crates use underscores in names and none have version 0.21.0.

## Installation

```sh
cargo add azure_security_keyvault_secrets azure_identity tokio futures
```

> If your code uses `azure_core` types directly, add `azure_core` to `Cargo.toml`. If you only use `azure_security_keyvault_secrets` re-exports, direct `azure_core` dependency is optional.

## Environment Variables

```bash
AZURE_KEYVAULT_URL=https://<vault-name>.vault.azure.net/ # Required for all operations
```

## Authentication

Rust Azure SDK code must not use `DefaultAzureCredential`. The Rust identity crate does not provide that type.

```rust
use azure_identity::DeveloperToolsCredential;
use azure_security_keyvault_secrets::SecretClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Local dev: DeveloperToolsCredential. Production: use ManagedIdentityCredential.
    let credential = DeveloperToolsCredential::new(None)?;
    let client = SecretClient::new(
        "https://<vault-name>.vault.azure.net/",
        credential.clone(),
        None,
    )?;

    let secret = client
        .get_secret("secret-name", None)
        .await?
        .into_model()?;
    println!("Secret: {:?}", secret.value);
    Ok(())
}
```

Prefer the crate README/examples when checking whether pagers yield items directly and how `ResourceExt` is used in public examples.

## Core Workflow

### Set Secret

```rust
use azure_security_keyvault_secrets::{models::SetSecretParameters, ResourceExt};

let params = SetSecretParameters {
    value: Some("secret-value".into()),
    ..Default::default()
};

let secret = client
    .set_secret("secret-name", params.try_into()?, None)
    .await?
    .into_model()?;

println!(
    "Name: {:?}, Version: {:?}",
    secret.resource_id()?.name,
    secret.resource_id()?.version
);
```

### Update Secret Properties

```rust
use azure_security_keyvault_secrets::models::UpdateSecretPropertiesParameters;
use std::collections::HashMap;

#[allow(clippy::needless_update)]
let params = UpdateSecretPropertiesParameters {
    content_type: Some("text/plain".into()),
    tags: Some(HashMap::from_iter(vec![(
        "env".into(),
        "prod".into(),
    )])),
    ..Default::default()
};

client
    .update_secret_properties("secret-name", params.try_into()?, None)
    .await?
    .into_model()?;
```

### Delete Secret

```rust
client.delete_secret("secret-name", None).await?;
```

### List Secrets (Pagination)

`list_secret_properties` returns a `Pager<T>` — iterate items directly:

```rust
use azure_security_keyvault_secrets::ResourceExt;
use futures::TryStreamExt as _;

let mut pager = client.list_secret_properties(None)?;
while let Some(secret) = pager.try_next().await? {
    println!("Found: {}", secret.resource_id()?.name);
}
```

## Error Handling

```rust
match client.get_secret("secret-name", None).await {
    Ok(response) => println!("Secret Value: {:?}", response.into_model()?.value),
    Err(err) => println!("Error: {:#?}", err.into_inner()?),
}

// Error output includes structured ErrorResponse with code and message
```

## RBAC Roles

For Entra ID auth, assign one of these roles:

| Role                        | Access                 |
| --------------------------- | ---------------------- |
| `Key Vault Secrets User`    | Read secrets           |
| `Key Vault Secrets Officer` | Full secret management |

## Best Practices

1. **Use `cargo add` to manage dependencies, never edit `Cargo.toml` directly.** Add and remove Rust SDK dependencies with cargo commands instead of manual manifest edits.
2. **Add `azure_core` only when importing `azure_core` types directly.** If your code imports `azure_core::http::Url`, `azure_core::http::RequestContent`, or `azure_core::error::ErrorKind`, include `azure_core`; otherwise a direct dependency is optional.
3. **Use `DeveloperToolsCredential`** for local dev, **`ManagedIdentityCredential`** for production — Rust does not provide a single `DefaultAzureCredential` type
4. **Never hardcode credentials** — use environment variables or managed identity
5. **Use `..Default::default()`** with `#[allow(clippy::needless_update)]` for model struct updates
6. **Use `ResourceExt`** to extract resource name/version from secret IDs
7. **Reuse clients** — `SecretClient` is thread-safe; create once, share across tasks
8. **Run `cargo clippy -- -D warnings`** when the prompt, eval, or CI expects lint-clean output

## Reference Links

| Resource      | Link                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------- |
| API Reference | https://docs.rs/azure_security_keyvault_secrets/latest/azure_security_keyvault_secrets             |
| crates.io     | https://crates.io/crates/azure_security_keyvault_secrets                                           |
| Source Code   | https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/keyvault/azure_security_keyvault_secrets |
