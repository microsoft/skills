# Tracing Insights API

Automatically detect quality regressions and anomalies in agent traces using changepoint detection on evaluation scores stored in App Insights.

## When to Use

Use this instead of manual KQL queries when you want **automated anomaly detection** across evaluation dimensions (task adherence, intent resolution, fluency, latency, token usage). The API finds statistical changepoints in score distributions — no manual threshold tuning needed.

**Prerequisites:**
- App Insights connected to the Foundry project (with `gen_ai.evaluation.result` custom events)
- Evaluation data from portal playground sessions or batch evals (raw traces alone are not enough)

## Endpoint

```
POST https://{region}.api.azureml.ms/notification/v1-beta2/subscriptions/{sub}/resourceGroups/{rg}/providers/microsoft.insights/components/{component}/:insights
```

The API is region-agnostic — any regional endpoint can serve requests for any project. For lowest latency, use the same region as the Foundry project (e.g., `eastus2`, `westus2`, `westcentralus`). If the project region is unknown, use `eastus2` as the default.

**Query parameters:**
| Parameter          | Required | Description                                                            |
|--------------------|----------|------------------------------------------------------------------------|
| `startDateTimeUtc` | Yes      | ISO 8601 start of analysis window                                      |
| `endDateTimeUtc`   | Yes      | ISO 8601 end of analysis window                                        |
| `agent`            | Yes      | Agent name (URL-encoded)                                               |
| `projectId`        | Yes      | ARM resource ID of the Foundry project (URL-encoded — contains slashes)|
| `top`              | No       | Max insights to return (default 50)                                    |

**Auth:** `az account get-access-token --resource https://ai.azure.com`

**Body:** Must send `{}` (empty JSON object) — POST with no body returns 400.

## Example

```powershell
$token = az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv
$encodedAgent = [uri]::EscapeDataString("my-agent")
$encodedProjectId = [uri]::EscapeDataString("/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{account}/projects/{project}")

$uri = "https://{region}.api.azureml.ms/notification/v1-beta2/subscriptions/{sub}/resourceGroups/{rg}/providers/microsoft.insights/components/{component}/:insights?startDateTimeUtc=2025-01-01T00:00:00Z&endDateTimeUtc=2025-01-18T00:00:00Z&agent=$encodedAgent&projectId=$encodedProjectId&top=50"

$response = Invoke-RestMethod -Uri $uri -Method POST -Headers @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
} -Body "{}"
```

## Response Structure (v1-beta2)

Response is grouped by agent version. Each insight includes `relatedSpans` with `operationId` (App Insights trace ID) for querying full trace content.

```json
{
  "agents": [{
    "agent": "my-agent:1",
    "insights": [{
      "id": "anomaly-token-shift-<hash>",
      "type": "Token",
      "severity": "Critical",
      "message": "Token usage increased by 137%",
      "agentVersion": "1",
      "metadata": { "meanBefore": 2041, "meanAfter": 4831, "confidence": 0.91 },
      "relatedSpans": {
        "totalCount": 13,
        "spans": [
          { "responseId": "resp_...", "operationId": "<trace-id>", "evaluationRunId": null }
        ]
      }
    }],
    "insightCount": 3
  }],
  "totalCount": 3, "criticalCount": 1, "warningCount": 1, "improvementCount": 1
}
```

## Querying Traces from relatedSpans

Use `operationId` from `relatedSpans` to fetch full trace content from App Insights:

```kql
dependencies
| where operation_Id == "<operationId>"
| where customDimensions has "invoke_agent"
| project input = customDimensions["gen_ai.input.messages"],
          output = customDimensions["gen_ai.output.messages"],
          tokens = toint(customDimensions["gen_ai.usage.output_tokens"])
```

This returns the user query and agent response for the specific trace flagged by the insight.

## How Changepoint Detection Works

The API finds **statistical inflection points within the queried time window**. `meanBefore`/`meanAfter` represent averages on either side of the detected shift — not comparisons to a historical baseline.

- 10+ data points give better signal for changepoint detection
- `confidence` close to 1.0 = statistically significant shift

## Next Steps

After receiving insights with `Warning` or `Critical` severity:
1. Use `relatedSpans.operationId` values to query full trace content from App Insights (see KQL above)
2. Present the insights summary to the user with severity, type, evaluator name, and shift magnitude
3. Offer to drill into specific traces for detailed analysis using the [trace analysis skill](../trace.md)
