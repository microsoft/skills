---
name: azure-keyvault-certificates-rust
description: |
  Azure Key Vault Certificates library for Rust. Create, manage, and use X.509 certificates including self-signed and CA-issued.
  Triggers: "keyvault certificates rust", "CertificateClient rust", "create certificate rust", "self-signed certificate rust", "X.509 rust".
license: MIT
metadata:
  author: Microsoft
  package: azure_security_keyvault_certificates
---

# Azure Key Vault Certificates library for Rust

Manage X.509 certificates for TLS/SSL, code signing, and authentication.

Use this skill when:

- An app needs to create or manage X.509 certificates in Key Vault from Rust
- You need self-signed or CA-issued certificates
- You need long-running operations (LRO) for certificate issuance
- You need to sign data using a certificate's key

> **IMPORTANT:** Only use the official `azure_security_keyvault_certificates` crate published by the [azure-sdk](https://crates.io/users/azure-sdk) crates.io user. Do NOT use unofficial or community crates. Official crates use underscores in names and none have version 0.21.0.

## Installation

```sh
cargo add azure_security_keyvault_certificates azure_identity tokio futures
```

> If your code uses `azure_core` types directly, add `azure_core` to `Cargo.toml`. If you only use `azure_security_keyvault_certificates` re-exports, direct `azure_core` dependency is optional.

## Environment Variables

```bash
AZURE_KEYVAULT_URL=https://<vault-name>.vault.azure.net/ # Required for all operations
```

## Authentication

Rust Azure SDK code must not use `DefaultAzureCredential`. The Rust identity crate does not provide that type.

```rust
use azure_identity::DeveloperToolsCredential;
use azure_security_keyvault_certificates::CertificateClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Local dev: DeveloperToolsCredential. Production: use ManagedIdentityCredential.
    let credential = DeveloperToolsCredential::new(None)?;
    let client = CertificateClient::new(
        "https://<vault-name>.vault.azure.net/",
        credential.clone(),
        None,
    )?;

    let cert = client
        .get_certificate("cert-name", None)
        .await?
        .into_model()?;
    println!("Certificate: {:?}", cert.id);
    Ok(())
}
```

Prefer the crate README/examples when checking LRO and poller usage rather than inferring public behavior from generated internal types.

## Core Workflow

### Create Self-Signed Certificate (LRO)

Creating a certificate is a long-running operation. `Poller<T>` implements `IntoFuture` — just `.await`:

```rust
use azure_security_keyvault_certificates::{
    models::{
        CertificatePolicy, CreateCertificateParameters, IssuerParameters,
        X509CertificateProperties,
    },
    ResourceExt,
};

let policy = CertificatePolicy {
    x509_certificate_properties: Some(X509CertificateProperties {
        subject: Some("CN=example.com".into()),
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

// Poller implements IntoFuture — await directly for completion
let cert = client
    .begin_create_certificate("cert-name", body.try_into()?, None)?
    .await?
    .into_model()?;

println!(
    "Name: {:?}, Version: {:?}",
    cert.resource_id()?.name,
    cert.resource_id()?.version,
);
```

### Update Certificate Properties

```rust
use azure_security_keyvault_certificates::models::UpdateCertificatePropertiesParameters;
use std::collections::HashMap;

#[allow(clippy::needless_update)]
let params = UpdateCertificatePropertiesParameters {
    tags: Some(HashMap::from_iter(vec![("env".into(), "prod".into())])),
    ..Default::default()
};

client
    .update_certificate_properties("cert-name", params.try_into()?, None)
    .await?
    .into_model()?;
```

### Delete Certificate

```rust
client.delete_certificate("cert-name", None).await?;
```

### List Certificates (Pagination)

`list_certificate_properties` returns a `Pager<T>` — iterate items directly:

```rust
use azure_security_keyvault_certificates::ResourceExt;
use futures::TryStreamExt as _;

let mut pager = client.list_certificate_properties(None)?;
while let Some(cert) = pager.try_next().await? {
    println!("Found: {}", cert.resource_id()?.name);
}
```

## Signing with a Certificate's Key

Certificates in Key Vault have an associated key. Use the Key Vault Keys SDK for crypto operations:

```rust
use azure_security_keyvault_keys::{
    models::{KeyClientSignOptions, SignParameters, SignatureAlgorithm},
    KeyClient,
};

let key_client = KeyClient::new(
    "https://<vault-name>.vault.azure.net/",
    credential.clone(),
    None,
)?;

// Sign with the certificate's EC key
let digest = vec![0u8; 32]; // SHA-256 digest
let body = SignParameters {
    algorithm: Some(SignatureAlgorithm::Es256),
    value: Some(digest),
};

let result = key_client
    .sign(
        "cert-name",
        body.try_into()?,
        Some(KeyClientSignOptions {
            key_version: Some("<certificate-version>".to_string()),
            ..Default::default()
        }),
    )
    .await?
    .into_model()?;
println!("Signature: {:?}", result.result);
```

## Certificate Formats

| Format  | Content Type             | Use Case                            |
| ------- | ------------------------ | ----------------------------------- |
| PKCS#12 | `application/x-pkcs12`   | Bundled cert + private key          |
| PEM     | `application/x-pem-file` | Base64-encoded, common in Linux/web |

## RBAC Roles

For Entra ID auth, assign one of these roles:

| Role                             | Access                      |
| -------------------------------- | --------------------------- |
| `Key Vault Certificate User`     | Use certificates            |
| `Key Vault Certificates Officer` | Full certificate management |

## Best Practices

1. **Use `cargo add` to manage dependencies, never edit `Cargo.toml` directly.** Add and remove Rust SDK dependencies with cargo commands instead of manual manifest edits.
2. **Add `azure_core` only when importing `azure_core` types directly.** If your code imports `azure_core::http::Url`, `azure_core::http::RequestContent`, or `azure_core::error::ErrorKind`, include `azure_core`; otherwise a direct dependency is optional.
3. **Use `DeveloperToolsCredential`** for local dev, **`ManagedIdentityCredential`** for production — Rust does not provide a single `DefaultAzureCredential` type
4. **Never hardcode credentials** — use environment variables or managed identity
5. **Use `..Default::default()`** with `#[allow(clippy::needless_update)]` for model struct updates
6. **Use `ResourceExt`** to extract certificate name/version from IDs
7. **LROs** — `begin_create_certificate` returns a `Poller`; just `.await` for completion (clients should rarely poll for status)
8. **Reuse clients** — `CertificateClient` is thread-safe; create once, share across tasks
9. **Run `cargo clippy -- -D warnings`** when the prompt, eval, or CI expects lint-clean output

## Reference Links

| Resource      | Link                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| API Reference | https://docs.rs/azure_security_keyvault_certificates/latest/azure_security_keyvault_certificates        |
| crates.io     | https://crates.io/crates/azure_security_keyvault_certificates                                           |
| Source Code   | https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/keyvault/azure_security_keyvault_certificates |
