"""
common.py — Shared Azure AI Foundry authentication and client setup.

Supports three connection methods in order of preference:
1. /v1/ project endpoint (simplest, preferred)
2. Foundry SDK with DefaultAzureCredential (no API key needed, cloud-native)
3. Azure OpenAI endpoint (classic)

Usage:
    from common import get_clients, upload_file

    # Method 1: Project /v1/ endpoint (preferred)
    clients = get_clients(base_url="https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1/",
                          api_key="KEY")

    # Method 2: Foundry SDK (DefaultAzureCredential — no API key needed)
    clients = get_clients(project_endpoint="https://<resource>.services.ai.azure.com/api/projects/<project>")

    # Method 3: Azure OpenAI endpoint
    clients = get_clients(azure_endpoint="https://<resource>.openai.azure.com",
                          api_key="KEY")
"""
import argparse
import os
import sys


class HelpOnErrorParser(argparse.ArgumentParser):
    """ArgumentParser that prints full help when arguments are invalid.
    
    Standard ArgumentParser only prints a one-line usage summary on error,
    which isn't helpful for first-time users. This prints the full --help.
    """

    def error(self, message):
        self.print_help(sys.stderr)
        self.exit(2, f"\nerror: {message}\n")


def get_clients(base_url=None, azure_endpoint=None, project_endpoint=None, api_key=None):
    """Initialize and return OpenAI-compatible client.

    Tries in order:
    1. Project /v1/ endpoint with openai.OpenAI() (simplest, preferred)
    2. Foundry SDK with AIProjectClient.get_openai_client() (no API key needed)
    3. Azure OpenAI endpoint with openai.AzureOpenAI() (classic)

    Returns: (openai_client, method_name)
    """
    # Method 1: /v1/ project endpoint
    base_url = base_url or os.environ.get("OPENAI_BASE_URL")
    api_key = api_key or os.environ.get("AZURE_OPENAI_API_KEY")

    if base_url:
        import openai
        # If no API key, try DefaultAzureCredential for token-based auth
        if not api_key:
            try:
                from azure.identity import DefaultAzureCredential
                credential = DefaultAzureCredential()
                token = credential.get_token("https://cognitiveservices.azure.com/.default")
                client = openai.OpenAI(base_url=base_url, api_key=token.token)
                print(f"✅ Connected via /v1/ project endpoint (DefaultAzureCredential)")
                return client, "project-v1-aad"
            except Exception as e:
                print(f"⚠️ No API key and DefaultAzureCredential failed: {e}")
                # Fall through to Method 2/3
        else:
            client = openai.OpenAI(base_url=base_url, api_key=api_key)
            print(f"✅ Connected via /v1/ project endpoint")
            return client, "project-v1"

    # Method 2: Foundry SDK
    project_endpoint = project_endpoint or os.environ.get("AZURE_AI_PROJECT_ENDPOINT")
    if project_endpoint:
        try:
            from azure.ai.projects import AIProjectClient
            from azure.identity import DefaultAzureCredential

            credential = DefaultAzureCredential()
            project_client = AIProjectClient(endpoint=project_endpoint, credential=credential)
            openai_client = project_client.get_openai_client()
            print(f"✅ Connected via Foundry SDK")
            return openai_client, "foundry-sdk"
        except Exception as e:
            print(f"⚠️ Foundry SDK failed: {e}")

    # Method 3: Azure OpenAI endpoint
    azure_endpoint = azure_endpoint or os.environ.get("AZURE_OPENAI_ENDPOINT")
    if azure_endpoint and api_key:
        import openai
        client = openai.AzureOpenAI(
            azure_endpoint=azure_endpoint,
            api_key=api_key,
            api_version="2025-04-01-preview",
        )
        print(f"✅ Connected via Azure OpenAI endpoint")
        return client, "azure-openai"

    print("❌ No valid connection method. Set one of:")
    print("   OPENAI_BASE_URL (preferred)")
    print("   AZURE_AI_PROJECT_ENDPOINT (Foundry SDK)")
    print("   AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY")
    sys.exit(1)


