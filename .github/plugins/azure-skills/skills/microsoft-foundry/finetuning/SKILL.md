---
name: azure-ai-fine-tuning
description: "Fine-tune models on Azure AI Foundry — dataset preparation, grader design, training (SFT/DPO/RFT), monitoring, checkpoint selection, deployment, and evaluation. WHEN: fine-tune, SFT, DPO, RFT, training data, grader, reinforcement learning, distillation, custom model, pass_threshold, training job."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

> **Parent Skill:** [Microsoft Foundry](../SKILL.md)

> **⚠️ MANDATORY:** Before running ANY script or command:
> 1. Read the **workflow file** for your stage (`workflows/quickstart.md`, `workflows/full-pipeline.md`, etc.)
> 2. Read the **reference file** for your specific task (`references/grader-design.md`, `references/hyperparameters.md`, etc.)
> 3. **Validate your data** with `scripts/validate/` before submitting
>
> Fine-tuning has many platform gotchas. Skipping these steps leads to failed jobs and wasted quota.

# Goal

Help the user fine-tune a model on Azure AI Foundry. This covers the full lifecycle:

1. **Dataset creation** — generate or prepare training data
2. **Dataset evaluation** — assess data quality before training
3. **Base model evaluation** — benchmark the un-tuned model
4. **Training type selection** — choose SFT, DPO, or RFT
5. **Dataset format conversion** — convert data to the right format
6. **Training job submission** — launch and monitor training runs
7. **Training curve analysis** — detect overfitting, pick checkpoints
8. **Iterative experimentation** — plan successive runs from results
9. **Model deployment** — deploy fine-tuned models with correct format/SKU
10. **Model evaluation** — score outputs with an LLM judge

$ARGUMENTS

# Workflow

Read the workflow file that matches the user's current stage:

- **First time / just want to get started** → `workflows/quickstart.md`
- **Starting from scratch** → `workflows/full-pipeline.md`
- **Need a dataset** → `workflows/dataset-creation.md`
- **Training and iterating** → `workflows/iterative-training.md`
- **Results are bad** → `workflows/diagnose-poor-results.md`
- **Reviewing results & planning next run** → `workflows/experiment-review.md`

If the stage isn't clear, start with `workflows/full-pipeline.md`.

# References

Read the relevant reference file before performing any step:

| File | When to read |
|------|-------------|
| `references/training-types.md` | Choosing between SFT, DPO, and RFT |
| `references/hyperparameters.md` | Setting learning rate, batch size, epochs |
| `references/dataset-formats.md` | Preparing or converting training data |
| `references/deployment-formats.md` | Deploying a fine-tuned model |
| `references/evaluation-methodology.md` | Designing an eval rubric |
| `references/training-curve-analysis.md` | Reading training logs and curves |
| `references/foundry-cli.md` | Using the `azd ai finetuning` CLI for submit/deploy |
| `references/vision-fine-tuning.md` | Fine-tuning with image data (gpt-4o, gpt-4.1) |
| `references/cost-management.md` | Training costs, hosting tiers, budget planning |
| `references/distillation.md` | Teacher-student model distillation workflow |
| `references/agentic-rft.md` | Tool calling + endpoint graders for agentic RFT |
| `references/grader-design.md` | Designing effective RFT graders (type selection, partial credit, threshold calibration) |
| `references/reward-hacking-prevention.md` | Preventing reward hacking in RFT (grader alignment, monitoring, iteration) |
| `references/platform-bugs.md` | Known platform bugs and workarounds |
| `references/large-file-uploads.md` | Uploading large training files (>100MB) via chunked Uploads API |

# Scripts

Reusable Python scripts in `scripts/`. Each is self-contained with inline documentation.

