# Example: iterate after agent changes

User intent: "I changed my agent instructions. Re-run the evals and compare."

## Baseline run

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --concurrency 1 --output .evals\baseline.json
```

## After-change run

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --concurrency 1 --output .evals\after-instructions.json
```

Keep the dataset, evaluator thresholds, model deployment, and concurrency stable when comparing. If the user intentionally changed the dataset, report that the comparison is not a strict regression comparison.

## Compare

1. Compare `items` by prompt or conversation name.
2. Compare only score keys that exist in both runs.
3. Look for improvements and regressions by evaluator theme.
4. If a setup/auth/model error appears in only one run, do not call it an agent regression.

## Example summary

```text
The instruction change improved grounding on the project-status prompt from fail to pass, but the action-item prompt still fails citations. The next targeted change should require source citations when listing owners, or the eval should be relaxed if the agent cannot expose citations for that data path.
```
