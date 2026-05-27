# Agent Optimizer in Foundry — Scaffold Python Agent

Prepare an existing Python hosted agent for Agent Optimizer in Foundry, then run optimization, apply the selected candidate locally, and deploy through azd after review.

## When to Use This Skill

USE FOR: make my Python agent optimizable with Agent Optimizer in Foundry, scaffold optimizer config, add `load_config`, prepare `.agent_configs`, configure eval.yaml, run azd ai agent optimize, apply optimizer candidate, deploy optimized agent.

DO NOT USE FOR: non-Python agents, prompt agents, running standalone batch evaluations, prompt optimization of an already deployed agent, or general Foundry deployment. For normal deployment, use [deploy](../deploy/deploy.md). For eval analysis loops, use [observe](../observe/observe.md).

## Quick Reference

| Property | Value |
| -------- | ----- |
| Phase | Scaffold, optimize, apply locally, deploy |
| Supported language | Python |
| Required runtime | azd project with hosted agent |
| Required package | `azure-ai-agentserver-optimization` |
| Required import | `from azure.ai.agentserver.optimization import load_config` |
| Required baseline | `.agent_configs/baseline/` beside `agent.yaml` |
| Supported targets | instruction, model, skill folder, function tool definitions |
| azd setup | [azd Setup](references/azd-setup.md) |
| Detailed scaffold steps | [Scaffold Workflow](references/scaffold.md) |
| Python/file patterns | [Python Patterns](references/python-patterns.md) |
| Eval config | [eval.yaml Guidance](references/eval-yaml.md) |
| Optimize flow | [Optimize Workflow](references/optimize-workflow.md) |

## High-Level Lifecycle

1. **Prepare azd:** Verify azd, login, and `azure.ai.agents` extension with [azd Setup](references/azd-setup.md).
2. **Scaffold:** Follow [Scaffold Workflow](references/scaffold.md) when SDK wiring or `.agent_configs/baseline/` is missing; stop for review if files changed.
3. **Configure eval:** Create or update `eval.yaml` using [eval.yaml Guidance](references/eval-yaml.md).
4. **Optimize:** Run and monitor `azd ai agent optimize` with [Optimize Workflow](references/optimize-workflow.md).
5. **Apply and deploy:** Apply the selected candidate locally, review the diff, then deploy with `azd deploy`.

## Workflow

1. Resolve the target agent root and confirm it is a Python hosted agent.
2. Read [azd Setup](references/azd-setup.md), then [Scaffold Workflow](references/scaffold.md) if scaffolding is needed.
3. Read [eval.yaml Guidance](references/eval-yaml.md) and configure optimization inputs from known dataset/evaluator context.
4. Read [Optimize Workflow](references/optimize-workflow.md), run optimization, and ask before applying a candidate.
5. After local review and approval, deploy with `azd deploy`, then invoke via [invoke](../invoke/invoke.md).

## Guardrails

- Target hosted Python agents only.
- Preserve existing frameworks, tools, hosting adapters, protocols, and entrypoints.
- Do not use one global scaffold across multi-agent roles unless the architecture already has one global prompt/model or the user approves.
- Keep edits scoped to the selected agent root.
- Do not apply candidates or deploy automatically; stop for review first.
- Prefer `azd ai agent optimize apply --candidate` plus `azd deploy` over direct optimize deploy so source changes are reviewable.
