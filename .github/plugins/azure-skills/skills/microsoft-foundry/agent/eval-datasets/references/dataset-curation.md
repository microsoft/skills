# Dataset Curation — Human-in-the-Loop Review

Review, annotate, and approve harvested trace candidates before including them in evaluation datasets. This ensures dataset quality by adding a human review gate between raw trace extraction and finalized test cases.

## Workflow Overview

```
Raw Traces (from KQL harvest)
    │
    ▼
[1] Candidate File (unreviewed)
    │
    ▼
[2] Human Review (approve/edit/reject each)
    │
    ▼
[3] Approved Dataset (versioned, ready for eval)
```

## Step 1 — Generate Candidate File

After running a [trace harvest](trace-to-dataset.md), save candidates with a `status` field:

```
datasets/<agent-name>-candidates-<date>.jsonl
```

Each line includes a review status:

```json
{"query": "How do I reset my password?", "response": "...", "status": "pending", "metadata": {"source": "trace", "conversationId": "conv-abc-123", "harvestRule": "error", "errorType": "TimeoutError", "duration": 12300}}
{"query": "What's the refund policy?", "response": "...", "status": "pending", "metadata": {"source": "trace", "conversationId": "conv-def-456", "harvestRule": "latency", "duration": 8700}}
```

## Step 2 — Present for Review

Show candidates in a review table:

| # | Status | Query (preview) | Source | Error | Duration | Eval Score |
|---|--------|----------------|--------|-------|----------|------------|
| 1 | ⏳ pending | "How do I reset my..." | error harvest | TimeoutError | 12.3s | — |
| 2 | ⏳ pending | "What's the refund..." | latency harvest | — | 8.7s | — |
| 3 | ⏳ pending | "Can you help me..." | low-eval harvest | — | 0.4s | 2.0 |

### Review Actions

For each candidate, the user can:

| Action | Result |
|--------|--------|
| **Approve** | Include in dataset as-is |
| **Approve + Edit** | Include with modified query/response/ground_truth |
| **Add Ground Truth** | Approve and add the expected correct answer |
| **Reject** | Exclude from dataset |
| **Flag** | Mark for later review |

### Batch Operations

- *"Approve all"* — include all pending candidates
- *"Approve all errors"* — include all candidates from error harvest
- *"Reject duplicates"* — exclude candidates with similar queries to existing dataset entries
- *"Approve #1, #3, #5; reject #2, #4"* — selective approval by number

## Step 3 — Finalize Dataset

After review, filter approved candidates and save to a versioned dataset:

1. Read `datasets/manifest.json` to find the latest version number
2. Filter candidates where `status == "approved"`
3. Remove the `status` field from the output
4. Save to `datasets/<agent-name>-<source>-v<N>.jsonl`
5. Update `datasets/manifest.json` with metadata

### Update Candidate Status

Mark the candidate file with final statuses:

```json
{"query": "How do I reset my password?", "status": "approved", "ground_truth": "Navigate to Settings > Security > Reset Password", "metadata": {...}}
{"query": "What's the refund policy?", "status": "rejected", "rejectReason": "duplicate of existing test case", "metadata": {...}}
{"query": "Can you help me...", "status": "approved", "metadata": {...}}
```

> 💡 **Tip:** Keep candidate files as an audit trail. They document what was reviewed, when, and why items were accepted or rejected.

## Quality Checks

Before finalizing, verify dataset quality:

| Check | Criteria |
|-------|----------|
| **No duplicates** | Ensure no query appears in both the new dataset and existing datasets |
| **Balanced categories** | Verify reasonable distribution across categories (not all edge-cases) |
| **Ground truth coverage** | Flag examples without ground_truth that may benefit from one |
| **Minimum size** | Warn if dataset has fewer than 20 examples (may not be statistically meaningful) |
| **Safety coverage** | Ensure safety-related test cases are included if the agent handles sensitive topics |

## Next Steps

- **Version the approved dataset** → [Dataset Versioning](dataset-versioning.md)
- **Organize into splits** → [Dataset Organization](dataset-organization.md)
- **Run evaluation** → [observe skill Step 2](../../observe/references/evaluate-step.md)
