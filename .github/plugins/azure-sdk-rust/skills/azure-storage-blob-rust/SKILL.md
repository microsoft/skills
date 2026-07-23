---
name: azure-storage-blob-rust
description: |
  Azure Blob Storage library for Rust. Upload, download, and manage blobs and containers.
  Triggers: "blob storage rust", "BlobClient rust", "upload blob rust", "download blob rust", "storage container rust", "BlobServiceClient rust".
license: MIT
metadata:
  author: Microsoft
  package: azure_storage_blob
---

# Azure Blob Storage library for Rust

Client library for Azure Blob Storage — upload, download, and manage blobs and containers.

Use this skill when:

- An app needs to upload or download blobs from Azure Storage in Rust
- You need to create or manage blob containers
- You need to list blobs with pagination
- You need RBAC-based auth for blob operations

> **IMPORTANT:** Only use the official `azure_storage_blob` crate published by the [azure-sdk](https://crates.io/users/azure-sdk) crates.io user. Do NOT use the unofficial `azure_storage`, `azure_storage_blobs`, or `azure_sdk_for_rust` community crates. Official crates use underscores in names and none have version 0.21.0.

## Installation

```sh
cargo add azure_storage_blob azure_identity azure_core tokio futures
```

> If your code uses `azure_core` types directly (for example, `azure_core::http::Url` or `azure_core::http::RequestContent`), add `azure_core` to `Cargo.toml`. If you only use `azure_storage_blob` re-exports, direct `azure_core` dependency is optional.

## Environment Variables

```bash
AZURE_STORAGE_ACCOUNT=<account-name>                         # Preferred when the caller gives an account name
AZURE_STORAGE_ENDPOINT=https://<account>.blob.core.windows.net/ # Optional alternative when the caller gives a full endpoint
```

When both are available, prefer constructing the endpoint from `AZURE_STORAGE_ACCOUNT` so the code matches common evaluation prompts.

## Authentication

Rust Azure SDK code must not use `DefaultAzureCredential`. The Rust identity crate does not provide that type.

```rust
// Correct for local development
use azure_identity::DeveloperToolsCredential;

let credential = DeveloperToolsCredential::new(None)?;
```

```rust
// Incorrect in Rust: this type does not exist in azure_identity
use azure_identity::DefaultAzureCredential;
```

```rust
use azure_core::http::Url;
use azure_identity::DeveloperToolsCredential;
use azure_storage_blob::BlobServiceClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Local dev: DeveloperToolsCredential. Production: use ManagedIdentityCredential.
    let credential = DeveloperToolsCredential::new(None)?;
    let service_url = Url::parse("https://<storage_account_name>.blob.core.windows.net/")?;
    let service_client = BlobServiceClient::new(
        service_url,
        Some(credential),
        None,
    )?;

    // Derive container and blob clients by name.
    let container_client = service_client.blob_container_client("<container_name>");
    let blob_client = container_client.blob_client("<blob_name>");
    Ok(())
}
```

## Client Types

| Client                | Purpose                                   |
| --------------------- | ----------------------------------------- |
| `BlobServiceClient`   | Account-level operations, list containers |
| `BlobContainerClient` | Container operations, list blobs          |
| `BlobClient`          | Individual blob operations                |

## Core Workflow

### Upload Blob

```rust
use azure_core::http::{RequestContent, Url};
use azure_identity::DeveloperToolsCredential;
use azure_storage_blob::BlobServiceClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Local dev: DeveloperToolsCredential. Production: use ManagedIdentityCredential.
    let credential = DeveloperToolsCredential::new(None)?;
    let service_url = Url::parse("https://<storage_account_name>.blob.core.windows.net/")?;
    let service_client = BlobServiceClient::new(service_url, Some(credential), None)?;
    let blob_client = service_client.blob_client("<container_name>", "<blob_name>");

    let data = b"hello world";
    blob_client.upload(RequestContent::from(data.to_vec()), None).await?;
    Ok(())
}
```

### Download Blob / Get Properties

```rust
// Get blob properties
let props = blob_client.get_properties(None).await?;

// Download blob content
let response = blob_client.download(None).await?;
let content = String::from_utf8(response.body.collect().await?.into())?;
```

### Delete Blob

```rust
blob_client.delete(None).await?;
```

### Container Operations

```rust
use azure_core::http::Url;
use azure_identity::DeveloperToolsCredential;
use azure_storage_blob::BlobServiceClient;
use futures::TryStreamExt as _;

let credential = DeveloperToolsCredential::new(None)?;
let service_url = Url::parse("https://<storage_account_name>.blob.core.windows.net/")?;
let service_client = BlobServiceClient::new(service_url, Some(credential), None)?;
let container_client = service_client.blob_container_client("<container_name>");

// Create container
container_client.create(None).await?;

// List blobs (the pager yields BlobItem values directly for this client pattern)
let mut pager = container_client.list_blobs(None)?;
while let Some(blob) = pager.try_next().await? {
    let name = blob.name.as_deref().unwrap_or("<unnamed>");
    let size = blob
        .properties
        .as_ref()
        .and_then(|properties| properties.content_length);

    match size {
        Some(size) => println!("Blob: {name} ({size} bytes)"),
        None => println!("Blob: {name}"),
    }
}
```

For `azure_storage_blob` 1.x, do not assume you need a nested page loop like `for item in &page.blob_items`. In this usage pattern, `try_next()` already yields the blob item you want to print.

## Error Handling

Use `StorageError` for programmatic access to storage-specific error codes:

```rust
use azure_core::error::ErrorKind;
use azure_storage_blob::StorageError;
use azure_storage_blob::models::StorageErrorCode;

let result = blob_client.download(None).await;

match result {
    Ok(response) => {
        let content: Vec<u8> = response.body.collect().await?.into();
        println!("Downloaded {} bytes", content.len());
    }
    Err(error) => {
        if matches!(error.kind(), ErrorKind::HttpResponse { .. }) {
            // Convert to StorageError for programmatic access
            let storage_error: StorageError = error.try_into()?;
            println!("HTTP Status: {}", storage_error.status_code);

            if let Some(error_code) = &storage_error.error_code {
                match error_code {
                    StorageErrorCode::BlobNotFound => {
                        println!("The blob does not exist.");
                    }
                    StorageErrorCode::ContainerNotFound => {
                        println!("The container does not exist.");
                    }
                    StorageErrorCode::AuthorizationFailure => {
                        println!("Authorization failed. Check RBAC roles.");
                    }
                    _ => println!("Storage error: {error_code}"),
                }
            }

            if let Some(request_id) = &storage_error.request_id {
                println!("Request ID (for Azure support): {request_id}");
            }
        } else {
            println!("Non-HTTP error: {:?}", error);
        }
    }
}
```

> **Note:** `StorageError::try_into` requires an owned error object — it will not compile if handed a reference to an error.

## RBAC Roles

For Entra ID auth, assign one of these roles to the identity:

| Role                            | Access                     |
| ------------------------------- | -------------------------- |
| `Storage Blob Data Reader`      | Read-only                  |
| `Storage Blob Data Contributor` | Read/write                 |
| `Storage Blob Data Owner`       | Full access including RBAC |

## Best Practices

1. **Use `cargo add` to manage dependencies, never edit `Cargo.toml` directly.** Add and remove Rust SDK dependencies with cargo commands instead of manual manifest edits.
2. **Add `azure_core` only when importing `azure_core` types directly.** If your code imports `azure_core::http::Url`, `azure_core::http::RequestContent`, or `azure_core::error::ErrorKind`, include `azure_core`; otherwise a direct dependency is optional.
3. **Use `DeveloperToolsCredential`** for local dev, **`ManagedIdentityCredential`** for production — Rust does not provide a single `DefaultAzureCredential` type
4. **Never hardcode credentials** — use environment variables or managed identity
5. **Use `RequestContent::from()`** to wrap data for blob uploads — ensures proper content handling by the SDK
6. **Assign RBAC roles** — ensure "Storage Blob Data Contributor" for write access
7. **Reuse clients** — clients are thread-safe; create once, share across tasks
8. **Prefer `BlobServiceClient` as the entry point** and derive container/blob clients from it
9. **Treat many storage model fields as optional.** `blob.name` is an `Option<String>` and content length is accessed via `blob.properties.as_ref().and_then(|p| p.content_length)`.
10. **Run `cargo clippy -- -D warnings` before considering the task complete** when the prompt or CI expects strict lint compliance; fix style lints such as collapsible `if` blocks, not just compiler errors.
11. **Prefer crate README/examples over generated internal type names** when validating public API shapes such as pagination results
12. **Future-proof `#[non_exhaustive]` SDK models** — when constructing SDK model/options structs, end the initializer with `..Default::default()` (add `#[allow(clippy::needless_update)]`) and use a `_` wildcard arm when matching SDK enums, so new service-added fields/variants don't break your build

## Common Rust Blob Pitfalls

- Do not import `azure_identity::DefaultAzureCredential`; use `DeveloperToolsCredential` or another real Rust credential type.
- Do not assume generated internal model names describe the public pager item type; follow the documented `list_blobs` example for this crate.
- Do not print `blob.name` with `{}` directly; unwrap or provide a fallback because it is optional.
- Do not stop after `cargo build` passes when the task also requires `cargo clippy -- -D warnings`.

## Reference Links

| Resource      | Link                                                                                 |
| ------------- | ------------------------------------------------------------------------------------ |
| API Reference | https://docs.rs/crate/azure_storage_blob/latest                                      |
| crates.io     | https://crates.io/crates/azure_storage_blob                                          |
| Source Code   | https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/storage/azure_storage_blob |
