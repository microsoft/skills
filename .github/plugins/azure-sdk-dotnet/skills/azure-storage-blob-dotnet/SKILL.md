---
name: azure-storage-blob-dotnet
description: |
  Azure Storage Blob SDK for .NET. Client library for storing and managing unstructured data (files, images, backups, logs) in Azure Blob Storage. Use for uploading, downloading, streaming, listing, copying, and deleting blobs, managing containers, generating SAS tokens, and setting blob properties/metadata. Triggers: "Azure Blob Storage .NET", "BlobServiceClient", "BlobContainerClient", "BlobClient", "upload download blob C#", "Azure.Storage.Blobs", "SAS token blob", "blob streaming", "block blob".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: Azure.Storage.Blobs
---

# Azure.Storage.Blobs (.NET)

Client library for storing and managing unstructured data in Azure Blob Storage.

## Installation

```bash
dotnet add package Azure.Storage.Blobs
dotnet add package Azure.Identity
```

**Current Version**: 12.29.0 (stable)

## Environment Variables

```bash
AZURE_STORAGE_ACCOUNT_URL=https://<account>.blob.core.windows.net   # Required for Entra ID auth
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...  # Alternative to Entra ID auth
```

## Client Creation

### BlobServiceClient with DefaultAzureCredential

Prefer Microsoft Entra ID (`DefaultAzureCredential`) over account keys or connection strings.

```csharp
using Azure.Identity;
using Azure.Storage.Blobs;

string accountUrl = Environment.GetEnvironmentVariable("AZURE_STORAGE_ACCOUNT_URL")
    ?? throw new InvalidOperationException("AZURE_STORAGE_ACCOUNT_URL not set");

var serviceClient = new BlobServiceClient(new Uri(accountUrl), new DefaultAzureCredential());
```

### BlobContainerClient

```csharp
// From the service client
BlobContainerClient containerClient = serviceClient.GetBlobContainerClient("mycontainer");

// Direct construction with DefaultAzureCredential
var containerClient2 = new BlobContainerClient(
    new Uri($"{accountUrl}/mycontainer"),
    new DefaultAzureCredential());
```

### BlobClient

```csharp
// From the container client
BlobClient blobClient = containerClient.GetBlobClient("myblob.txt");

// With virtual directory structure
BlobClient nested = containerClient.GetBlobClient("folder/subfolder/myblob.txt");
```

### With Connection String (non-Entra fallback)

```csharp
string connectionString = Environment.GetEnvironmentVariable("AZURE_STORAGE_CONNECTION_STRING");
var serviceClient = new BlobServiceClient(connectionString);
```

## Core Patterns

### Create Container

```csharp
// Throws RequestFailedException (409) if the container already exists
BlobContainerClient container = await serviceClient.CreateBlobContainerAsync("mycontainer");

// Or from an existing container client
await containerClient.CreateIfNotExistsAsync();
```

### Upload Data

```csharp
using Azure.Storage.Blobs.Models;

// Upload a string via BinaryData (overwrite enabled)
await blobClient.UploadAsync(BinaryData.FromString("Hello, Azure Blob Storage!"), overwrite: true);

// Upload a file from a local path
await blobClient.UploadAsync("local-file.txt", overwrite: true);

// Upload from a stream
await using (FileStream stream = File.OpenRead("large-file.bin"))
{
    await blobClient.UploadAsync(stream, overwrite: true);
}
```

### Upload with Headers and Metadata

```csharp
using Azure.Storage.Blobs.Models;

var options = new BlobUploadOptions
{
    HttpHeaders = new BlobHttpHeaders
    {
        ContentType = "application/json",
        CacheControl = "max-age=3600"
    },
    Metadata = new Dictionary<string, string>
    {
        ["author"] = "john",
        ["version"] = "1.0"
    }
};

await using FileStream stream = File.OpenRead("data.json");
await blobClient.UploadAsync(stream, options);
```

