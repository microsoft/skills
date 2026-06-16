# Azure Storage Blob .NET SDK Acceptance Criteria

**SDK**: `Azure.Storage.Blobs`
**Repository**: https://github.com/Azure/azure-sdk-for-net
**Purpose**: Skill testing acceptance criteria for validating generated code correctness

---

## 1. Client Builder Patterns

### ✅ CORRECT: BlobServiceClient with DefaultAzureCredential

```csharp
using Azure.Identity;
using Azure.Storage.Blobs;

var serviceClient = new BlobServiceClient(
    new Uri(Environment.GetEnvironmentVariable("AZURE_STORAGE_ACCOUNT_URL")),
    new DefaultAzureCredential());
```

### ✅ CORRECT: BlobContainerClient Direct Construction

```csharp
using Azure.Identity;
using Azure.Storage.Blobs;

var containerClient = new BlobContainerClient(
    new Uri("https://myaccount.blob.core.windows.net/mycontainer"),
    new DefaultAzureCredential());
```

### ✅ CORRECT: BlobClient for a Specific Blob

```csharp
BlobContainerClient containerClient = serviceClient.GetBlobContainerClient("mycontainer");
BlobClient blobClient = containerClient.GetBlobClient("folder/myfile.txt");
```

### ❌ INCORRECT: Hardcoded Connection String / Account Key

```csharp
// WRONG - hardcoded secret in source
var client = new BlobServiceClient(
    "DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=base64key==;");
```

### ❌ INCORRECT: Legacy Package

```csharp
// WRONG - deprecated v11 package
using Microsoft.Azure.Storage;
using Microsoft.Azure.Storage.Blob;
// Use Azure.Storage.Blobs (v12) instead
```

---

## 2. Container Operations

### ✅ CORRECT: Create Container If Not Exists

```csharp
await containerClient.CreateIfNotExistsAsync();
```

### ✅ CORRECT: List Containers

```csharp
using Azure.Storage.Blobs.Models;

await foreach (BlobContainerItem container in serviceClient.GetBlobContainersAsync())
{
    Console.WriteLine(container.Name);
}
```

### ❌ INCORRECT: Not Handling Already Exists

```csharp
// WRONG - throws RequestFailedException (409) if the container exists
await serviceClient.CreateBlobContainerAsync("mycontainer");
// Use CreateIfNotExistsAsync instead for idempotency
```

---

## 3. Upload Operations

### ✅ CORRECT: Upload with BinaryData

```csharp
await blobClient.UploadAsync(BinaryData.FromString("Hello, Azure Blob Storage!"), overwrite: true);
```

### ✅ CORRECT: Upload from File

```csharp
await blobClient.UploadAsync("path/to/local/file.txt", overwrite: true);
```

### ✅ CORRECT: Upload from Stream

```csharp
await using FileStream stream = File.OpenRead("largefile.bin");
await blobClient.UploadAsync(stream, overwrite: true);
```

### ✅ CORRECT: Upload with Options (Headers, Metadata)

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

### ✅ CORRECT: Upload Only If Not Exists

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

### ❌ INCORRECT: Missing Overwrite Flag

```csharp
// WRONG - throws if the blob already exists
await blobClient.UploadAsync(BinaryData.FromString(content));
```

---

## 4. Download Operations

### ✅ CORRECT: Download to Memory

```csharp
using Azure.Storage.Blobs.Models;

BlobDownloadResult result = await blobClient.DownloadContentAsync();
string text = result.Content.ToString();
```

### ✅ CORRECT: Download to File

```csharp
await blobClient.DownloadToAsync("path/to/downloaded/file.txt");
```

### ✅ CORRECT: Download with Streaming

```csharp
using Azure.Storage.Blobs.Models;

BlobDownloadStreamingResult download = await blobClient.DownloadStreamingAsync();
await using Stream source = download.Content;
await using FileStream destination = File.Create("large-download.bin");
await source.CopyToAsync(destination);
```

### ❌ INCORRECT: Not Handling Missing Blob

```csharp
// WRONG - no handling for a missing blob
BlobDownloadResult result = await blobClient.DownloadContentAsync();
// Should catch RequestFailedException with Status 404
```

---

## 5. List Blobs

### ✅ CORRECT: List All Blobs

```csharp
using Azure.Storage.Blobs.Models;

await foreach (BlobItem blob in containerClient.GetBlobsAsync())
{
    Console.WriteLine($"Blob: {blob.Name}, Size: {blob.Properties.ContentLength}");
}
```

