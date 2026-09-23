# Storage Lifecycle Guidance

Use this reference only after Azure Advisor or observed access evidence
indicates that tiering may reduce cost. Verify retention requirements,
redundancy requirements, retrieval latency, and live prices before recommending
a policy.

## Access tiers

Compare Hot, Cool, Cold, and Archive against the workload's observed access
frequency and retrieval requirements. Do not derive a tier recommendation from
a generic age threshold.

Include minimum-retention, retrieval, early-deletion, and rehydration costs.
Do not recommend Archive for data with unpredictable or urgent retrieval.

## Policy example

```json
{
  "rules": [
    {
      "name": "example-tier-inactive-base-blobs",
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "baseBlob": {
            "tierToCool": { "daysAfterLastAccessTimeGreaterThan": 30 },
            "tierToArchive": { "daysAfterLastAccessTimeGreaterThan": 180 }
          }
        },
        "filters": { "blobTypes": ["blockBlob"] }
      }
    },
    {
      "name": "delete-expired-copies",
      "type": "Lifecycle",
      "definition": {
        "actions": {
          "snapshot": { "delete": { "daysAfterCreationGreaterThan": 90 } },
          "version": { "delete": { "daysAfterCreationGreaterThan": 90 } }
        },
        "filters": { "blobTypes": ["blockBlob"] }
      }
    }
  ]
}
```

The day values are placeholders, not recommendations. Derive them from observed
access evidence and the user's retention requirements.
`daysAfterLastAccessTimeGreaterThan` requires last-access tracking; verify it
through ARM MCP or the Storage Resource Provider API fallback. If that evidence
is unavailable, leave the recommendation unresolved.
