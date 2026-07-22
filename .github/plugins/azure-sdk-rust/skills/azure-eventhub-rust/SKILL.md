---
name: azure-eventhub-rust
description: |
  Azure Event Hubs library for Rust. Send and receive events for streaming data ingestion and batch processing.
  Triggers: "event hubs rust", "ProducerClient rust", "ConsumerClient rust", "send event rust", "streaming rust", "eventhub rust".
license: MIT
metadata:
  author: Microsoft
  package: azure_messaging_eventhubs
---

# Azure Event Hubs library for Rust

Client library for Azure Event Hubs — send and receive events for streaming data ingestion.

Use this skill when:

- An app needs to send events to Azure Event Hubs from Rust
- You need to receive and process events from partitions
- You need batch sending for throughput optimization
- You need to control consumer start position

> **IMPORTANT:** Only use the official `azure_messaging_eventhubs` crate published by the [azure-sdk](https://crates.io/users/azure-sdk) crates.io user. Do NOT use unofficial or community crates. Official crates use underscores in names and none have version 0.21.0.

## Installation

```sh
cargo add azure_messaging_eventhubs azure_identity azure_core tokio futures
```

> `ProducerClient`/`ConsumerClient` `.open()` require the credential as `Arc<dyn TokenCredential>`. Add `azure_core` so you can import `azure_core::credentials::TokenCredential` and type the credential binding explicitly (see Authentication below) — otherwise the compiler infers the concrete credential type and `.open()` fails to compile.

## Environment Variables

```bash
EVENTHUBS_HOST=<namespace>.servicebus.windows.net # Required — fully qualified namespace
EVENTHUB_NAME=<eventhub-name>                     # Required — name of the Event Hub
```

## Key Concepts

| Concept       | Description                                          |
| ------------- | ---------------------------------------------------- |
| **Namespace** | Container for one or more Event Hubs                 |
| **Event Hub** | Stream of events, partitioned for parallel reads     |
| **Partition** | Ordered, append-only sequence of events              |
| **Producer**  | Sends events via `ProducerClient`                    |
| **Consumer**  | Receives events from partitions via `ConsumerClient` |

## Authentication

```rust
use std::sync::Arc;
use azure_core::credentials::TokenCredential;
use azure_identity::DeveloperToolsCredential;
use azure_messaging_eventhubs::ProducerClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Local dev: DeveloperToolsCredential. Production: use ManagedIdentityCredential.
    // `.open()` requires `Arc<dyn TokenCredential>` — type the binding explicitly so
    // `DeveloperToolsCredential::new` coerces to the trait object instead of the concrete type.
    let credential: Arc<dyn TokenCredential> = DeveloperToolsCredential::new(None)?;

    // `.open()` takes the hub name as an owned `String`, not `&str`.
    let producer = ProducerClient::builder()
        .open(
            "<namespace>.servicebus.windows.net",
            "<eventhub-name>".to_string(),
            credential.clone(),
        )
        .await?;
    Ok(())
}
```

## Core Workflow

### Send Events

```rust
// Send a single event
producer.send_event(vec![1, 2, 3, 4], None).await?;
```

### Send Batch

```rust
let batch = producer.create_batch(None).await?;
batch.try_add_event_data(vec![1, 2, 3, 4], None)?;

producer.send_batch(batch, None).await?;
```

### Receive Events

```rust
use std::sync::Arc;
use azure_core::credentials::TokenCredential;
use azure_identity::DeveloperToolsCredential;
use azure_messaging_eventhubs::ConsumerClient;

// Local dev: DeveloperToolsCredential. Production: use ManagedIdentityCredential.
let credential: Arc<dyn TokenCredential> = DeveloperToolsCredential::new(None)?;
let consumer = ConsumerClient::builder()
    .open(
        "<namespace>.servicebus.windows.net",
        "<eventhub-name>".to_string(),
        credential.clone(),
    )
    .await?;
```

### Receive from Partition

```rust
use futures::stream::StreamExt;
use azure_messaging_eventhubs::{
    ConsumerClient, OpenReceiverOptions, StartLocation, StartPosition,
};

let receiver = consumer
    .open_receiver_on_partition(
        "0".to_string(),
        Some(OpenReceiverOptions {
            start_position: Some(StartPosition {
                location: StartLocation::Earliest,
                ..Default::default()
            }),
            ..Default::default()
        }),
    )
    .await?;

let mut stream = receiver.stream_events();
while let Some(event_result) = stream.next().await {
    match event_result {
        // Body is on the inner event data, not the received wrapper: `event.event_data().body()`.
        Ok(event) => {
            let body = event.event_data().body().unwrap_or_default();
            println!("Received: {:?}", body);
        }
        Err(err) => eprintln!("Error: {:?}", err),
    }
}
```

## RBAC Roles

For Entra ID auth, assign one of these roles:

| Role                             | Access         |
| -------------------------------- | -------------- |
| `Azure Event Hubs Data Sender`   | Send events    |
| `Azure Event Hubs Data Receiver` | Receive events |
| `Azure Event Hubs Data Owner`    | Full access    |

## Best Practices

1. **Use `cargo add` to manage dependencies, never edit `Cargo.toml` directly.** Add and remove Rust SDK dependencies with cargo commands instead of manual manifest edits.
2. **Type credentials as `Arc<dyn TokenCredential>`.** `ProducerClient`/`ConsumerClient` `.open()` require the trait object, not the concrete `DeveloperToolsCredential`/`ManagedIdentityCredential` type — import `azure_core::credentials::TokenCredential` and annotate the binding, or the build fails with a mismatched-types error.
3. **Pass the hub name as an owned `String`.** `.open()` takes `hub_name: String`, not `&str` — call `.to_string()` on `&str` values.
4. **Use `DeveloperToolsCredential`** for local dev, **`ManagedIdentityCredential`** for production — Rust does not provide a single `DefaultAzureCredential` type
5. **Never hardcode credentials** — use environment variables or managed identity
6. **Use batching** — `create_batch` + `send_batch` for throughput optimization
7. **Handle errors per event** — match on `Ok`/`Err` in the event stream
8. **Extract event bodies via `event.event_data().body()`**, not `event.body()` — `ReceivedEventData` wraps the underlying `EventData`.
9. **Specify start position** — use `StartLocation::Earliest` or `StartLocation::Latest` to control where consumption begins

## Reference Links

| Resource      | Link                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------- |
| API Reference | https://docs.rs/azure_messaging_eventhubs/latest/azure_messaging_eventhubs                    |
| crates.io     | https://crates.io/crates/azure_messaging_eventhubs                                            |
| Source Code   | https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/eventhubs/azure_messaging_eventhubs |
