# eval.yaml Guidance

Create `eval.yaml` directly when the conversation or `.foundry/agent-metadata*.yaml` already selected the dataset/evaluators. Otherwise ask whether to run `azd ai agent eval init` or let optimize use built-in defaults.

## Include

```yaml
name: <suite-or-optimization-name>
agent:
  name: <agent-name>
  kind: hosted
  version: "<agent-version>"
  model: <baseline-model-deployment-name>
  config: .agent_configs/baseline/metadata.yaml
dataset_file: <path-to-jsonl>
# dataset_reference:
#   name: <foundry-dataset-name>
#   version: "<dataset-version>"
#   local_uri: <local-dataset-jsonl>
# validation_reference:
#   name: <validation-dataset-name>
#   version: "<validation-version>"
evaluators:
  - <evaluator-name>
  - name: <custom-evaluator-name>
    version: "<evaluator-version>"
    local_uri: <local-evaluator-json>
options:
  eval_model: <existing-chat-model-deployment-name>
  optimization_model: <allowed-optimizer-model-deployment-name>
  max_iterations: 4
  optimization_config:
    model: '["<allowed-target-model-deployment-name>"]'
    baselineModel: '"<baseline-model-deployment-name>"'
  keep_versions: false
generation_instruction: >-
  <goal-specific quality or data-generation instruction>
max_samples: 15
trace_days: 3
```

Use existing model deployments for `agent.model` and `options.eval_model`; do not assume `gpt-4o`.

For `options.optimization_model` and `options.optimization_config.model`, first verify that the target Foundry project has deployments whose names are in this allowlist:

- `GPT-5`
- `GPT-5.1`
- `GPT-5.2`
- `GPT-5.4`
- `GPT-5.5`
- `DeepSeek-V4-Pro`
- `DeepSeek-V-3.2`

If none exist, ask the user to deploy one of these models before configuring optimization.

## Skip

Do not add these fields unless the user explicitly asks and understands the tradeoff:

- `target_attributes`
- `budget`
- `min_improvement`

Keep `target_attributes` omitted so azd can auto-detect optimizable attributes.

## Source mapping

| Source | eval.yaml field |
|--------|-----------------|
| effective azd context | `agent.name`, `agent.version`, `agent.kind` |
| baseline config | `agent.model`, `agent.config`, `options.optimization_config.baselineModel` |
| selected local dataset JSONL | `dataset_file` |
| selected remote/local dataset | `dataset_reference` |
| selected validation dataset | `validation_reference` |
| selected Foundry/local evaluators | `evaluators[]` |
| selected judge/eval deployment | `options.eval_model` |
| selected allowlisted optimizer deployment | `options.optimization_model`, `options.optimization_config.model` |
| optimization goal | `generation_instruction` |
