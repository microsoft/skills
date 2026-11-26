# /// script
# dependencies = [
#   "openai>=1.0",
#   "requests",
#   "azure-identity",
#   "azure-ai-projects",
# ]
# ///
"""
submit_training.py — Submit SFT, DPO, or RFT training jobs on Microsoft Foundry.

Handles both SDK and REST API submission (REST fallback for OSS models).
Supports /v1/ project endpoint (preferred) and Azure endpoint (fallback).

Usage:
  python submit_training.py --base-url https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1/ \
      --api-key KEY --training-file training.jsonl --validation-file validation.jsonl \
      --model gpt-4.1-mini --type sft --epochs 2 --lr 1.0

  python submit_training.py --endpoint https://<resource>.openai.azure.com --api-key KEY \
      --training-file-id file-abc123 --validation-file-id file-def456 \
      --model gpt-oss-20b --type sft --epochs 2 --lr 0.5 --use-rest

  python submit_training.py --base-url <url> --api-key KEY \
      --training-file-id file-abc123 --validation-file-id file-def456 \
      --model o4-mini-2025-04-16 --type rft --grader-file grader.py
"""

import json
import os
import sys


try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass  # Stream not reconfigurable (older Python or non-tty); default encoding is fine
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HelpOnErrorParser, _validate_azure_endpoint, get_clients, upload_file

import requests


def submit_sft_sdk(client, model, train_id, val_id, epochs=2, lr=1.0, batch_size=None, suffix=None, training_type="globalStandard"):
    """Submit SFT job using the Python SDK."""
    hp = {"n_epochs": epochs, "learning_rate_multiplier": lr}
    if batch_size:
        hp["batch_size"] = batch_size

    kwargs = dict(
        model=model,
        training_file=train_id,
        validation_file=val_id,
        method={"type": "supervised"},
        hyperparameters=hp,
        # Azure-specific: passed via extra_body since the OpenAI SDK has no
        # top-level trainingType kwarg.
        extra_body={"trainingType": training_type},
    )
    if suffix:
        kwargs["suffix"] = suffix

    job = client.fine_tuning.jobs.create(**kwargs)
    return {"id": job.id, "status": job.status, "model": model, "method": "sdk"}


def submit_sft_rest(endpoint, api_key, model, train_id, val_id, epochs=2, lr=1.0, batch_size=None, suffix=None, training_type="globalStandard"):
    """Submit SFT job via REST API (fallback for models like gpt-oss-20b)."""
    _validate_azure_endpoint(endpoint, "endpoint")
    url = f"{endpoint}/openai/fine_tuning/jobs?api-version=2025-04-01-preview"
    body = {
        "model": model,
        "training_file": train_id,
        "validation_file": val_id,
        "method": {"type": "supervised"},
        "hyperparameters": {"n_epochs": epochs, "learning_rate_multiplier": lr},
        "trainingType": training_type,
    }
    if batch_size:
        body["hyperparameters"]["batch_size"] = batch_size
    if suffix:
        body["suffix"] = suffix

    resp = requests.post(url, headers={
        "Content-Type": "application/json",
        "api-key": api_key,
    }, json=body, timeout=(10, 60), allow_redirects=False)

    if resp.status_code in (200, 201):
        try:
            data = resp.json()
        except ValueError:
            raise RuntimeError(
                f"REST submission returned {resp.status_code} but body was not JSON: {resp.text[:200]}"
            )
        if "id" not in data or "status" not in data:
            raise RuntimeError(f"REST response missing 'id' or 'status' fields: {data}")
        return {"id": data["id"], "status": data["status"], "model": model, "method": "rest"}
    else:
        try:
            err_msg = resp.json().get('error', {}).get('message', 'Unknown error')
        except (ValueError, KeyError):
            err_msg = resp.text[:200] if resp.text else "Unknown error"
        raise RuntimeError(
            f"REST submission failed ({resp.status_code}): {err_msg}"
        )


def submit_rft(client, model, train_id, val_id, grader_source):
    """Submit RFT job."""
    job = client.fine_tuning.jobs.create(
        model=model,
        training_file=train_id,
        validation_file=val_id,
        method={
            "type": "reinforcement",
            "reinforcement": {
                "grader": {
                    "type": "python",
                    "name": "custom_grader",
                    "source": grader_source,
                },
            },
        },
    )
    return {"id": job.id, "status": job.status, "model": model, "method": "sdk-rft"}


def submit_dpo(client, model, train_id, val_id, epochs=2, lr=1.0, beta=0.1, suffix=None):
    """Submit DPO job."""
    job = client.fine_tuning.jobs.create(
        model=model,
        training_file=train_id,
        validation_file=val_id,
        suffix=suffix or None,
        method={
            "type": "dpo",
            "dpo": {
                "hyperparameters": {
                    "n_epochs": epochs,
                    "beta": beta,
                    "learning_rate_multiplier": lr,
                },
            },
        },
    )
    return {"id": job.id, "status": job.status, "model": model, "method": "sdk-dpo"}