| Script | Purpose |
|--------|---------|
| `submit_training.py` | Submit SFT, DPO, or RFT jobs (SDK + REST fallback) |
| `monitor_training.py` | Poll a running job until completion, streaming events in real time |
| `calibrate_grader.py` | Run base model through your RFT grader to find optimal pass_threshold |
| `generate_distillation_data.py` | Generate training data from a teacher model for distillation |
| `check_training.py` | Pull training curves, detect overfitting, list checkpoints |
| `deploy_model.py` | Deploy fine-tuned models via ARM REST API |
| `cleanup.py` | List and delete old deployments, files, and pending jobs to reclaim quota |
| `evaluate_model.py` | Run held-out eval with 2-dimension LLM judge |
| `convert_dataset.py` | Convert between SFT, DPO, and RFT JSONL formats |
| `score_dataset.py` | LLM-judge quality scoring on training data |
| `common.py` | Shared auth helper — `get_clients()` tries /v1/, Foundry SDK, AzureOpenAI in order |
| `validate/validate_sft.py` | Validate SFT JSONL: schema, roles, token limits, system prompt consistency |
| `validate/validate_dpo.py` | Validate DPO JSONL: schema, identical-pair detection, DPO epoch warnings |
| `validate/validate_rft.py` | Validate RFT JSONL: schema, grader escaping warnings, content moderation risk |
| `validate/data_stats.py` | Dataset stats: token counts, format detection, cost estimates per model family |

**Always validate data before submitting jobs** — run `validate_sft.py` / `validate_dpo.py` / `validate_rft.py` first, then `data_stats.py` for the overview.

**Sample data**: `examples/sample-data/` contains `sft_sample.jsonl`, `dpo_sample.jsonl`, and `rft_sample.jsonl` — use these as format references.

**CLI alternative**: For quick single-job workflows, the `azd ai finetuning` CLI can replace `submit_training.py` and `deploy_model.py`. See `references/foundry-cli.md`.

# Rules

- Always evaluate the **base model** before fine-tuning — you need a baseline to measure improvement.
- **Verify your deployments exist** before starting — model names must match actual deployment names. A model like `gpt-4.1` must be deployed in your resource before you can use it as a teacher or student.
- **For data generation, ask the user which model deployment to use.** Data Designer and distillation scripts both require an LLM endpoint — don't assume a model is available. The user may have gpt-4.1-mini, gpt-5.4, or any other model deployed.
- Start with **2 epochs** for SFT, **1–2 epochs** for DPO (explicitly set — Azure defaults to 3), and task-dependent for RFT. Learning rate multiplier **1.0** unless you have reason to change.
- Never skip dataset quality review — garbage in, garbage out.
- Use the same held-out validation set across ALL experiments for comparable results.
- When overfitting is detected, deploy an earlier checkpoint before retraining with fewer epochs.
- Clean up deployments after evaluation to avoid quota exhaustion.
- **RFT grader field names MUST match training data**: Before submitting an RFT job, verify that the grader's `item.get('field_name')` calls match the actual field names in your JSONL data. A mismatch (e.g., grader reads `reference_answer` but data uses `answer`) silently returns 0.0 for every sample — the grader never raises an error, it just gets empty strings. Always print and diff the grader source vs. the first line of your training JSONL.
- **RFT tasks must be hard enough for the base model to fail**: If the base model already scores 100% on your grader from rollout 1, RFT has no signal to learn from — the reward gradient is zero. Before submitting RFT, run the base model on your validation set and grade it with your grader. If pass rate is already > 90%, either (a) make the grader stricter, (b) use harder tasks, or (c) skip RFT — the model is already good enough.

# Resource & Subscription Management

**Resources may span multiple subscriptions.** Always verify both the subscription AND resource before submitting jobs or querying status. The `az` CLI only searches the active subscription.

**Map your resources before starting:**

| Resource | Subscription | RG | Endpoint | Use |
|----------|-------------|-----|----------|-----|
| `<your-primary-resource>` | `<subscription-name>` | `<resource-group>` | `https://<your-primary-resource>.cognitiveservices.azure.com/` | Primary FT resource |
| `<your-secondary-resource>` | `<subscription-name>` | `<resource-group>` | `https://<your-secondary-resource>.cognitiveservices.azure.com/` | Secondary / overflow |

> **Tip:** Run `az cognitiveservices account list --query "[].{name:name, rg:resourceGroup, endpoint:properties.endpoint}" -o table` to discover all your resources across subscriptions.

**Before querying or submitting jobs:**
1. **Ask the user** which resource/project the job is on, or check the Foundry UI URL
2. Run `az account set --subscription "<sub name>"` to switch to the correct subscription
3. Verify with `az account show --query name -o tsv`

