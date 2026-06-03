# Example: run evals and analyze results

User intent: "Run my evals and tell me why the agent is failing."

## Safe preflight

```powershell
node --version
npx -y --package @microsoft/m365-copilot-eval@latest runevals --version
npx -y --package @microsoft/m365-copilot-eval@latest runevals --help
```

Confirm env files exist without printing values. For first-time setup:

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals accept-eula
npx -y --package @microsoft/m365-copilot-eval@latest runevals --init-only
```

## Run with JSON output

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --concurrency 1 --output .evals\latest.json
```

Use `--concurrency 1` for debugging. Increase up to `5` only after setup is stable.

## Optional human report

```powershell
npx -y --package @microsoft/m365-copilot-eval@latest runevals --prompts-file evals\evals.json --output .evals\latest.html
```

## Analysis approach

1. Load `references\result-analysis.md`.
2. Parse `items` from the JSON output.
3. Check only score keys that exist.
4. Separate setup/auth/model/schema failures from quality failures.
5. Group quality failures by likely fix: instructions, grounding, citations, expected response, or capability gap.

Example response:

```text
The main issue is grounding: two prompts passed relevance/coherence but failed groundedness. The agent answered with plausible project facts that were not present in the provided sources. Recommended change: add an instruction to answer only from retrieved workplace sources and say what is missing when evidence is insufficient.
```
