# Dataset Comparison — Experiment Framework & A/B Testing

Run structured experiments that compare agent versions against the same dataset, and present results as leaderboards with per-evaluator breakdowns.

## Experiment Structure

An experiment consists of:
1. **One pinned dataset version** — ensures fair comparison
2. **Multiple agent versions** — the variables being compared
3. **Same evaluators** — applied consistently across all versions
4. **Comparison results** — which version wins on each metric

## Step 1 — Define the Experiment

| Parameter | Value | Example |
|-----------|-------|---------|
| Dataset | Pinned version from `datasets/manifest.json` | `support-bot-traces-v3` (tag: `prod`) |
| Baseline | Agent version to compare against | `v2` |
| Treatment(s) | Agent version(s) to evaluate | `v3`, `v4` |
| Evaluators | Same set for all runs | coherence, fluency, relevance, intent_resolution, task_adherence |

## Step 2 — Run Evaluations

For each agent version, run **`evaluation_agent_batch_eval_create`** with:
- Same `evaluationId` (groups all runs for comparison)
- Same `inputData` (from the pinned dataset)
- Same `evaluatorNames`
- Different `agentVersion`

> **Important:** Use `evaluationId` (NOT `evalId`) to group runs. All versions must be in the same evaluation group for comparison to work.

## Step 3 — Compare Results

Use **`evaluation_comparison_create`** with the baseline and treatment runs:

```json
{
  "insightRequest": {
    "displayName": "Experiment: v2 vs v3 vs v4 on traces-v3",
    "state": "NotStarted",
    "request": {
      "type": "EvaluationComparison",
      "evalId": "<eval-group-id>",
      "baselineRunId": "<v2-run-id>",
      "treatmentRunIds": ["<v3-run-id>", "<v4-run-id>"]
    }
  }
}
```

## Step 4 — Leaderboard

Present results as a leaderboard table:

| Evaluator | v2 (baseline) | v3 | v4 | Best |
|-----------|:---:|:---:|:---:|:---:|
| Coherence | 3.5 | 4.1 | 4.0 | ✅ v3 |
| Fluency | 4.2 | 4.4 | 4.5 | ✅ v4 |
| Relevance | 3.0 | 3.8 | 3.6 | ✅ v3 |
| Intent Resolution | 3.3 | 4.0 | 4.1 | ✅ v4 |
| Task Adherence | 2.8 | 3.5 | 3.9 | ✅ v4 |
| **Wins** | **0** | **2** | **3** | — |

### Recommendation

Based on the comparison:

*"v4 wins on 3/5 evaluators (Fluency, Intent Resolution, Task Adherence). v3 wins on 2/5 (Coherence, Relevance). Recommend deploying v4 with additional prompt tuning to recover Relevance."*

## Pairwise A/B Comparison

For detailed pairwise analysis between exactly two versions:

| Evaluator | Baseline (v2) | Treatment (v3) | Delta | p-value | Effect |
|-----------|:---:|:---:|:---:|:---:|:---:|
| Coherence | 3.5 ± 0.8 | 4.1 ± 0.6 | +0.6 | 0.02 | Improved |
| Fluency | 4.2 ± 0.5 | 4.4 ± 0.4 | +0.2 | 0.15 | Inconclusive |
| Relevance | 3.0 ± 1.1 | 3.8 ± 0.9 | +0.8 | 0.01 | Improved |

> 💡 **Tip:** The `evaluation_comparison_create` result includes `pValue` and `treatmentEffect` fields. Use `pValue < 0.05` as the threshold for statistical significance.

## Multi-Dataset Comparison

Compare how the same agent version performs across different datasets:

| Dataset | Coherence | Fluency | Relevance | Notes |
|---------|:---------:|:-------:|:---------:|-------|
| traces-v3 (prod) | 4.0 | 4.5 | 3.6 | Production-derived |
| synthetic-v2 | 4.3 | 4.6 | 4.1 | May overestimate quality |
| manual-v1 (curated) | 3.8 | 4.4 | 3.2 | Hardest test cases |

> ⚠️ **Warning:** Be cautious comparing scores across different datasets. Differences may reflect dataset difficulty, not agent quality. Always compare agent versions on the same dataset.

## Next Steps

- **Track trends over time** → [Eval Trending](eval-trending.md)
- **Check for regressions** → [Eval Regression](eval-regression.md)
- **Audit full lineage** → [Eval Lineage](eval-lineage.md)
