---
name: azure-monitor-ingestion-java
description: |
  Azure Monitor Ingestion SDK for Java. Send custom logs to Azure Monitor via Data Collection Rules (DCR) and Data Collection Endpoints (DCE).
  Triggers: "LogsIngestionClient java", "azure monitor ingestion java", "custom logs java", "DCR java", "data collection rule java".
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
  package: com.azure:azure-monitor-ingestion
---

# Azure Monitor Ingestion SDK for Java

Client library for sending custom logs to Azure Monitor using the Logs Ingestion API via Data Collection Rules.

## Installation

```xml
<dependency>
    <groupId>com.azure</groupId>
    <artifactId>azure-monitor-ingestion</artifactId>
    <version>1.2.11</version>
</dependency>
```

Or use Azure SDK BOM:

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.azure</groupId>
            <artifactId>azure-sdk-bom</artifactId>
            <version>{bom_version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<dependencies>
    <dependency>
        <groupId>com.azure</groupId>
        <artifactId>azure-monitor-ingestion</artifactId>
    </dependency>
</dependencies>
```

## Prerequisites

- Data Collection Endpoint (DCE)
- Data Collection Rule (DCR)
- Log Analytics workspace
- Target table (custom or built-in: CommonSecurityLog, SecurityEvents, Syslog, WindowsEvents)

## Environment Variables

```bash
DATA_COLLECTION_ENDPOINT=https://<dce-name>.<region>.ingest.monitor.azure.com  # Required for all auth methods
DATA_COLLECTION_RULE_ID=dcr-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Required for log upload routing
STREAM_NAME=Custom-MyTable_CL  # Required for the target DCR stream
AZURE_TOKEN_CREDENTIALS=prod  # Required only if DefaultAzureCredential is used in production
```

## Client Creation

### Synchronous Client

```java
import com.azure.core.credential.TokenCredential;
import com.azure.identity.AzureIdentityEnvVars;
import com.azure.identity.DefaultAzureCredentialBuilder;
import com.azure.identity.ManagedIdentityCredentialBuilder;
import com.azure.monitor.ingestion.LogsIngestionClient;
import com.azure.monitor.ingestion.LogsIngestionClientBuilder;

// Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
TokenCredential credential = new DefaultAzureCredentialBuilder()
    .requireEnvVars(AzureIdentityEnvVars.AZURE_TOKEN_CREDENTIALS)
    .build();
// Or use a specific credential directly in production:
// See https://learn.microsoft.com/java/api/overview/azure/identity-readme?view=azure-java-stable#credential-classes
// TokenCredential credential = new ManagedIdentityCredentialBuilder().build();

LogsIngestionClient client = new LogsIngestionClientBuilder()
    .endpoint("<data-collection-endpoint>")
    .credential(credential)
    .buildClient();
```

### Asynchronous Client

```java
import com.azure.monitor.ingestion.LogsIngestionAsyncClient;

LogsIngestionAsyncClient asyncClient = new LogsIngestionClientBuilder()
    .endpoint("<data-collection-endpoint>")
    .credential(credential)
    .buildAsyncClient();
```

## Key Concepts

| Concept | Description |
|---------|-------------|
| Data Collection Endpoint (DCE) | Ingestion endpoint URL for your region |
| Data Collection Rule (DCR) | Defines data transformation and routing to tables |
| Stream Name | Target stream in the DCR (e.g., `Custom-MyTable_CL`) |
| Log Analytics Workspace | Destination for ingested logs |

## Core Operations

### Upload Custom Logs

```java
import java.util.List;
import java.util.ArrayList;

List<Object> logs = new ArrayList<>();
logs.add(new MyLogEntry("2024-01-15T10:30:00Z", "INFO", "Application started"));
logs.add(new MyLogEntry("2024-01-15T10:30:05Z", "DEBUG", "Processing request"));

client.upload("<data-collection-rule-id>", "<stream-name>", logs);
System.out.println("Logs uploaded successfully");
```

### Upload with Concurrency

For large log collections, enable concurrent uploads:

```java
import com.azure.monitor.ingestion.models.LogsUploadOptions;
import com.azure.core.util.Context;

List<Object> logs = getLargeLogs(); // Large collection

LogsUploadOptions options = new LogsUploadOptions()
    .setMaxConcurrency(3);

client.upload("<data-collection-rule-id>", "<stream-name>", logs, options, Context.NONE);
```

### Upload with Error Handling

Handle partial upload failures gracefully:

```java
LogsUploadOptions options = new LogsUploadOptions()
    .setLogsUploadErrorConsumer(uploadError -> {
        System.err.println("Upload error: " + uploadError.getResponseException().getMessage());
        System.err.println("Failed logs count: " + uploadError.getFailedLogs().size());
        
        // Option 1: Log and continue
        // Option 2: Throw to abort remaining uploads
        // throw uploadError.getResponseException();
    });

client.upload("<data-collection-rule-id>", "<stream-name>", logs, options, Context.NONE);
```

### Async Upload with Reactor

```java
import reactor.core.publisher.Mono;

List<Object> logs = getLogs();

asyncClient.upload("<data-collection-rule-id>", "<stream-name>", logs)
    .doOnSuccess(v -> System.out.println("Upload completed"))
    .doOnError(e -> System.err.println("Upload failed: " + e.getMessage()))
    .subscribe();
```

## Log Entry Model Example

```java
public class MyLogEntry {
    private String timeGenerated;
    private String level;
    private String message;
    
    public MyLogEntry(String timeGenerated, String level, String message) {
        this.timeGenerated = timeGenerated;
        this.level = level;
        this.message = message;
    }
    
    // Getters required for JSON serialization
    public String getTimeGenerated() { return timeGenerated; }
    public String getLevel() { return level; }
    public String getMessage() { return message; }
}
```

## Error Handling

```java
import com.azure.core.exception.HttpResponseException;

try {
    client.upload(ruleId, streamName, logs);
} catch (HttpResponseException e) {
    System.err.println("HTTP Status: " + e.getResponse().getStatusCode());
    System.err.println("Error: " + e.getMessage());
    
    if (e.getResponse().getStatusCode() == 403) {
        System.err.println("Check DCR permissions and managed identity");
    } else if (e.getResponse().getStatusCode() == 404) {
        System.err.println("Verify DCE endpoint and DCR ID");
    }
}
```

## Best Practices

1. **Batch logs** — Upload in batches rather than one at a time
2. **Use concurrency** — Set `maxConcurrency` for large uploads
3. **Handle partial failures** — Use error consumer to log failed entries
4. **Match DCR schema** — Log entry fields must match DCR transformation expectations
5. **Include TimeGenerated** — Most tables require a timestamp field
6. **Reuse client** — Create once, reuse throughout application
7. **Use async for high throughput** — `LogsIngestionAsyncClient` for reactive patterns

## Querying Uploaded Logs

Use [azure-monitor-query](../azure-monitor-query-java/SKILL.md) to query ingested logs:

```java
// See azure-monitor-query skill for LogsQueryClient usage
String query = "MyTable_CL | where TimeGenerated > ago(1h) | limit 10";
```

## Reference Links

| Resource | URL |
|----------|-----|
| Maven Package | https://central.sonatype.com/artifact/com.azure/azure-monitor-ingestion |
| GitHub | https://github.com/Azure/azure-sdk-for-java/tree/main/sdk/monitor/azure-monitor-ingestion |
| Product Docs | https://learn.microsoft.com/azure/azure-monitor/logs/logs-ingestion-api-overview |
| DCE Overview | https://learn.microsoft.com/azure/azure-monitor/essentials/data-collection-endpoint-overview |
| DCR Overview | https://learn.microsoft.com/azure/azure-monitor/essentials/data-collection-rule-overview |
| Troubleshooting | https://github.com/Azure/azure-sdk-for-java/blob/main/sdk/monitor/azure-monitor-ingestion/TROUBLESHOOTING.md |