### Upload Only If Not Exists

```csharp
using Azure;
using Azure.Storage.Blobs.Models;

var options = new BlobUploadOptions
{
    Conditions = new BlobRequestConditions { IfNoneMatch = ETag.All }
};

try
{
    await using FileStream stream = File.OpenRead("data.json");
    await blobClient.UploadAsync(stream, options);
}
catch (RequestFailedException ex) when (ex.Status == 409)
{
    Console.WriteLine("Blob already exists");
}
```

### Download Data

```csharp
using Azure.Storage.Blobs.Models;

// Download content into memory (small blobs)
BlobDownloadResult result = await blobClient.DownloadContentAsync();
string text = result.Content.ToString();

// Download to a local file
await blobClient.DownloadToAsync("downloaded-file.txt");
```

### Download to Stream (memory-efficient streaming)

```csharp
BlobDownloadStreamingResult download = await blobClient.DownloadStreamingAsync();
await using (Stream source = download.Content)
await using (FileStream destination = File.Create("large-download.bin"))
{
    await source.CopyToAsync(destination);
}

// Or open a readable stream directly
await using Stream blobStream = await blobClient.OpenReadAsync();
```

### Upload via Writable Stream

```csharp
await using Stream writeStream = await blobClient.OpenWriteAsync(overwrite: true);
await writeStream.WriteAsync(Encoding.UTF8.GetBytes("Streaming data..."));
```

### List Blobs

```csharp
using Azure.Storage.Blobs.Models;

// List all blobs
await foreach (BlobItem blob in containerClient.GetBlobsAsync())
{
    Console.WriteLine($"Blob: {blob.Name}, Size: {blob.Properties.ContentLength}");
}

// List with a prefix (virtual directory)
await foreach (BlobItem blob in containerClient.GetBlobsAsync(prefix: "folder/subfolder/"))
{
    Console.WriteLine(blob.Name);
}
```

### List Blobs by Hierarchy (directories)

```csharp
using Azure.Storage.Blobs.Models;

await foreach (BlobHierarchyItem item in
    containerClient.GetBlobsByHierarchyAsync(prefix: "data/", delimiter: "/"))
{
    if (item.IsPrefix)
        Console.WriteLine($"Directory: {item.Prefix}");
    else
        Console.WriteLine($"Blob: {item.Blob.Name}");
}
```

### Delete Blob

```csharp
using Azure.Storage.Blobs.Models;

// Delete if exists (idempotent)
await blobClient.DeleteIfExistsAsync();

// Delete including snapshots
await blobClient.DeleteIfExistsAsync(DeleteSnapshotsOption.IncludeSnapshots);
```

### Copy Blob

```csharp
using Azure.Storage.Blobs.Models;

// Async copy (large blobs or cross-account)
CopyFromUriOperation operation = await destBlobClient.StartCopyFromUriAsync(sourceBlobUri);
await operation.WaitForCompletionAsync();

// Synchronous copy from URL (same account, smaller blobs)
await destBlobClient.SyncCopyFromUriAsync(sourceBlobUri);
```

### Generate SAS Token

`GenerateSasUri` requires the client to be authorized with a shared key. When using
`DefaultAzureCredential`, create a **user delegation SAS** instead (see below).

```csharp
using Azure.Storage.Sas;

// Shared-key authorized client (blob-level, read-only, 1-day expiry)
if (blobClient.CanGenerateSasUri)
{
    var sasBuilder = new BlobSasBuilder(BlobSasPermissions.Read, DateTimeOffset.UtcNow.AddDays(1))
    {
        BlobContainerName = blobClient.BlobContainerName,
        BlobName = blobClient.Name,
        Resource = "b"
    };

    Uri sasUri = blobClient.GenerateSasUri(sasBuilder);
}
```

### Generate User Delegation SAS (with Entra ID)