def upload_file(openai_client, filepath: str, purpose: str = "fine-tune") -> str:
    """Upload a JSONL file to Azure AI Foundry and wait for processing.
    
    Automatically uses the chunked Uploads API for files >100MB,
    since the standard files.create() silently fails on large files.
    
    Note: For files >100MB, the client must be an openai.AzureOpenAI instance
    (not openai.OpenAI with a /v1/ URL). The /v1/ project endpoint does not
    support the Uploads API.
    """
    import os
    file_size = os.path.getsize(filepath)
    
    if file_size > 100 * 1024 * 1024:  # >100MB — safety margin below the ~150MB silent failure
        # Verify client type: Uploads API requires AzureOpenAI, not OpenAI with /v1/ URL
        import openai
        if not isinstance(openai_client, openai.AzureOpenAI):
            raise TypeError(
                f"Large file upload ({file_size / 1024 / 1024:.0f} MB) requires an "
                f"openai.AzureOpenAI client, but got {type(openai_client).__name__}. "
                f"The /v1/ project endpoint does not support the Uploads API. "
                f"Use get_clients(azure_endpoint=...) instead."
            )
        return _upload_large_file(openai_client, filepath, file_size, purpose)
    
    print(f"📤 Uploading {filepath}...")
    with open(filepath, "rb") as f:
        file_obj = openai_client.files.create(file=f, purpose=purpose)
    print(f"   File ID: {file_obj.id}")
    print(f"   Waiting for processing...")
    openai_client.files.wait_for_processing(file_obj.id)
    print(f"   ✅ File ready")
    return file_obj.id


def _upload_large_file(
    openai_client, filepath: str, file_size: int, purpose: str = "fine-tune",
    chunk_size: int = 64 * 1024 * 1024,
) -> str:
    """Upload a large JSONL file using the chunked Uploads API.

    The standard files.create() silently fails on files over ~150MB.
    We trigger this path at 100MB as a safety margin. This uses the
    Uploads API to split the file into chunks:
      1. POST /uploads          — create upload session
      2. POST /uploads/{id}/parts — upload each chunk
      3. POST /uploads/{id}/complete — finalize and get file ID

    Requires AzureOpenAI client (not the /v1/ project endpoint).

    Args:
        openai_client: An openai.AzureOpenAI client instance.
        filepath: Path to the file to upload.
        file_size: Size of the file in bytes.
        purpose: Upload purpose (default "fine-tune").
        chunk_size: Size of each chunk in bytes (default 64MB).

    Returns:
        The file ID to use for fine-tuning.

    Raises:
        RuntimeError: If any upload step fails or processing times out.
    """
    import math
    import time

    filename = os.path.basename(filepath)
    n_chunks = math.ceil(file_size / chunk_size)
    print(f"📤 Large file upload: {filename} ({file_size / 1024 / 1024:.1f} MB, {n_chunks} chunks)")

    # Step 1: Create upload session
    upload = openai_client.uploads.create(
        filename=filename,
        purpose=purpose,
        bytes=file_size,
        mime_type="application/jsonl",
    )
    upload_id = upload.id
    print(f"   Upload session: {upload_id}")

    # Step 2: Upload chunks
    part_ids = []
    with open(filepath, "rb") as f:
        for i in range(n_chunks):
            chunk = f.read(chunk_size)
            print(f"   Part {i + 1}/{n_chunks} ({len(chunk) / 1024 / 1024:.1f} MB)...", end=" ", flush=True)
            try:
                part = openai_client.uploads.parts.create(upload_id=upload_id, data=chunk)
                part_ids.append(part.id)
                print("✓")
            except Exception as e:
                print(f"✗ {e}")
                try:
                    openai_client.uploads.cancel(upload_id=upload_id)
                except Exception:
                    pass
                raise RuntimeError(f"Chunk upload failed at part {i + 1} (upload_id={upload_id}): {e}") from e

    # Step 3: Complete upload
    print(f"   Completing upload...", end=" ", flush=True)
    try:
        completed = openai_client.uploads.complete(upload_id=upload_id, part_ids=part_ids)
    except Exception as e:
        try:
            openai_client.uploads.cancel(upload_id=upload_id)
        except Exception:
            pass
        raise RuntimeError(f"Upload completion failed (upload_id={upload_id}): {e}") from e

    file_id = completed.file.id if completed.file else None
    if not file_id:
        raise RuntimeError(f"Upload completed but no file ID returned (upload_id={upload_id})")
    print(f"✓ File ID: {file_id}")

    # Step 4: Wait for processing
    print(f"   Waiting for processing...")
    for _ in range(120):
        info = openai_client.files.retrieve(file_id)
        if info.status == "processed":
            print(f"   ✅ File ready")
            return file_id
        if info.status == "error":
            details = getattr(info, "status_details", None) or "no details"
            raise RuntimeError(f"File processing error: {details}")
        time.sleep(10)

    raise RuntimeError(
        f"File processing timed out after 20 minutes (file_id={file_id}, "
        f"last status={info.status}). Check the Azure portal for status."
    )


def get_env(key: str, required: bool = True) -> str:
    """Get environment variable, exit if required and missing."""
    value = os.environ.get(key)
    if required and not value:
        print(f"❌ Environment variable {key} not set.")
        sys.exit(1)
    return value or ""
