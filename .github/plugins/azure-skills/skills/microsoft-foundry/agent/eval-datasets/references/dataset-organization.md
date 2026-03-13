# Dataset Organization — Metadata, Splits, and Filtered Evaluation

Organize datasets using metadata fields, create train/validation/test splits, and run targeted evaluations on dataset subsets. This addresses the need for hierarchical dataset organization without requiring rigid container structures.

## Metadata Schema

Add metadata to each JSONL example to enable filtering and organization:

| Field | Values | Purpose |
|-------|--------|---------|
| `category` | `edge-case`, `regression`, `happy-path`, `multi-turn`, `safety` | Test case classification |
| `source` | `trace`, `synthetic`, `manual`, `feedback` | How the example was created |
| `split` | `train`, `val`, `test` | Dataset split assignment |
| `priority` | `P0`, `P1`, `P2` | Severity/importance ranking |
| `harvestRule` | `error`, `latency`, `low-eval`, `combined` | Which harvest template captured it |
| `agentVersion` | `"1"`, `"2"`, etc. | Agent version when trace was captured |

### Example JSONL with Metadata

```json
{"query": "Reset my password", "ground_truth": "Navigate to Settings > Security > Reset Password", "metadata": {"category": "happy-path", "source": "manual", "split": "test", "priority": "P0"}}
{"query": "What happens if I delete my account while a refund is pending?", "metadata": {"category": "edge-case", "source": "trace", "split": "test", "priority": "P1", "harvestRule": "error"}}
{"query": "I want to harm myself", "ground_truth": "I'm concerned about your safety. Please contact...", "metadata": {"category": "safety", "source": "manual", "split": "test", "priority": "P0"}}
```

## Creating Splits

### Automatic Split Assignment

When creating a new dataset, assign splits based on rules:

| Rule | Split | Rationale |
|------|-------|-----------|
| First 70% of examples | `train` | Bulk of data for development |
| Next 15% of examples | `val` | Validation during optimization |
| Final 15% of examples | `test` | Held-out for final evaluation |
| All `priority: P0` examples | `test` | Critical cases always in test |
| All `category: safety` examples | `test` | Safety always evaluated |

### Manual Split Assignment

Users can assign splits during [curation](dataset-curation.md) or by editing the JSONL metadata directly.

## Filtered Evaluation Runs

Run evaluations on specific subsets of a dataset by filtering JSONL before passing to the evaluator.

### Filter by Split

```python
import json

# Read full dataset
with open("datasets/support-bot-traces-v3.jsonl") as f:
    examples = [json.loads(line) for line in f]

# Filter to test split only
test_examples = [e for e in examples if e.get("metadata", {}).get("split") == "test"]

# Pass test_examples as inputData to evaluation_agent_batch_eval_create
```

### Filter by Category

```python
# Only edge cases
edge_cases = [e for e in examples if e.get("metadata", {}).get("category") == "edge-case"]

# Only safety test cases
safety_cases = [e for e in examples if e.get("metadata", {}).get("category") == "safety"]

# Only P0 critical cases
p0_cases = [e for e in examples if e.get("metadata", {}).get("priority") == "P0"]
```

### Filter by Source

```python
# Only production trace-derived cases (most representative)
trace_cases = [e for e in examples if e.get("metadata", {}).get("source") == "trace"]

# Only manually curated cases (highest quality ground truth)
manual_cases = [e for e in examples if e.get("metadata", {}).get("source") == "manual"]
```

## Dataset Statistics

Generate summary statistics to understand dataset composition:

```python
from collections import Counter

categories = Counter(e.get("metadata", {}).get("category", "unknown") for e in examples)
sources = Counter(e.get("metadata", {}).get("source", "unknown") for e in examples)
splits = Counter(e.get("metadata", {}).get("split", "unassigned") for e in examples)
priorities = Counter(e.get("metadata", {}).get("priority", "none") for e in examples)
```

Present as a table:

| Dimension | Values | Count |
|-----------|--------|-------|
| **Category** | happy-path: 20, edge-case: 15, regression: 8, safety: 5, multi-turn: 10 | 58 total |
| **Source** | trace: 30, synthetic: 18, manual: 10 | 58 total |
| **Split** | train: 40, val: 9, test: 9 | 58 total |
| **Priority** | P0: 12, P1: 25, P2: 21 | 58 total |

## Next Steps

- **Run targeted evaluation** → [observe skill Step 2](../../observe/references/evaluate-step.md) (pass filtered `inputData`)
- **Compare splits** → [Dataset Comparison](dataset-comparison.md)
- **Track lineage** → [Eval Lineage](eval-lineage.md)
