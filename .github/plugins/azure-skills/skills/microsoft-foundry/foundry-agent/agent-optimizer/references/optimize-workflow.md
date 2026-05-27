# Optimize Workflow

Use this after azd setup and scaffold review are complete.

## 1. Prepare context

1. Resolve the hosted agent with [azd Setup](azd-setup.md).
2. If SDK wiring or `.agent_configs/baseline/` is missing, run [Scaffold Workflow](scaffold.md) first.
3. If scaffolding changed files, stop and ask the user to review before optimization.
4. Ensure `eval.yaml` exists using [eval.yaml Guidance](eval-yaml.md), or ask whether to use built-in optimize defaults.
5. Before setting optimizer models, verify the project has deployments named `GPT-5`, `GPT-5.1`, `GPT-5.2`, `GPT-5.4`, `GPT-5.5`, `DeepSeek-V4-Pro`, or `DeepSeek-V-3.2`. Use only existing deployments from that allowlist.

## 2. Run optimize

Run from the azd project/agent root:

```bash
azd ai agent optimize
```

If multiple services are detected, let azd prompt or ask the user which service to use. If `eval.yaml` exists, use it when it matches the selected agent; otherwise ask before regenerating or ignoring it.

## 3. Monitor

Use these when the job is long-running or the user asks:

```bash
azd ai agent optimize status <operation-id> --watch
azd ai agent optimize list
azd ai agent optimize cancel <operation-id>
```

Capture the operation ID, portal URL, scores, and candidate IDs from output.

## 4. Apply locally

Recommend the best candidate, then ask before applying:

```bash
azd ai agent optimize apply --candidate <candidate-id>
```

After apply, show the source diff and summarize changed files, prompts, model/temperature, tools, and skills.

## 5. Deploy after review

In azd environments, prefer local apply plus:

```bash
azd deploy
```

Do not use `azd ai agent optimize deploy --candidate <candidate-id>` unless the user explicitly requests it. Local apply keeps optimized changes visible for source control review.
