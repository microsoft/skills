# Blob Storage — .NET SDK Quick Reference

> Condensed from **azure-storage-blob-dotnet**. Full patterns (SAS tokens,
> user delegation SAS, streaming, lease management, copy, properties/metadata)
> in the **azure-storage-blob-dotnet** plugin skill if installed.

## Install
```bash
dotnet add package Azure.Storage.Blobs
dotnet add package Azure.Identity
```

## Quick Start
```csharp
using Azure.Identity;
using Azure.Storage.Blobs;

var serviceClient = new BlobServiceClient(
    new Uri(Environment.GetEnvironmentVariable("AZURE_STORAGE_ACCOUNT_URL")),
    new DefaultAzureCredential());

BlobContainerClient containerClient = serviceClient.GetBlobContainerClient("mycontainer");
BlobClient blobClient = containerClient.GetBlobClient("myblob.txt");

await blobClient.UploadAsync(BinaryData.FromString("Hello, Azure Blob Storage!"), overwrite: true);
```

## Best Practices
- Use DefaultAzureCredential over account keys / connection strings. See [auth-best-practices.md](../auth-best-practices.md)
- Pass `overwrite: true` explicitly on `UploadAsync` — uploads fail if the blob exists otherwise
- Use `CreateIfNotExistsAsync()` / `DeleteIfExistsAsync()` for idempotent operations
- Use `BlobUploadOptions` to set `HttpHeaders` and `Metadata` on upload
- Stream large blobs with `OpenReadAsync` / `OpenWriteAsync` / `DownloadStreamingAsync`
- For SAS with Entra ID, use a user delegation SAS (`GetUserDelegationKeyAsync` + `BlobSasBuilder`)
- Handle `RequestFailedException` — branch on `Status` (404/409/403) and `ErrorCode`
