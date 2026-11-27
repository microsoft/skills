"""
common.py — Shared Microsoft Foundry authentication and client setup.

Supports three connection methods in order of preference:
1. /v1/ project endpoint (simplest, preferred)
2. Foundry SDK with DefaultAzureCredential (no API key needed, cloud-native)
3. Azure OpenAI endpoint (classic)

AAD tokens are auto-refreshed via azure.identity for long-running scripts
(monitor_training.py, generate_distillation_data.py, etc.).

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
import re
import sys
from urllib.parse import urlsplit



try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass  # Stream not reconfigurable (older Python or non-tty); default encoding is fine
_AZURE_COGSERVICES_SCOPE = "https://cognitiveservices.azure.com/.default"
_AZURE_ENDPOINT_SUFFIXES = (".services.ai.azure.com", ".openai.azure.com")


class _EndpointValidationError(ValueError):
    pass


def _validate_azure_endpoint(endpoint, name="endpoint"):
    message = (
        f"{name} must be an HTTPS Microsoft Foundry or Azure OpenAI resource URL "
        "on port 443, without userinfo, query, or fragment."
    )
    if not isinstance(endpoint, str) or any(
        ord(char) <= 32 or ord(char) == 127 or char == "\\" for char in endpoint
    ):
        raise _EndpointValidationError(message)
    try:
        parsed = urlsplit(endpoint)
        hostname = parsed.hostname or ""
        port = parsed.port
    except ValueError as exc:
        raise _EndpointValidationError(message) from exc

    trusted_host = any(
        hostname.endswith(suffix)
        and re.fullmatch(
            r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?",
            hostname[:-len(suffix)],
        )
        for suffix in _AZURE_ENDPOINT_SUFFIXES
    )
    if (
        parsed.scheme != "https"
        or not trusted_host
        or port not in (None, 443)
        or parsed.username is not None
        or parsed.password is not None
        or "?" in endpoint
        or "#" in endpoint
    ):
        raise _EndpointValidationError(message)
    return parsed.scheme, hostname, 443 if port is None else port


def _check_request_origin(url, expected_origin):
    try:
        parsed = urlsplit(str(url))
        port = parsed.port
        origin = parsed.scheme, parsed.hostname, 443 if port is None else port
    except ValueError as exc:
        raise _EndpointValidationError("Invalid authenticated request URL.") from exc
    if (
        origin != expected_origin
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
    ):
        raise _EndpointValidationError(
            "Refusing to send credentials outside the configured Azure endpoint origin."
        )


def _make_http_client(origin, token_provider=None):
    import openai

    def check_request(request):
        _check_request_origin(request.url, origin)

    options = {
        "follow_redirects": False,
        "event_hooks": {"request": [check_request]},
    }
    if token_provider is not None:
        def authorize(request):
            check_request(request)
            request.headers["Authorization"] = f"Bearer {token_provider()}"
            return request
        options["auth"] = authorize

    client_type = getattr(openai, "DefaultHttpxClient", None)
    if client_type is None:
        # Older supported OpenAI SDKs do not export their default HTTP client.
        from httpx import Client
        client_type = Client
    return client_type(**options)


def _clamp_score(v, default=0):
    """Clamp a judge score to [1, 10]. Returns `default` for missing/non-numeric values.

    LLM judges occasionally return out-of-range integers (e.g., 15) or non-numeric
    strings ("high"). Without clamping, these distort aggregate scores or crash
    `int()`. We use 0 as a sentinel for "missing/failed" so callers can filter via
    `score > 0`.
    """
    if v is None:
        return default
    try:
        return max(1, min(10, int(v)))
    except (ValueError, TypeError):
        return default


class HelpOnErrorParser(argparse.ArgumentParser):
    """ArgumentParser that prints full help when arguments are invalid.
    
    Standard ArgumentParser only prints a one-line usage summary on error,
    which isn't helpful for first-time users. This prints the full --help.
    """

    def error(self, message):
        self.print_help(sys.stderr)
        self.exit(2, f"\nerror: {message}\n")


def _make_token_provider():
    """Create an auto-refreshing AAD token provider for long-running scripts.
    
    Returns a callable that the OpenAI SDK calls before each request to get
    a fresh token. Tokens are cached and refreshed ~5 min before expiry.
    """
    from azure.identity import DefaultAzureCredential
    credential = DefaultAzureCredential()

    def get_token():
        try:
            token = credential.get_token(_AZURE_COGSERVICES_SCOPE)
            return token.token
        except Exception as e:
            raise RuntimeError(
                f"Azure AD authentication failed: {e}\n"
                "Ensure you're logged in (az login) or have valid "
                "AZURE_CLIENT_ID/AZURE_TENANT_ID/AZURE_CLIENT_SECRET set."
            ) from e

    return get_token


def get_clients(base_url=None, azure_endpoint=None, project_endpoint=None, api_key=None):
    """Initialize and return OpenAI-compatible client.

    Tries in order:
    1. Project /v1/ endpoint with openai.OpenAI() (simplest, preferred)
    2. Foundry SDK with AIProjectClient.get_openai_client() (no API key needed)
    3. Azure OpenAI endpoint with openai.AzureOpenAI() (classic)

    When using DefaultAzureCredential (no API key), tokens are auto-refreshed
    so long-running scripts won't fail with 401 after ~60 min.

    Only public-cloud Microsoft Foundry and Azure OpenAI resource endpoints are
    supported. All configured endpoints are validated before acquiring credentials.

    Returns: (openai_client, method_name)
    """
    base_url = base_url or os.environ.get("OPENAI_BASE_URL")
    project_endpoint = project_endpoint or os.environ.get("AZURE_AI_PROJECT_ENDPOINT")
    azure_endpoint = azure_endpoint or os.environ.get("AZURE_OPENAI_ENDPOINT")
    api_key = api_key or os.environ.get("AZURE_OPENAI_API_KEY")
    origins = {
        name: _validate_azure_endpoint(endpoint, name)
        for name, endpoint in (
            ("base_url", base_url),
            ("project_endpoint", project_endpoint),
            ("azure_endpoint", azure_endpoint),
        )
        if endpoint
    }

    # Method 1: /v1/ project endpoint
    if base_url:
        import openai
        if not api_key:
            try:
                token_provider = _make_token_provider()
                token_provider()  # verify it works
                client = openai.OpenAI(
                    base_url=base_url,
                    api_key="aad",  # required by SDK but overridden by auth
                    http_client=_make_http_client(origins["base_url"], token_provider),
                )
                print(f"✅ Connected via /v1/ project endpoint (DefaultAzureCredential, auto-refresh)")
                return client, "project-v1-aad"
            except _EndpointValidationError:
                raise
            except Exception as e:
                print(f"⚠️ No API key and DefaultAzureCredential failed: {e}")
        else:
            client = openai.OpenAI(
                base_url=base_url,
                api_key=api_key,
                http_client=_make_http_client(origins["base_url"]),
            )
            print(f"✅ Connected via /v1/ project endpoint")
            return client, "project-v1"

    # Method 2: Foundry SDK
    if project_endpoint:
        try:
            from azure.ai.projects import AIProjectClient
            from azure.core.pipeline.policies import RedirectPolicy, SansIOHTTPPolicy
            from azure.identity import DefaultAzureCredential

            class _EndpointPolicy(SansIOHTTPPolicy):
                def on_request(self, request):
                    _check_request_origin(
                        request.http_request.url, origins["project_endpoint"],
                    )

            credential = DefaultAzureCredential()
            project_client = AIProjectClient(
                endpoint=project_endpoint,
                credential=credential,
                per_call_policies=[_EndpointPolicy()],
                redirect_policy=RedirectPolicy(permit_redirects=False),
            )
            openai_client = project_client.get_openai_client(
                http_client=_make_http_client(origins["project_endpoint"]),
            )
            try:
                _check_request_origin(openai_client.base_url, origins["project_endpoint"])
            except _EndpointValidationError:
                openai_client.close()
                raise
            print(f"✅ Connected via Foundry SDK")
            return openai_client, "foundry-sdk"
        except _EndpointValidationError:
            raise
        except Exception as e:
            print(f"⚠️ Foundry SDK failed: {e}")

    # Method 3: Azure OpenAI endpoint
    if azure_endpoint:
        import openai
        if api_key:
            client = openai.AzureOpenAI(
                azure_endpoint=azure_endpoint,
                api_key=api_key,
                api_version="2025-04-01-preview",
                http_client=_make_http_client(origins["azure_endpoint"]),
            )
            print(f"✅ Connected via Azure OpenAI endpoint")
            return client, "azure-openai"
        else:
            # No API key — use DefaultAzureCredential with auto-refresh
            try:
                token_provider = _make_token_provider()
                token_provider()  # verify it works
                client = openai.AzureOpenAI(
                    azure_endpoint=azure_endpoint,
                    azure_ad_token_provider=token_provider,
                    api_version="2025-04-01-preview",
                    http_client=_make_http_client(origins["azure_endpoint"]),
                )
                print(f"✅ Connected via Azure OpenAI endpoint (DefaultAzureCredential, auto-refresh)")
                return client, "azure-openai-aad"
            except _EndpointValidationError:
                raise
            except Exception as e:
                print(f"⚠️ DefaultAzureCredential failed for Azure endpoint: {e}")

    print("❌ No valid connection method. Set one of:")
    print("   OPENAI_BASE_URL (preferred)")
    print("   AZURE_AI_PROJECT_ENDPOINT (Foundry SDK)")
    print("   AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY")
    raise SystemExit(1)


def upload_file(openai_client, filepath: str, purpose: str = "fine-tune") -> str:
    """Upload a file to Microsoft Foundry and wait for processing."""
    print(f"📤 Uploading {filepath}...")
    with open(filepath, "rb") as f:
        file_obj = openai_client.files.create(file=f, purpose=purpose)
    print(f"   File ID: {file_obj.id}")
    print(f"   Waiting for processing...")
    openai_client.files.wait_for_processing(file_obj.id)
    print(f"   ✅ File ready")
    return file_obj.id
