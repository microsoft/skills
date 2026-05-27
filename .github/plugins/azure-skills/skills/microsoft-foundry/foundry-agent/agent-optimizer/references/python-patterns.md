# Python Agent Optimizer in Foundry Patterns

Use the Azure SDK optimization package and a local baseline folder. The baseline is file-based; call `load_config()` without code-level fallback parameters.

## Install and Import

Until the official PyPI package is available, download the preview wheel into the target agent repo:

```bash
curl -L -o azure_ai_agentserver_optimization-1.0.0b1.dev1-py3-none-any.whl https://github.com/Zyysurely/tool/raw/main/preview/azure_ai_agentserver_optimization-1.0.0b1.dev1-py3-none-any.whl
```

Then add the local wheel path to `requirements.txt` or the project dependency file:

```text
./azure_ai_agentserver_optimization-1.0.0b1.dev1-py3-none-any.whl
```

If the project has a Dockerfile, ensure it copies the wheel before `pip install -r requirements.txt`. Do not commit the wheel to this skill repo. When the package is released, replace the local wheel entry with `azure-ai-agentserver-optimization`.

Import from the SDK namespace:

```python
from azure.ai.agentserver.optimization import load_config
```

## Baseline Folder

Create `.agent_configs/baseline/` beside `agent.yaml`:

```text
<agent-root>/
  agent.yaml
  .agent_configs/
    baseline/
      metadata.yaml
      instructions.md
      tools.json
      skills/<skill-name>/SKILL.md
```

Example `metadata.yaml`:

```yaml
model: <existing-chat-model-deployment-name>
temperature: 0.7
instruction_file: instructions.md
skill_dir: skills
tool_file: tools.json
```

`instructions.md` contains the selected baseline system/developer instructions. Include only skill folders relevant to the optimization goal.

Choose a `model` value that already exists as a model deployment in the target Foundry project. Do not assume `gpt-4o` is available.

## Tools File

Use OpenAI function-calling tool objects under top-level `tools`. Currently, only function tool definition optimization is supported:

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "lookup_policy",
        "description": "Look up the company travel policy.",
        "parameters": {
          "type": "object",
          "properties": {
            "dept": {
              "type": "string",
              "description": "Department name"
            }
          }
        }
      }
    }
  ]
}
```

## Runtime Wiring

Call `load_config()` with no defaults:

```python
config = load_config()
instructions = config.compose_instructions()
model = config.model
```

For Microsoft Agent Framework:

```python
client = FoundryChatClient(
    project_endpoint=project_endpoint,
    model=config.model,
    credential=credential,
)

agent = Agent(
    client=client,
    instructions=config.compose_instructions(),
    tools=tools,
)
```

Patch optimized function tool definitions through the public helper. It updates matching function docs, descriptions, and parameter descriptions:

```python
config.apply_tool_descriptions(tools)
```

Load skills on demand when the runtime has a safe skill/tool mechanism:

```python
from pathlib import Path
from azure.ai.agentserver.optimization import load_skills_from_dir

skills = load_skills_from_dir(Path(config.skills_dir)) if config.skills_dir else []
```

## Target Selection

Use evaluator and dataset goals to decide what belongs in the baseline:

| Signal | Prefer |
| ------ | ------ |
| `relevance`, `task_adherence` | primary instructions and model |
| `intent_resolution` | router/orchestrator instructions |
| `builtin.tool_call_accuracy` | tool-calling instructions and OpenAI function tool definitions |
| safety/groundedness | safety, retrieval, citation, or answer-synthesis instructions |

For multi-agent apps, scaffold the target role's instructions and related skills/tools. Do not merge unrelated role prompts into one baseline.

## Runtime Config

The SDK reads optimization context from supported runtime sources. Keep `.agent_configs/baseline/` present so default `load_config()` startup has a local baseline. Use `load_config(config_dir="my_configs")` only for non-default local config directories, and `load_config(required=False)` only when the app can intentionally run without optimization config.

## Verification Checklist

- Dependency file includes the local preview wheel path, or `azure-ai-agentserver-optimization` after PyPI release
- `from azure.ai.agentserver.optimization import load_config` succeeds
- `.agent_configs/baseline/metadata.yaml` exists and points to existing files
- `load_config()` is called without defaults unless using an intentional `config_dir` or `required=False`
- Changed Python files compile and preserve the hosting adapter/protocol
- User is asked to review before deployment