### ✅ CORRECT: List with Prefix (Virtual Directory)

```csharp
using Azure.Storage.Blobs.Models;

await foreach (BlobItem blob in containerClient.GetBlobsAsync(prefix: "folder/subfolder/"))
{
    Console.WriteLine(blob.Name);
}
```

### ✅ CORRECT: List by Hierarchy (Directories)

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

---

## 6. Delete Operations

### ✅ CORRECT: Delete If Exists

```csharp
await blobClient.DeleteIfExistsAsync();
```

### ✅ CORRECT: Delete with Snapshots

```csharp
using Azure.Storage.Blobs.Models;

await blobClient.DeleteIfExistsAsync(DeleteSnapshotsOption.IncludeSnapshots);
```

### ❌ INCORRECT: Not Handling Missing Blob

```csharp
// WRONG - throws RequestFailedException (404) if the blob does not exist
await blobClient.DeleteAsync();
// Use DeleteIfExistsAsync instead
```

---

## 7. SAS Token Generation

### ✅ CORRECT: User Delegation SAS (Entra ID)

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

### ✅ CORRECT: Service SAS via Shared Key

```csharp
using Azure.Storage.Sas;

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

### ❌ INCORRECT: Overly Permissive, Long-Lived SAS

```csharp
// WRONG - all permissions and a one-year expiry
var sasBuilder = new BlobSasBuilder(BlobSasPermissions.All, DateTimeOffset.UtcNow.AddYears(1));
```

---

## 8. Blob Properties and Metadata

### ✅ CORRECT: Get and Set Properties

```csharp
using Azure.Storage.Blobs.Models;

BlobProperties properties = await blobClient.GetPropertiesAsync();
Console.WriteLine($"Size: {properties.ContentLength}, Content-Type: {properties.ContentType}");

await blobClient.SetMetadataAsync(new Dictionary<string, string>
{
    ["processed"] = "true",
    ["version"] = "2.0"
});

await blobClient.SetHttpHeadersAsync(new BlobHttpHeaders
{
    ContentType = "application/octet-stream",
    CacheControl = "max-age=86400"
});
```

---

## 9. Blob Leasing

### ✅ CORRECT: Acquire and Release Lease

```csharp
using Azure.Storage.Blobs.Models;
using Azure.Storage.Blobs.Specialized;

BlobLeaseClient leaseClient = blobClient.GetBlobLeaseClient();

BlobLease lease = await leaseClient.AcquireAsync(TimeSpan.FromSeconds(60));
try
{
    await blobClient.UploadAsync(BinaryData.FromString("Updated content"), overwrite: true);
}
finally
{
    await leaseClient.ReleaseAsync();
}
```

---

## 10. Copy Operations

### ✅ CORRECT: Copy from URI

```csharp
using Azure.Storage.Blobs.Models;

// Async copy (large blobs or cross-account)
CopyFromUriOperation operation = await destBlobClient.StartCopyFromUriAsync(sourceBlobUri);
await operation.WaitForCompletionAsync();

// Synchronous copy from URL (same account, smaller blobs)
await destBlobClient.SyncCopyFromUriAsync(sourceBlobUri);
```

---

## 11. Error Handling

### ✅ CORRECT: Handle RequestFailedException

```csharp
using Azure;
using Azure.Storage.Blobs.Models;

try
{
    BlobDownloadResult result = await blobClient.DownloadContentAsync();
}
catch (RequestFailedException ex)
{
    switch (ex.Status)
    {
        case 404:
            Console.Error.WriteLine($"Blob not found. ErrorCode: {ex.ErrorCode}");
            break;
        case 409:
            Console.Error.WriteLine($"Conflict. ErrorCode: {ex.ErrorCode}");
            break;
        case 403:
            Console.Error.WriteLine($"Access denied. ErrorCode: {ex.ErrorCode}");
            break;
        default:
            Console.Error.WriteLine($"Error {ex.Status}: {ex.Message}");
            break;
    }
}
```

### ❌ INCORRECT: Generic Exception Handling

```csharp
// WRONG - loses status code and error detail
try
{
    await blobClient.UploadAsync(data, overwrite: true);
}
catch (Exception ex)
{
    Console.WriteLine($"Error: {ex.Message}");
}
```

---

## 12. Streaming Uploads

### ✅ CORRECT: OpenWriteAsync for Streaming

```csharp
await using Stream writeStream = await blobClient.OpenWriteAsync(overwrite: true);
await writeStream.WriteAsync(Encoding.UTF8.GetBytes("Streaming data..."));
```