def main():
    parser = HelpOnErrorParser(description="Submit fine-tuning jobs on Microsoft Foundry")
    parser.add_argument("--base-url", default=os.environ.get("OPENAI_BASE_URL"),
                        help="Project /v1/ URL (preferred)")
    parser.add_argument("--endpoint", default=os.environ.get("AZURE_OPENAI_ENDPOINT"),
                        help="Azure OpenAI endpoint (fallback)")
    parser.add_argument("--project-endpoint", default=os.environ.get("AZURE_AI_PROJECT_ENDPOINT"),
                        help="Azure AI project endpoint (Foundry SDK)")
    parser.add_argument("--api-key", default=os.environ.get("AZURE_OPENAI_API_KEY"),
                        help="API key")
    parser.add_argument("--model", required=True, help="Base model name (e.g., gpt-4.1-mini)")
    parser.add_argument("--type", choices=["sft", "dpo", "rft"], default="sft",
                        help="Training type: sft, dpo, or rft")

    # Data files — either paths (will upload) or IDs (already uploaded)
    parser.add_argument("--training-file", help="Path to training JSONL file (will upload)")
    parser.add_argument("--validation-file", help="Path to validation JSONL file (will upload)")
    parser.add_argument("--training-file-id", help="Already-uploaded training file ID")
    parser.add_argument("--validation-file-id", help="Already-uploaded validation file ID")

    # Hyperparameters
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--lr", type=float, default=1.0, help="Learning rate multiplier")
    parser.add_argument("--batch-size", type=int, default=None)
    parser.add_argument("--suffix", help="Model suffix for identification")

    # DPO-specific
    parser.add_argument("--beta", type=float, default=0.1, help="DPO beta (alignment strength)")

    # RFT-specific
    parser.add_argument("--grader-file", help="Path to Python grader file (for RFT)")

    # REST fallback
    parser.add_argument("--use-rest", action="store_true",
                        help="Force REST API (needed for gpt-oss-20b and other OSS models)")
    parser.add_argument("--training-type", choices=["globalStandard", "developerTier", "standard"],
                        default="globalStandard",
                        help="Azure training tier (default: globalStandard). developerTier is ~50%% off "
                             "globalStandard with lower quotas. OSS models (gpt-oss-20b, Ministral, "
                             "Llama, Qwen) only support globalStandard.")

    args = parser.parse_args()

    client, method = get_clients(
        base_url=args.base_url, azure_endpoint=args.endpoint,
        project_endpoint=args.project_endpoint, api_key=args.api_key
    )

    # Resolve file IDs
    train_id = args.training_file_id
    val_id = args.validation_file_id
    if args.training_file:
        train_id = upload_file(client, args.training_file)
    if args.validation_file:
        val_id = upload_file(client, args.validation_file)

    if not train_id or not val_id:
        print("Error: Provide training and validation file paths or IDs")
        sys.exit(1)

    # Submit
    if args.type == "rft":
        if not args.grader_file:
            print("Error: --grader-file required for RFT")
            sys.exit(1)
        with open(args.grader_file, encoding="utf-8") as f:
            grader_source = f.read()
        result = submit_rft(client, args.model, train_id, val_id, grader_source)
    elif args.type == "dpo":
        result = submit_dpo(client, args.model, train_id, val_id,
                            args.epochs, args.lr, args.beta, args.suffix)
    elif args.use_rest:
        if not args.endpoint or not args.api_key:
            print("Error: --use-rest requires --endpoint and --api-key (REST does not support DefaultAzureCredential)")
            sys.exit(1)
        result = submit_sft_rest(args.endpoint, args.api_key, args.model,
                                 train_id, val_id, args.epochs, args.lr, args.batch_size, args.suffix,
                                 args.training_type)
    else:
        # SFT via SDK with REST fallback for OSS models
        try:
            result = submit_sft_sdk(client, args.model, train_id, val_id,
                                    args.epochs, args.lr, args.batch_size, args.suffix,
                                    args.training_type)
        except Exception as e:
            err_str = str(e).lower()
            # Match a wider set of "use REST instead" signals than the original
            # exact-string comparison: Azure changes error text periodically.
            if ("trainingtype" in err_str
                    or "globalstandard" in err_str
                    or "global_standard" in err_str
                    or "does not support fine-tuning" in err_str):
                if not args.endpoint or not args.api_key:
                    print(f"SDK failed for {args.model}. REST fallback requires --endpoint and --api-key.")
                    sys.exit(1)
                print(f"SDK failed for {args.model}, falling back to REST API...")
                result = submit_sft_rest(args.endpoint, args.api_key, args.model,
                                         train_id, val_id, args.epochs, args.lr, args.batch_size, args.suffix,
                                         args.training_type)
            else:
                raise

    print(f"\nJob submitted successfully:")
    print(json.dumps(result, indent=2))

    # Save job info
    outfile = f"ft_job_{result['id']}.json"
    with open(outfile, "w", encoding="utf-8") as f:
        json.dump({**result, "epochs": args.epochs, "lr": args.lr,
                    "batch_size": args.batch_size, "train_file": train_id,
                    "val_file": val_id}, f, indent=2)
    print(f"Job info saved to {outfile}")


if __name__ == "__main__":
    main()