```csharp
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;

UserDelegationKey delegationKey = await serviceClient.GetUserDelegationKeyAsync(
    DateTimeOffset.UtcNow,
    DateTimeOffset.UtcNow.AddDays(1));

var sasBuilder = new BlobSasBuilder(BlobSasPermissions.Read, DateTimeOffset.UtcNow.AddDays(1))
{
    BlobContainerName = containerClient.Name,
    BlobName = "myblob.txt",
    Resource = "b"
};

var uriBuilder = new BlobUriBuilder(blobClient.Uri)
{
    Sas = sasBuilder.ToSasQueryParameters(delegationKey, serviceClient.AccountName)
};

Uri sasUri = uriBuilder.ToUri();
```

### Blob Properties and Metadata

```csharp
using Azure.Storage.Blobs.Models;

// Get properties
BlobProperties properties = await blobClient.GetPropertiesAsync();
Console.WriteLine($"Size: {properties.ContentLength}");
Console.WriteLine($"Content-Type: {properties.ContentType}");
Console.WriteLine($"Last Modified: {properties.LastModified}");

// Set metadata
var metadata = new Dictionary<string, string> { ["processed"] = "true", ["version"] = "2.0" };
await blobClient.SetMetadataAsync(metadata);

// Set HTTP headers
await blobClient.SetHttpHeadersAsync(new BlobHttpHeaders
{
    ContentType = "application/octet-stream",
    CacheControl = "max-age=86400"
});
```

### Lease Blob

```csharp
using Azure.Storage.Blobs.Models;
using Azure.Storage.Blobs.Specialized;

BlobLeaseClient leaseClient = blobClient.GetBlobLeaseClient();

// Acquire a 60-second lease (use TimeSpan.FromSeconds(-1) for infinite)
BlobLease lease = await leaseClient.AcquireAsync(TimeSpan.FromSeconds(60));
try
{
    await blobClient.UploadAsync(BinaryData.FromString("Updated content"), overwrite: true);
    await leaseClient.RenewAsync();
}
finally
{
    await leaseClient.ReleaseAsync();
}
```

## Error Handling

All service errors surface as `RequestFailedException`. Inspect `Status` and `ErrorCode`.

```csharp
using Azure;

try
{
    BlobDownloadResult result = await blobClient.DownloadContentAsync();
}
catch (RequestFailedException ex)
{
    switch (ex.Status)
    {
        case 404:  // BlobNotFound
            Console.Error.WriteLine($"Blob not found. ErrorCode: {ex.ErrorCode}");
            break;
        case 409:  // Conflict (lease, already exists)
            Console.Error.WriteLine($"Conflict. ErrorCode: {ex.ErrorCode}");
            throw;
        case 403:  // Authorization failure
            Console.Error.WriteLine($"Access denied. ErrorCode: {ex.ErrorCode}");
            throw;
        default:
            Console.Error.WriteLine($"Error {ex.Status}: {ex.Message}");
            throw;
    }
}
```

## Best Practices

- Use `DefaultAzureCredential` over account keys or connection strings for authentication.
- For SAS with Entra ID, use a **user delegation SAS** — `GenerateSasUri` requires shared-key auth.
- Pass `overwrite: true` explicitly; uploads fail if the blob exists and overwrite is not set.
- Use `CreateIfNotExistsAsync` / `DeleteIfExistsAsync` for idempotent operations.
- Stream large blobs with `OpenReadAsync` / `OpenWriteAsync` / `DownloadStreamingAsync` instead of buffering in memory.
- Catch `RequestFailedException` and branch on `Status` / `ErrorCode` — never swallow generic exceptions.
- Reuse a single `BlobServiceClient` instance; it is thread-safe and manages connection pooling.

## Trigger Phrases

- "Azure Blob Storage .NET"
- "upload download blob C#"
- "BlobServiceClient BlobContainerClient"
- "blob streaming"
- "SAS token blob"
- "blob metadata properties"
