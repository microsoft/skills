---
name: purview-developer
description: "Build on the Microsoft Purview Developer Platform — integrate data protection, DLP policy enforcement, sensitivity labels, and compliance logging into apps and agents. Use when adding Purview to an application or agent, calling Purview APIs, applying sensitivity labels in code, integrating DLP into an agent, or wiring Purview into Microsoft Agent Framework. Covers the Purview SDK, Microsoft Graph Purview resources, and Agent Framework Purview middleware. Also explains how Agent 365 telemetry flows into Purview for audit and compliance. Trigger on: Purview, Purview SDK, Purview API, sensitivity label, sensitivityLabel, contentActivity, DLP policy, data loss prevention, protection scope, processContent, dataSecurityAndGovernance, tenantDataSecurityAndGovernance, userDataSecurityAndGovernance, Microsoft Graph sensitivity label, contentActivity API, Purview with Agent Framework, Microsoft.Agents.AI.Purview, agent-framework-purview, PurviewPolicyMiddleware, collection policy."
---

# Microsoft Purview Developer Platform

Build apps and agents that integrate Microsoft Purview data protection, DLP policy enforcement, sensitivity labels, and compliance logging. There are two primary integration surfaces — direct Microsoft Graph API calls for LOB apps, and Agent Framework Purview middleware for agents — plus Agent 365 telemetry that flows into Purview for compliance.

## Which Purview Surface Do I Call?

The most common confusion: should I use Microsoft Graph directly or the Agent Framework middleware? Use this decision table:

| I want to… | Surface | Package / Endpoint |
|---|---|---|
| **Add DLP + compliance to an Agent Framework agent** | Agent Framework Purview middleware | `Microsoft.Agents.AI.Purview` (NuGet) / `agent-framework-purview` (PyPI) |
| **Enforce DLP policies on user content in my LOB app** | Microsoft Graph APIs (directly) | `POST /users/{id}/dataSecurityAndGovernance/processContent` |
| **Log user activity for Purview compliance** | Microsoft Graph APIs (directly) | `POST /users/{id}/dataSecurityAndGovernance/activities/contentActivities` |
| **Read sensitivity labels for a tenant** | Microsoft Graph APIs (directly) | `GET /security/dataSecurityAndGovernance/sensitivityLabels` |
| **Determine which policies apply to a user** | Microsoft Graph APIs (directly) | `POST /users/{id}/dataSecurityAndGovernance/protectionScopes/compute` |
| **Process content at the tenant level (batch/async)** | Microsoft Graph APIs (directly) | `POST /security/dataSecurityAndGovernance/processContentAsync` |

