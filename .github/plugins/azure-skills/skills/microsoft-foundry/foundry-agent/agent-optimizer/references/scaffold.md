# Scaffold Workflow

Use this workflow to make a Python agent optimizable before running Agent Optimizer in Foundry.

## Step 1: Resolve Target and Goal

Stay inside the selected agent root. Confirm the project is Python using `requirements.txt`, `pyproject.toml`, `setup.py`, or Python entrypoints.

Identify the optimization goal from user input, selected `evaluationSuites[]`, `.foundry/evaluators/*`, recent result summaries, datasets, or code/test comments. If the goal is unclear, proceed conservatively and explain that evaluator-specific targeting improves optimization quality.

## Step 2: Inventory Safe Targets

Scan for instructions, model selection, skill folders, function tool definitions, topology, and hosting entrypoint. Record file path, symbol/name, role, current value, and whether it is safe to expose through the optimizer.

Classify topology as single-agent, orchestrator/supervisor, specialist tool-agent, peer multi-agent, or unknown runtime. Do not collapse role-specific prompts into one global prompt. Ask before editing when multiple scopes are plausible.

Use [Python Patterns](python-patterns.md#target-selection) to map evaluator/dataset goals to the smallest useful baseline.

## Step 3: Scaffold Baseline Files

Create the required `.agent_configs/baseline/` folder beside `agent.yaml`:

```text
.agent_configs/
  baseline/
    metadata.yaml
    instructions.md
    tools.json
    skills/<skill-name>/SKILL.md
```

`metadata.yaml` points to selected baseline files:

```yaml
model: <existing-chat-model-deployment-name>
temperature: 0.7
instruction_file: instructions.md
skill_dir: skills
tool_file: tools.json
```

Write the selected baseline prompt to `instructions.md`. Include only relevant skills under `skills/`. Use `tools.json` only for OpenAI function-calling tool definitions; see [Python Patterns](python-patterns.md#tools-file).

Choose a `model` value that already exists as a model deployment in the target Foundry project.

Do not use code-level defaults as the optimization baseline.

## Step 4: Install and Wire SDK

Until the official PyPI package is available, download the preview wheel into the target agent repo:

```bash
curl -L -o azure_ai_agentserver_optimization-1.0.0b1.dev1-py3-none-any.whl https://github.com/Zyysurely/tool/raw/main/preview/azure_ai_agentserver_optimization-1.0.0b1.dev1-py3-none-any.whl
```

Then add the local wheel path to the target agent project's dependency file:

```text
./azure_ai_agentserver_optimization-1.0.0b1.dev1-py3-none-any.whl
```

If the project has a Dockerfile, ensure it copies the wheel before `pip install -r requirements.txt`. Do not commit the wheel to this skill repo. When the package is released, replace the local wheel entry with `azure-ai-agentserver-optimization`.

Wire the agent with no default parameters:

```python
from azure.ai.agentserver.optimization import load_config

config = load_config()
```

Map resolved values:

- Instructions -> `config.compose_instructions()`
- Model -> `config.model`
- Skills -> `config.skills_dir` with `load_skills_from_dir(...)` only when the runtime has a safe skill/tool mechanism
- Function tool definitions -> `config.apply_tool_descriptions(tools)` when tool metadata can be patched safely

Do not add optimization runtime env vars to `agent.yaml`. The default local config path is `.agent_configs/`; use `load_config(config_dir="...")` only when the scaffold intentionally uses a non-default local config directory.

## Step 5: Verify and Stop

Run Python syntax checks, SDK import smoke test, baseline config smoke test with no-arg `load_config()`, workspace diagnostics, and cheap relevant project tests.

End with a review checkpoint. Summarize changed files, optimization targets, evaluator goals, global side effects, and verification. Do not deploy automatically.

After user review, continue with [Optimize Workflow](optimize-workflow.md).