**Common mistake**: Forgetting to switch subscriptions before querying. If a job returns 404, try the other subscription before assuming it's lost.

# Platform Gotchas

- **Verify you're submitting to the correct resource AND subscription**: Azure AI Foundry projects connect to a specific AIServices/OpenAI resource, which lives on a specific subscription. Jobs submitted to a different resource won't appear in the portal or telemetry. Symptoms: jobs show via API but not in the Foundry UI; "phantom" failures that the team can't reproduce; 404s when querying a valid job ID. Always (1) switch to the correct subscription first, (2) use the project endpoint (`https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1/`) or verify the OAI endpoint matches the resource connected to your Foundry project. A common mistake is submitting to `<resource-A>` instead of `<resource-B>` — all "platform 500" failures were actually jobs on the wrong resource.
- **Transient HTTP 500 failures**: Azure AI Foundry FT jobs can fail with "A system error was encountered, please try again later" (HTTP 500). Single retries often succeed. **Retry once or twice, then wait and check.** If failures persist, verify you're hitting the correct resource endpoint before filing a support ticket.
- **All OSS FT jobs require `trainingType: globalStandard`**: The Python SDK fails with "does not support fine-tuning with Standard TrainingType" for all OSS models (Ministral-3B, Qwen-32B, Llama-3.3-70B-Instruct, gpt-oss-20b). Use the REST API with `"trainingType": "globalStandard"` in the JSON payload. See `scripts/submit_training.py` for the fallback.
- **OSS model FT uses Global deployment tier**: Ministral-3B, Qwen-32B, Llama-3.3-70B-Instruct, and gpt-oss-20b support fine-tuning via **Global** (not Standard regional). Any regional resource can use Global. The model catalog API incorrectly reports `capabilities.fine_tune = false` for these models — ignore the flag. Developer tier is only available for OpenAI models, not OSS. Model ID format: `Ministral-3B` (not `gpt-*`); FT output format: `Ministral-3B.ft-{jobid}-suffix`. Note: `gpt-oss-20b` is the model name but the versioned ID on the platform is `gpt-oss-20b-11`.
- **Deployment format matters**: A wrong `model.format` gives an unhelpful HTTP 500. See `references/deployment-formats.md` for the exact mapping. For OSS models, use `--model-format "OpenAI-OSS"` with `--sku-name "GlobalStandard"`. Deploy via CLI: `az cognitiveservices account deployment create --name <resource> --resource-group <rg> --deployment-name <name> --model-name <model> --model-version "1" --model-format "OpenAI-OSS" --sku-capacity 100 --sku-name "GlobalStandard"`.
- **OSS endpoint matrix**:

  | Operation | Recommended path |
  |---|---|
  | FT job submission (OSS) | OAI REST endpoint with `"trainingType": "globalStandard"` — SDK rejects OSS models |
  | FT job submission (OpenAI models) | SDK or `/v1/` project endpoint |
  | OSS FT model deployment | ARM management plane (`management.azure.com`) with `format: "OpenAI-OSS"` — data-plane PUT returns 404 |
  | OSS inference | OAI endpoint with `api-key` header works — project endpoint also works |
  | File upload | SDK `client.files.create()` + `client.files.wait_for_processing()` |