> **Key rule**: The term "Purview SDK" refers to using the Microsoft Graph SDK clients (e.g., `Microsoft.Graph` for .NET, `msgraph-sdk-python` for Python) to call the Purview data security and governance APIs. The **Agent Framework Purview middleware** wraps these Graph calls for inline DLP enforcement. Do not duplicate the same calls across layers.
>
> **Agent 365 and Purview**: If you are building an Agent 365 agent, its Observability SDK sends telemetry that flows into Microsoft Purview and Microsoft Defender for audit and compliance. However, the A365 SDK itself is not a Purview integration — it is an enterprise agent platform. See the [Agent 365 developer documentation](https://learn.microsoft.com/en-us/microsoft-agent-365/developer/) for full A365 guidance. You can combine Agent Framework Purview middleware (for inline DLP) with A365 Observability (for telemetry) in the same agent.

---

## Prerequisites

- Microsoft Entra ID app registration with the required Microsoft Graph permissions (see Permissions section below)
- Microsoft 365 E5 license (or equivalent) with Microsoft Purview configured and pay-as-you-go billing
- Collection policies and/or DLP policies configured by a compliance administrator

## Permissions

| Scenario | Permission (least privileged) | Type |
|---|---|---|
| Compute protection scopes (delegated) | `ProtectionScopes.Compute.User` | Delegated |
| Compute protection scopes (app) | `ProtectionScopes.Compute.User` | Application |
| Process content (delegated) | `Content.Process.User` | Delegated |
| Process content (app) | `Content.Process.User` | Application |
| Log content activity | `ContentActivity.Write` | Delegated or Application |
| Read sensitivity labels | `SensitivityLabel.Read` | Delegated or Application |
| Read all sensitivity labels (app) | `SensitivityLabels.Read.All` | Application |

> **Note**: `.All` variants (e.g., `ProtectionScopes.Compute.All`, `Content.Process.All`) are higher-privilege permissions. Use `.User` as least-privileged first; only upgrade to `.All` if your app requires broader access.

---

## API Flow Overview

The typical Purview integration follows three steps:

```
1. Compute protection scopes  →  Cache the response + ETag
2. Evaluate execution mode    →  evaluateInline (wait) or evaluateOffline (don't wait)
3. Process content / Log activity  →  Call processContent and/or create contentActivity
```

> **REST vs SDK naming**: The REST API wraps the request body in `contentToProcess`, while the generated Graph SDK models use `ContentToProcess` (C#) or `content_to_process` (Python) as a property of the typed request body object (e.g., `ProcessContentPostRequestBody`). Do not mix REST field names with SDK method calls.

---

## Scenario 1: Reading Sensitivity Labels

List sensitivity labels available in the tenant and filter by content format or label ID.

### HTTP

```http
GET https://graph.microsoft.com/v1.0/security/dataSecurityAndGovernance/sensitivityLabels
    ?$filter=applicableTo has 'file' and id in ('4e4234dd-377b-42a3-935b-0e42f138fa23')
Authorization: Bearer {token}
```

### C#

```csharp
using Microsoft.Graph;
using Azure.Identity;

var credential = new DefaultAzureCredential();
var scopes = new[] { "https://graph.microsoft.com/.default" };
var graphClient = new GraphServiceClient(credential, scopes);

// List tenant sensitivity labels
var labels = await graphClient.Security.DataSecurityAndGovernance.SensitivityLabels
    .GetAsync(config =>
    {
        config.QueryParameters.Filter = "applicableTo has 'file'";
    });

foreach (var label in labels.Value)
{
    Console.WriteLine($"{label.Id}: {label.DisplayName} (priority={label.Priority})");
}
```

### Python

```python
import asyncio
from azure.identity import DefaultAzureCredential
from msgraph import GraphServiceClient
from msgraph.generated.security.data_security_and_governance.sensitivity_labels.sensitivity_labels_request_builder import SensitivityLabelsRequestBuilder

async def main():
    credential = DefaultAzureCredential()
    scopes = ["https://graph.microsoft.com/.default"]
    client = GraphServiceClient(credentials=credential, scopes=scopes)

    # List tenant sensitivity labels
    query_params = SensitivityLabelsRequestBuilder.SensitivityLabelsRequestBuilderGetQueryParameters(
        filter="applicableTo has 'file'"
    )
    config = SensitivityLabelsRequestBuilder.SensitivityLabelsRequestBuilderGetRequestConfiguration(
        query_parameters=query_params
    )
    labels = await client.security.data_security_and_governance.sensitivity_labels.get(
        request_configuration=config
    )

    for label in labels.value:
        print(f"{label.id}: {label.display_name} (priority={label.priority})")

asyncio.run(main())
```

### Sensitivity Label Properties

| Property | Type | Description |
|---|---|---|
| `id` | String | Globally unique label GUID |
| `displayName` | String | Display name |
| `name` | String | Plaintext name |
| `priority` | Int32 | Lower = higher priority |
| `applicableTo` | String | `email`, `site`, `unifiedGroup`, `teamwork`, `file`, `schematizedData` |
| `hasProtection` | Boolean | Whether the label has protection actions configured |
| `isEnabled` | Boolean | Whether the label is currently active |
| `isScopedToUser` | Boolean | Scoped to specific users/groups (`true`) or tenant-wide (`false`) |
| `applicationMode` | String | `manual`, `automatic`, or `recommended` |

---

## Scenario 2: Logging a contentActivity Event

Log user activity (such as text uploads, file downloads) into Microsoft Purview for compliance features like Audit, eDiscovery, Insider Risk Management, and Data Lifecycle Management.

### HTTP

```http
POST https://graph.microsoft.com/v1.0/me/dataSecurityAndGovernance/activities/contentActivities
Content-Type: application/json

{
    "contentToProcess": {
       "contentEntries": [
          {
             "@odata.type": "microsoft.graph.processConversationMetadata",
             "identifier": "07785517-9081-4fe7-a9dc-85bcdf5e9075",
             "name": "User chat message",
             "correlationId": "d63eafd2-e3a9-4c1a-b726-a2e9b9d9580d",
             "sequenceNumber": 0,
             "isTruncated": false,
             "createdDateTime": "2025-05-27T17:23:20",
             "modifiedDateTime": "2025-05-27T17:23:20"
          }
       ],
       "activityMetadata": {
          "activity": "uploadText"
       },
       "deviceMetadata": {
          "operatingSystemSpecifications": {
             "operatingSystemPlatform": "Windows 11",
             "operatingSystemVersion": "10.0.26100.0"
          },
          "ipAddress": "127.0.0.1"
       },
       "protectedAppMetadata": {
          "name": "My Enterprise App",
          "version": "1.0",
          "applicationLocation": {
             "@odata.type": "microsoft.graph.policyLocationApplication",
             "value": "83ef208a-0396-4893-9d4f-d36efbffc8bd"
          }
       },
       "integratedAppMetadata": {
          "name": "My Enterprise App",
          "version": "1.0"
       }
    }
}
```

### C#

```csharp
using Microsoft.Graph;
using Microsoft.Graph.Models;

// Initialize graphClient with scopes (see Scenario 1)

var contentActivity = new ContentActivity
{
    ContentMetadata = new ProcessContentRequest
    {
        ContentEntries = new List<ProcessContentMetadataBase>
        {
            new ProcessConversationMetadata
            {
                Identifier = Guid.NewGuid().ToString(),
                Name = "User chat message",
                CorrelationId = Guid.NewGuid().ToString(),
                SequenceNumber = 0,
                IsTruncated = false,
                CreatedDateTime = DateTimeOffset.UtcNow,
                ModifiedDateTime = DateTimeOffset.UtcNow
            }
        },
        ActivityMetadata = new ActivityMetadata { Activity = "uploadText" },
        IntegratedAppMetadata = new IntegratedApplicationMetadata
        {
            Name = "My Enterprise App",
            Version = "1.0"
        }
    }
};

await graphClient.Me.DataSecurityAndGovernance.Activities.ContentActivities
    .PostAsync(contentActivity);
```

### Python

```python
import asyncio
from uuid import uuid4
from azure.identity import DefaultAzureCredential
from msgraph import GraphServiceClient
from msgraph.generated.models.content_activity import ContentActivity
from msgraph.generated.models.process_content_request import ProcessContentRequest
from msgraph.generated.models.process_conversation_metadata import ProcessConversationMetadata
from msgraph.generated.models.activity_metadata import ActivityMetadata
from msgraph.generated.models.integrated_application_metadata import IntegratedApplicationMetadata

async def main():
    credential = DefaultAzureCredential()
    scopes = ["https://graph.microsoft.com/.default"]
    client = GraphServiceClient(credentials=credential, scopes=scopes)

    content_activity = ContentActivity(
        content_metadata=ProcessContentRequest(
            content_entries=[
                ProcessConversationMetadata(
                    identifier=str(uuid4()),
                    name="User chat message",
                    correlation_id=str(uuid4()),
                    sequence_number=0,
                    is_truncated=False,
                )
            ],
            activity_metadata=ActivityMetadata(activity="uploadText"),
            integrated_app_metadata=IntegratedApplicationMetadata(
                name="My Enterprise App",
                version="1.0"
            ),
        )
    )

    await client.me.data_security_and_governance.activities.content_activities.post(
        content_activity
    )

asyncio.run(main())
```

> **Note**: The `/me` endpoint requires a signed-in user (delegated permission). For application-permission scenarios, use `/users/{userId}/dataSecurityAndGovernance/activities/contentActivities`.

---

## Scenario 3: Apply Data Governance and Protection to Your 3P Agent

Before processing user content, call `protectionScopes/compute` to determine which policies apply. Cache the response and use the `ETag` header to detect policy changes.

### User-Scoped Protection Scopes

```http
POST https://graph.microsoft.com/v1.0/users/{userId}/dataSecurityAndGovernance/protectionScopes/compute
Content-Type: application/json

{
   "activities": "uploadText,downloadText",
   "locations": [
      {
         "@odata.type": "microsoft.graph.policyLocationApplication",
         "value": "83ef208a-0396-4893-9d4f-d36efbffc8bd"
      }
   ]
}
```

### Tenant-Scoped Protection Scopes

```http
POST https://graph.microsoft.com/v1.0/security/dataSecurityAndGovernance/protectionScopes/compute
Content-Type: application/json

{
    "activities": "uploadText,downloadText,uploadFile,downloadFile"
}
```

### Processing Content Against Policies

Once you know the execution mode from `protectionScopes/compute`, call `processContent`:

```http
POST https://graph.microsoft.com/v1.0/me/dataSecurityAndGovernance/processContent
Content-Type: application/json

{
    "contentToProcess": {
       "contentEntries": [
          {
             "@odata.type": "microsoft.graph.processConversationMetadata",
             "identifier": "07785517-9081-4fe7-a9dc-85bcdf5e9075",
             "content": {
                "@odata.type": "microsoft.graph.textContent",
                "data": "Sensitive data to evaluate"
             },
             "name": "User prompt",
             "correlationId": "d63eafd2-e3a9-4c1a-b726-a2e9b9d9580d",
             "sequenceNumber": 0,
             "isTruncated": false,
             "createdDateTime": "2025-05-27T17:23:20",
             "modifiedDateTime": "2025-05-27T17:23:20"
          }
       ],
       "activityMetadata": {
          "activity": "uploadText"
       },
       "deviceMetadata": {
          "deviceType": "Unmanaged",
          "operatingSystemSpecifications": {
             "operatingSystemPlatform": "Windows 11",
             "operatingSystemVersion": "10.0.26100.0"
          },
          "ipAddress": "127.0.0.1"
       },
       "protectedAppMetadata": {
          "name": "My Enterprise App",
          "version": "1.0",
          "applicationLocation": {
             "@odata.type": "microsoft.graph.policyLocationApplication",
             "value": "83ef208a-0396-4893-9d4f-d36efbffc8bd"
          }
       },
       "integratedAppMetadata": {
          "name": "My Enterprise App",
          "version": "1.0"
       }
    }
}
```

### Execution Mode Behavior

| Mode | App Behavior | When to Call `processContent` |
|---|---|---|
| `evaluateInline` | **Wait** for the API verdict before allowing the user action | Before the action proceeds |
| `evaluateOffline` | Take action immediately (e.g., restrict access); call `processContent` independently | Asynchronously, without blocking the user |

### C#

```csharp
using Microsoft.Graph;
using Microsoft.Graph.Models;

// Initialize graphClient with scopes (see Scenario 1)
// Note: SDK request body type names are auto-generated and may vary by SDK version.
// Check the generated namespace for your installed Microsoft.Graph package version.

// Step 1: Compute protection scopes
var scopeRequest = new Microsoft.Graph.Users.Item.DataSecurityAndGovernance.ProtectionScopes.Compute.ComputePostRequestBody
{
    Activities = "uploadText,downloadText",
    Locations = new List<PolicyLocation>
    {
        new PolicyLocationApplication
        {
            Value = "83ef208a-0396-4893-9d4f-d36efbffc8bd"
        }
    }
};

var scopes = await graphClient.Users[userId].DataSecurityAndGovernance
    .ProtectionScopes.Compute.PostAsync(scopeRequest);

// Step 2: Check execution mode and process content
foreach (var scope in scopes.Value)
{
    if (scope.ExecutionMode == "evaluateInline")
    {
        // Must wait for processContent verdict before allowing user action
        var processRequestBody = new Microsoft.Graph.Users.Item.DataSecurityAndGovernance.ProcessContent.ProcessContentPostRequestBody
        {
            ContentToProcess = new ProcessContentRequest
            {
                ContentEntries = new List<ProcessContentMetadataBase>
                {
                    new ProcessConversationMetadata
                    {
                        Identifier = Guid.NewGuid().ToString(),
                        Content = new TextContent { Data = userInput },
                        Name = "User prompt",
                        CorrelationId = Guid.NewGuid().ToString(),
                        SequenceNumber = 0
                    }
                },
                ActivityMetadata = new ActivityMetadata { Activity = "uploadText" },
                IntegratedAppMetadata = new IntegratedApplicationMetadata
                {
                    Name = "My Enterprise App",
                    Version = "1.0"
                },
                DeviceMetadata = new DeviceMetadata
                {
                    OperatingSystemSpecifications = new OperatingSystemSpecifications
                    {
                        OperatingSystemPlatform = "Windows 11",
                        OperatingSystemVersion = "10.0.26100.0"
                    }
                }
            }
        };

        var result = await graphClient.Users[userId].DataSecurityAndGovernance
            .ProcessContent.PostAsync(processRequestBody);

        // Check for DLP actions
        foreach (var action in result.PolicyActions)
        {
            if (action is RestrictAccessAction restrictAction)
            {
                // Block the user action
                Console.WriteLine($"Action blocked: {restrictAction.RestrictionAction}");
            }
        }
    }
}
```

### Python

```python
import asyncio
from uuid import uuid4
from azure.identity import DefaultAzureCredential
from msgraph import GraphServiceClient
from msgraph.generated.models.policy_location_application import PolicyLocationApplication
from msgraph.generated.models.process_conversation_metadata import ProcessConversationMetadata
from msgraph.generated.models.text_content import TextContent
from msgraph.generated.models.activity_metadata import ActivityMetadata
from msgraph.generated.models.integrated_application_metadata import IntegratedApplicationMetadata
from msgraph.generated.models.device_metadata import DeviceMetadata
from msgraph.generated.models.operating_system_specifications import OperatingSystemSpecifications
from msgraph.generated.models.process_content_request import ProcessContentRequest

async def main():
    credential = DefaultAzureCredential()
    scopes = ["https://graph.microsoft.com/.default"]
    client = GraphServiceClient(credentials=credential, scopes=scopes)
    user_id = "<user-object-id>"

    # Step 1: Compute protection scopes
    # Note: SDK request body type names are auto-generated and may vary by SDK version.
    from msgraph.generated.users.item.data_security_and_governance.protection_scopes.compute.compute_post_request_body import ComputePostRequestBody

    scope_request = ComputePostRequestBody(
        activities="uploadText,downloadText",
        locations=[
            PolicyLocationApplication(
                odata_type="microsoft.graph.policyLocationApplication",
                value="83ef208a-0396-4893-9d4f-d36efbffc8bd"
            )
        ]
    )
    scopes_result = await client.users.by_user_id(user_id).data_security_and_governance \
        .protection_scopes.compute.post(scope_request)

    # Step 2: Process content for inline evaluation
    for scope in scopes_result.value:
        if scope.execution_mode == "evaluateInline":
            user_input = "Content to evaluate for DLP policies"

            from msgraph.generated.users.item.data_security_and_governance.process_content.process_content_post_request_body import ProcessContentPostRequestBody

            process_request = ProcessContentPostRequestBody(
                content_to_process=ProcessContentRequest(
                    content_entries=[
                        ProcessConversationMetadata(
                            odata_type="microsoft.graph.processConversationMetadata",
                            identifier=str(uuid4()),
                            content=TextContent(
                                odata_type="microsoft.graph.textContent",
                                data=user_input
                            ),
                            name="User prompt",
                            correlation_id=str(uuid4()),
                            sequence_number=0
                        )
                    ],
                    activity_metadata=ActivityMetadata(activity="uploadText"),
                    integrated_app_metadata=IntegratedApplicationMetadata(
                        name="My Enterprise App",
                        version="1.0"
                    ),
                    device_metadata=DeviceMetadata(
                        operating_system_specifications=OperatingSystemSpecifications(
                            operating_system_platform="Windows 11",
                            operating_system_version="10.0.26100.0"
                        )
                    )
                )
            )
            result = await client.users.by_user_id(user_id) \
                .data_security_and_governance.process_content.post(process_request)

            for action in result.policy_actions:
                if action.odata_type == "#microsoft.graph.restrictAccessAction":
                    print(f"Blocked: {action.restriction_action}")

asyncio.run(main())
```

---

## Scenario 4: Wiring Purview into an Agent Framework Agent

The Agent Framework Purview middleware intercepts prompts and responses to enforce DLP policies and log activity to Purview — so you don't need to call the Graph APIs manually.

### C# — Microsoft.Agents.AI.Purview

Install: `dotnet add package Microsoft.Agents.AI.Purview`

```csharp
using Azure.AI.Projects;
using Azure.Core;
using Azure.Identity;
using Microsoft.Agents.AI;
using Microsoft.Agents.AI.Purview;

string endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT")
    ?? throw new InvalidOperationException("AZURE_OPENAI_ENDPOINT is not set.");
string deploymentName = Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT_NAME")
    ?? "gpt-4o-mini";
string purviewClientAppId = Environment.GetEnvironmentVariable("PURVIEW_CLIENT_APP_ID")
    ?? throw new InvalidOperationException("PURVIEW_CLIENT_APP_ID is not set.");

TokenCredential browserCredential = new InteractiveBrowserCredential(
    new InteractiveBrowserCredentialOptions
    {
        ClientId = purviewClientAppId
    });

AIAgent agent = new AIProjectClient(
    new Uri(endpoint),
    new DefaultAzureCredential())
    .AsAIAgent(
        model: deploymentName,
        instructions: "You are a secure assistant.")
    .AsBuilder()
    .WithPurview(browserCredential, new PurviewSettings("My Secure Agent"))
    .Build();

AgentResponse response = await agent.RunAsync("Summarize zero trust in one sentence.")
    .ConfigureAwait(false);
Console.WriteLine(response);
```

### Python — agent-framework-purview

Install: `pip install agent-framework-purview`

```python
import asyncio
import os
from agent_framework import Agent, Message, Role
from agent_framework.openai import OpenAIChatCompletionClient
from agent_framework.microsoft import PurviewPolicyMiddleware, PurviewSettings
from azure.identity import AzureCliCredential, InteractiveBrowserCredential

os.environ.setdefault("AZURE_OPENAI_ENDPOINT", "<azureOpenAIEndpoint>")
os.environ.setdefault("AZURE_OPENAI_CHAT_COMPLETION_MODEL", "<azureOpenAIChatDeploymentName>")

async def main():
    chat_client = OpenAIChatCompletionClient(
        model=os.environ["AZURE_OPENAI_CHAT_COMPLETION_MODEL"],
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
        credential=AzureCliCredential(),
    )
    purview_middleware = PurviewPolicyMiddleware(
        credential=InteractiveBrowserCredential(
            client_id="<clientId>",
        ),
        settings=PurviewSettings(app_name="My Secure Agent")
    )
    agent = Agent(
        client=chat_client,
        instructions="You are a secure assistant.",
        middleware=[purview_middleware]
    )
    response = await agent.run(
        Message(role='user', contents=["Summarize zero trust in one sentence."])
    )
    print(response)

if __name__ == "__main__":
    asyncio.run(main())
```

### PurviewSettings Configuration (.NET)

| Property | Type | Default | Description |
|---|---|---|---|
| `AppName` | String | *required* | Publicly visible name of your application |
| `AppVersion` | String | `null` | Application version string |
| `TenantId` | String | inferred from token | Override tenant ID |
| `IgnoreExceptions` | Bool | `false` | If `true`, Purview errors are logged but not thrown |
| `BlockedPromptMessage` | String | `"Prompt blocked by policies"` | Message shown when a prompt is blocked |
| `BlockedResponseMessage` | String | `"Response blocked by policies"` | Message shown when a response is blocked |
| `CacheTTL` | TimeSpan | 30 minutes | TTL for cached protection scope responses |
| `InMemoryCacheSizeLimit` | long? | 100 MB | Size limit for the default in-memory cache |

### PurviewSettings Configuration (Python)

| Property | Type | Default | Description |
|---|---|---|---|
| `app_name` | str | *required* | Publicly visible name of your application |
| `app_version` | str | `None` | Application version string |
| `tenant_id` | str | inferred from token | Override tenant ID |
| `ignore_exceptions` | bool | `False` | If `True`, Purview errors are logged but not raised |
| `graph_base_uri` | str | `https://graph.microsoft.com/v1.0/` | Base URI for Graph API |
| `cache_ttl_seconds` | int | `14400` (4 hours) | TTL for cached protection scope responses |

### What the Middleware Does Automatically

1. Calls `protectionScopes/compute` and caches the result
2. For each user message: evaluates content via `processContent` based on execution mode
3. Blocks prompts/responses that violate DLP policies
4. Logs activity to Purview via `contentActivity` for compliance

### Entra Registration for Agent Framework

Register your agent app and add these Microsoft Graph permissions to the Service Principal:

- `ProtectionScopes.Compute.All`
- `ContentActivity.Write`
- `Content.Process.All`

---

## Agent 365 and Purview

If you are building an [Agent 365](https://learn.microsoft.com/en-us/microsoft-agent-365/developer/) agent, its **Observability SDK** automatically sends telemetry (invocation traces, tool calls, inference events) that flows into **Microsoft Purview** and **Microsoft Defender** for audit, compliance, and threat detection.

- A365 Observability is **not a replacement** for the Agent Framework Purview middleware — it does not perform inline DLP enforcement.
- You can use **both together**: Agent Framework Purview middleware for real-time DLP on content, and A365 Observability for enterprise telemetry and governance.
- For full Agent 365 SDK guidance (identity, blueprints, notifications, tooling, deployment lifecycle), see the dedicated [Agent 365 developer documentation](https://learn.microsoft.com/en-us/microsoft-agent-365/developer/).

> **Note**: Agent 365 is currently in preview and requires enrollment in the [Frontier preview program](https://adoption.microsoft.com/copilot/frontier-program/).

---

## Anti-Patterns

Common mistakes agents generate — and their correct replacements.

### ❌ Wrong: Inventing API endpoints that don't exist

```http
// ❌ WRONG — there is no /purview/ segment in the Graph API path
POST https://graph.microsoft.com/v1.0/purview/sensitivityLabels

// ✅ CORRECT — sensitivity labels are under /security/dataSecurityAndGovernance/
GET https://graph.microsoft.com/v1.0/security/dataSecurityAndGovernance/sensitivityLabels
```

### ❌ Wrong: Using legacy Information Protection API for new integrations

```http
// ❌ WRONG — the /informationProtection/ path is the legacy API
GET https://graph.microsoft.com/v1.0/me/informationProtection/policy/labels

// ✅ CORRECT — use the dataSecurityAndGovernance API
GET https://graph.microsoft.com/v1.0/security/dataSecurityAndGovernance/sensitivityLabels
```

### ❌ Wrong: Calling Graph APIs directly AND using Agent Framework middleware

```csharp
// ❌ WRONG — double-counting activity: the middleware already calls processContent
var agent = builder
    .WithPurview(credential, settings)  // middleware handles everything
    .Build();

// Then also manually calling processContent — DON'T DO THIS
await graphClient.Me.DataSecurityAndGovernance.ProcessContent.PostAsync(request);
```

```csharp
// ✅ CORRECT — use middleware OR direct Graph calls, never both
// Option A: Agent Framework middleware (recommended for agents)
var agent = builder
    .WithPurview(credential, settings)
    .Build();

// Option B: Direct Graph calls (for LOB apps without Agent Framework)
await graphClient.Users[userId].DataSecurityAndGovernance.ProcessContent.PostAsync(request);
```

### ❌ Wrong: Missing required permissions in Entra app registration

```csharp
// ❌ WRONG — registering the app without Purview-specific Graph permissions
// The app uses https://graph.microsoft.com/.default at runtime (which is correct),
// but has only generic Graph permissions like User.Read in the app registration.
// Result: 403 Forbidden when calling Purview APIs.

// ✅ CORRECT — add these specific permissions to your Entra app registration:
//   ProtectionScopes.Compute.User  (least privileged) or ProtectionScopes.Compute.All
//   Content.Process.User           (least privileged) or Content.Process.All
//   ContentActivity.Write
//   SensitivityLabel.Read
// Then use https://graph.microsoft.com/.default at runtime — it picks up all granted permissions.
var scopes = new[] { "https://graph.microsoft.com/.default" };
var graphClient = new GraphServiceClient(credential, scopes);
```

### ❌ Wrong: Not caching protection scopes

```csharp
// ❌ WRONG — calling compute on every single user request
foreach (var message in userMessages)
{
    var scopes = await graphClient.Users[userId].DataSecurityAndGovernance
        .ProtectionScopes.Compute.PostAsync(request);
    // process...
}

// ✅ CORRECT — compute once, cache the ETag, pass it to processContent
// 1. Call protectionScopes/compute and cache the ETag from the response header
// 2. On each processContent call, pass the cached ETag in the If-None-Match header
// 3. Check the protectionScopeState in the processContent response:
//    - "notModified" → policies unchanged, continue using cached scopes
//    - "modified" → policies changed, re-call protectionScopes/compute to refresh
```

### ❌ Wrong: Ignoring the execution mode

```csharp
// ❌ WRONG — always blocking while waiting for processContent
var result = await graphClient.Users[userId].DataSecurityAndGovernance
    .ProcessContent.PostAsync(request);
// Always waiting... even when mode is evaluateOffline

// ✅ CORRECT — respect the execution mode from protectionScopes/compute
if (scope.ExecutionMode == "evaluateInline")
{
    // Wait for the verdict before allowing user action
    var result = await graphClient.Users[userId].DataSecurityAndGovernance
        .ProcessContent.PostAsync(request);
}
else // evaluateOffline
{
    // Take action immediately; call processContent asynchronously
    _ = Task.Run(() => graphClient.Users[userId].DataSecurityAndGovernance
        .ProcessContent.PostAsync(request));
}
```

---

## When NOT to Use This Skill

This skill is for **developers integrating Purview into code**. Do not use it for:

- **Purview admin portal tasks** — configuring policies, managing compliance settings, or viewing dashboards in the Microsoft Purview compliance portal UI
- **Purview compliance configuration** — setting up collection policies, DLP rules, or sensitivity label policies through the admin UI or PowerShell
- **Non-developer workflows** — auditing, investigation, or eDiscovery tasks performed through the Purview portal
- **Microsoft Purview Data Governance** (data catalog, data map) — this skill covers the data security and governance APIs, not the data catalog APIs

---

## Authoritative References

- Purview Developer Platform: https://learn.microsoft.com/en-us/purview/developer/
- Purview API Samples: https://github.com/microsoft/purview-api-samples
- Data Security and Governance Overview (Graph): https://learn.microsoft.com/en-us/graph/security-datasecurityandgovernance-overview
- contentActivity Resource (Graph): https://learn.microsoft.com/en-us/graph/api/resources/contentactivity?view=graph-rest-1.0
- Create contentActivity (Graph): https://learn.microsoft.com/en-us/graph/api/activitiescontainer-post-contentactivities?view=graph-rest-1.0
- sensitivityLabel Resource (Graph): https://learn.microsoft.com/en-us/graph/api/resources/security-sensitivitylabel?view=graph-rest-1.0
- List tenant sensitivityLabels (Graph): https://learn.microsoft.com/en-us/graph/api/tenantdatasecurityandgovernance-list-sensitivitylabels?view=graph-rest-1.0
- tenantDataSecurityAndGovernance Resource (Graph): https://learn.microsoft.com/en-us/graph/api/resources/tenantdatasecurityandgovernance?view=graph-rest-1.0
- userDataSecurityAndGovernance Resource (Graph): https://learn.microsoft.com/en-us/graph/api/resources/userdatasecurityandgovernance?view=graph-rest-1.0
- Compute protection scopes (Graph): https://learn.microsoft.com/en-us/graph/api/userprotectionscopecontainer-compute?view=graph-rest-1.0
- Process content (Graph): https://learn.microsoft.com/en-us/graph/api/userdatasecurityandgovernance-processcontent?view=graph-rest-1.0
- Purview + Agent Framework (Docs): https://learn.microsoft.com/en-us/agent-framework/integrations/purview?pivots=programming-language-csharp
- Microsoft.Agents.AI.Purview (GitHub): https://github.com/microsoft/agent-framework/tree/main/dotnet/src/Microsoft.Agents.AI.Purview
- Microsoft.Agents.AI.Purview (NuGet): https://www.nuget.org/packages/Microsoft.Agents.AI.Purview/
- Agent Framework Purview — Python (GitHub): https://github.com/microsoft/agent-framework/tree/main/python/packages/purview
- Agent Framework Purview — Python (PyPI): https://pypi.org/project/agent-framework-purview/
- Agent 365 Observability and Purview: https://learn.microsoft.com/en-us/microsoft-agent-365/developer/agent-365-sdk
- Agent 365 Developer Overview: https://learn.microsoft.com/en-us/microsoft-agent-365/developer/