- **Project endpoint grading**: The `/v1/` path does NOT accept `api-version` query params. Use `openai.OpenAI()` client, NOT `AzureOpenAI()`, when calling project endpoints.
- **Try the /v1/ project endpoint first** for fine-tuning operations. It supports features like Python graders without API version strings. Use `openai.OpenAI(base_url="https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1/", api_key=KEY)`. If you encounter "API version not supported" errors on file uploads or job management, fall back to the non-project endpoint with `2025-04-01-preview` (see Bug #2 in `references/platform-bugs.md`).
- **RFT grader escaping**: Python code embedded in grader JSON must escape `\n` → `\\n`, `\t` → `\\t`, quotes → `\"`.
- **RFT API version**: Python graders for RFT require `api-version=2025-04-01-preview` or later. The `2025-03-01-preview` API rejects `type: "python"`.
- **RFT data format**: The last message in RFT training data **must** be `role: "user"`. Reference answers go in extra fields (e.g., `"answer": 42`), not in assistant messages.
- **RFT grader field name mismatch is SILENT**: If the grader reads `item.get('reference_answer')` but training data uses `answer`, the grader gets empty string and returns 0.0 for every sample. **No error is raised.** The training UI will show 0% reward — or if combined with other scoring logic, misleading results. **Always verify** the grader source's `item.get()` field names match your JSONL's extra fields exactly. This was discovered during math RFT testing — the deployed grader read `reference_answer` but the training data had `answer`, causing zero reward signal.
- **RFT 100% pass rate from rollout 1 = no learning signal**: If every sample passes from the very first rollout, the model has no gradient to improve. Common causes: (1) task too easy for the base model (o4-mini aces simple math/QA), (2) grader too lenient (word overlap scoring passes anything close), (3) grader broken (field mismatch returning default score). Fix: run the base model through your grader before submitting — if pass rate > 90%, the task is too easy for RFT.
- **RFT 0% pass rate from rollout 1 = no learning signal**: If no samples pass, the model gets only negative reward and has no positive examples to learn from. Common causes: (1) task too hard for the base model, (2) pass_threshold too strict, (3) grader returning 0 for all outputs (broken parsing, field mismatch). Fix: lower the pass_threshold, simplify the task, or check the grader on base model outputs. Target 30-50% failure rate — the model needs some successes to learn what good looks like.
- **Recalibrate pass_threshold when changing datasets**: A threshold that worked for a small dataset may be too strict or too lenient after adding more examples. The base model's score distribution shifts with different data composition. Always re-run threshold calibration after changing dataset size or content. See `references/grader-design.md` for the calibration workflow.
- **Grader template syntax**: Template variables must have **no spaces** inside braces: `{{item.answer}}` ✅, `{{ item.answer }}` ❌.
- **RFT grader alignment is critical (reward hacking is the #1 RFT failure mode)**: If training grader ≠ eval grader, reward hacking is guaranteed. Symptom: train-val gap > 0.10. One RFT experiment showed a 0.24+ gap when using a Python AST grader for training but LLM judge for eval. Fix: use identical grading logic for both training and eval, or use endpoint graders. See `references/reward-hacking-prevention.md` and [microsoft-foundry/fine-tuning RFT demos](https://github.com/microsoft-foundry/fine-tuning/tree/main/Demos/RFT_Countdown).
- **RFT content moderation**: RFT training data must pass Azure content moderation. Prompts asking the model to "show your reasoning step by step" or "explain your chain of thought" may be flagged as "model reasoning extraction" and rejected. Use simpler instructions like "Solve this problem" or "Give your final answer."
- **DPO overtraining / degeneration**: DPO is prone to model collapse when overtrained. Symptoms: repetitive token output ("I I I I I..."), especially on sensitive topics. Mitigation: (1) Use 1–2 epochs max, not 3; (2) Monitor for near-zero training loss early — if loss hits ~1e-6 before epoch 2, stop early or reduce learning rate; (3) Always evaluate on adversarial/edge-case prompts, not just average quality; (4) If the base model already handles the task well (>9/10), DPO may hurt more than help — consider whether fine-tuning is needed at all.
- **DPO default epochs**: Azure Foundry defaults DPO to **3 epochs**, not 2. For small datasets (<500 pairs), explicitly set `n_epochs=1` or `n_epochs=2` to avoid overtraining. The `hyperparameters` field on the job object may show `None` even when defaults are applied.
- **File upload quota**: Max 100 files per resource. Delete old uploads when approaching the limit.
- **Token refresh**: ARM tokens expire. Always call `az account get-access-token` immediately before each request.
- **Val loss overfitting ≠ worse quality**: A model significantly above its best val_loss can still outperform an earlier checkpoint on downstream evals. Don't blindly deploy epoch-1 checkpoints — always evaluate with a held-out test set before deciding.
- **Small datasets teach format, not domain**: With <100 examples (e.g., 73 tool-calling samples), a fine-tuned model learns mechanical patterns (always call a tool, produce valid JSON args) but does NOT improve task-specific accuracy (correct tool selection). Need 200+ examples for domain knowledge.
- **Dataset size sweet spot**: 200–500 examples is the sweet spot to get started. Evaluate results, then decide if you need more data — quality matters more than quantity. Larger datasets (4K+) can actually hurt OSS models. For distillation tasks, 200–300 high-quality examples is often sufficient.
- **Distillation sweet spot**: SFT distillation (e.g., mini→nano) routinely achieves high teacher gap closure on well-defined tasks (code generation, structured extraction) with just 200–300 examples and 2 epochs. This is the most reliable fine-tuning pattern. For classification tasks, direct SFT on gold labels works better than distillation when ground truth is clean.
- **Latency benchmarking**: Always measure p50/p90/p95/p99 latency for base vs fine-tuned models, not just accuracy. Fine-tuned models often have lower latency + tighter variance — see the [Image Breed Classification demo](../Demos/Image_Breed_Classification_FT/) for an example showing mean and p99 latency improvements.
- **Content filters on PII/security data**: Generating synthetic data containing SSNs, credit cards, or security-sensitive content can trigger Azure's jailbreak filter. Expect ~14% rejection rate. Generate extra examples to compensate.
- **Data Designer `categories` vs `values`**: `CategorySamplerParams` uses `values=`, NOT `categories=`. Using the wrong field name causes a cryptic `Field required` pydantic error.
- **Data Designer `LLMColumnConfig` doesn't exist**: Use `LLMTextColumnConfig` for text generation and `LLMStructuredColumnConfig` for structured output. The DD SKILL.md and `data-designer agent context` command have the correct types.
- **Data Designer `Score` requires `options`**: `dd.Score(name=..., description=..., options={"1": "Poor", "5": "Average", "10": "Excellent"})`. The `options` dict maps score values to descriptions.
- **Data Designer model alias conflicts**: If a model alias is configured globally (`~/.data-designer/model_configs.yaml`), do NOT also call `add_model_config()` in the script — it will fail with "alias already exists".
- **Data Designer + GPT-5 series**: GPT-5.x models use `max_completion_tokens`, not `max_tokens`. Set it via `extra_body` in the DD model config, not `max_tokens` directly.
- **Data Designer Windows encoding**: Set `$env:PYTHONIOENCODING = "utf-8"` on Windows before running DD CLI commands. Rich terminal output contains emoji that cp1252 encoding can't handle.
- **File upload processing delay**: After `client.files.create()`, call `client.files.wait_for_processing(file_id)` before submitting a training job. This polls until the file is ready. Without it, immediate submission fails with "file import not completed".
- **DPO hyperparameters go inside method config**: When submitting DPO jobs, `n_epochs`, `learning_rate_multiplier`, and `beta` must be inside `method.dpo.hyperparameters`, NOT at the top-level `hyperparameters` field. Top-level HPs cause `invalidPayload` error. Example: `method={"type": "dpo", "dpo": {"hyperparameters": {"n_epochs": 2, "beta": 0.1, "learning_rate_multiplier": 1.0}}}`.
- **Azure AI Eval SDK `type` field required**: When using `OpenAIModelConfiguration` with the project `/v1/` endpoint, you must include `type="openai"`. Without it, the SDK throws `'' is not a supported connection type`.
- **SDK generic evaluators are degradation guardrails, not FT metrics**: Built-in evaluators (Coherence, Fluency, TaskAdherence) measure general quality and may show no difference between base and fine-tuned models even when domain-specific eval shows clear improvement. Use them only to verify the model didn't regress. For actual FT evaluation, use the SDK's custom graders: `AzureOpenAIScoreModelGrader` (LLM judge with task-specific rubric), `AzureOpenAIPythonGrader` (code-based exact match), or `AzureOpenAIStringCheckGrader` (pattern matching).
- **Content safety rejection on FT models**: Training may succeed but the resulting model can be rejected at deployment time with "model scores above acceptable thresholds for [Hate/Fairness]". This can happen even with innocuous data (e.g., entity extraction from medical records, legal documents, resumes with PII). **Workaround**: Remove document types containing sensitive attributes (medical, legal, HR), reduce PII density, or rephrase to use clearly synthetic names/data. There is no appeal process — you must resubmit with cleaner data.
- **Data Designer CLI syntax**: The `create` command takes a positional config arg: `data-designer create <config.py>`, NOT `--config`. The config script must define `load_config_builder() -> DataDesignerConfigBuilder`.
- **Data Designer API key env var is per-shell**: `AZURE_FOUNDRY_API_KEY` must be set in each new terminal. DD health check fails with "API key invalid or expired" if missing.
- **FT deployment "DeploymentNotReady" after ARM Succeeded**: The data plane can lag behind the control plane. If a deployment stays stuck in DeploymentNotReady despite ARM showing Succeeded, delete and recreate it.
- **OpenAI SDK API version mismatch with project endpoints**: The project `/v1/` endpoint may not support all API versions for all operations. Use REST API directly (`requests`) for file uploads and job management when the SDK throws "API version not supported". The non-project endpoint (`/openai/`) with `2025-04-01-preview` works for both files and jobs.
- **Tool calling eval must use per-example tools**: When evaluating tool-calling models, use the `tools` field from each test example — NOT a hardcoded global tool list. DD generates different tool schemas per training scenario.
- **Vision FT training data is large**: Base64-encoded JPEG images produce ~80KB per training example. A 2,000-example vision dataset is ~165MB. File upload may timeout — consider splitting into chunks or using the REST API with longer timeouts.
- **Vision FT requires image-capable models**: Only gpt-4o and gpt-4.1 support vision fine-tuning. gpt-4.1-mini and gpt-4.1-nano do NOT support image inputs for fine-tuning.
- **ChartQA dataset filtering**: HuggingFaceM4/ChartQA contains both human-labeled and machine-labeled examples. Filter to `human_or_machine == 0` (human) for higher quality. The `label` column may be a list — extract the first element.
- **Classification FT: Small OSS models can't memorize large label sets**: Small models (3B parameters) fail at many-class classification (50+ classes) — they invent synonym labels instead of learning the exact vocabulary. Increasing training data does not help; this is a model capacity limit. Larger models (20B+) perform significantly better. For classification with many classes, use ≥20B models or reduce label count.
- **Classification eval MUST include the system prompt**: Training data with a system prompt ("You are a classifier...") teaches the model to output labels. Without the same system prompt at eval time, the FT model reverts to generic helpful assistant behavior (0% accuracy). Always replay the exact system prompt from training data.


# What to Expect by Training Type

These patterns are based on extensive end-to-end testing across SFT, DPO, and RFT.

## SFT Distillation (Most Reliable)

- **Teacher→student distillation** (e.g., mini→nano) typically achieves 58–100% teacher gap closure with 200–300 examples and 2 epochs
- Fine-tuned small models can sometimes **surpass the teacher** on tasks with clear input→output patterns (summarization, entity extraction, code generation)
- **Pattern tasks distill best**: Code generation, PII redaction, and structured extraction show the highest gap closure
- Tasks requiring open-ended reasoning or alignment show weaker distillation results

## DPO (Use With Caution)

- **DPO fails when the base model is already strong.** If the base model scores >4.5/5 on your task, DPO will likely degrade quality rather than improve it
- DPO is prone to **degeneration** (repetitive/garbage output), especially on sensitive topics — even at epoch 1
- **When DPO helps**: The base model has a clear quality gap on your task, and you have well-differentiated preference pairs

## RFT (For Verifiable Tasks)

- RFT works best for tasks with **verifiable answers**: math, code with test suites, structured output with exact-match grading
- Typical improvement: +10 percentage points on exact-match accuracy for math/reasoning tasks
- **The grader matters more than hyperparameters** — invest in grader quality before tuning LR/epochs
- See `references/reward-hacking-prevention.md` for the #1 RFT failure mode

## Common Pitfalls

| Pitfall | What happens | Fix |
|---------|-------------|-----|
| Skipping baseline evaluation | You can't measure improvement | Always evaluate the base model first |
| Too few examples (<100) | Model learns format but not domain knowledge | Use 200–500 examples minimum |
| DPO on strong base model | Quality degrades | Use SFT instead, or skip fine-tuning |
| Misaligned RFT grader | Reward hacking — model games the grader | Use same grading logic for training and eval |
| Small OSS models on large label sets | Model invents synonym labels (capacity limit) | Use ≥20B parameter models for 50+ classes |


