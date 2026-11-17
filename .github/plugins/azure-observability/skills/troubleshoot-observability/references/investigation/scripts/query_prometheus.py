#!/usr/bin/env python3
"""Query an Azure Monitor workspace Prometheus endpoint with Azure CLI identity."""

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request


PROMETHEUS_AUDIENCE = "https://prometheus.monitor.azure.com"
WORKSPACE_API_VERSION = "2023-04-03"
MAX_RESPONSE_BYTES = 8 * 1024 * 1024
WORKSPACE_PATTERN = re.compile(
    r"/subscriptions/[0-9a-f-]{36}/resourceGroups/[^/]+"
    r"/providers/Microsoft\.Monitor/accounts/[^/]+",
    re.IGNORECASE,
)


class QueryError(RuntimeError):
    """Raised when endpoint discovery, authentication, or querying fails."""


def redact(value):
    value = re.sub(r"(?i)Bearer\s+\S+", "[REDACTED]", str(value))
    return re.sub(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+",
                  "[REDACTED JWT]", value)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def azure_cli_command(az_path, arguments):
    command = [az_path, *arguments]
    if os.name != "nt" or not az_path.lower().endswith((".bat", ".cmd")):
        return command
    bundled_python = Path(az_path).resolve().parent.parent / "python.exe"
    if bundled_python.is_file():
        return [str(bundled_python), "-IBm", "azure.cli", *arguments]
    return [os.environ.get("COMSPEC", "cmd.exe"), "/d", "/c", *command]


def run_az(arguments, timeout=45):
    az_path = shutil.which("az")
    if not az_path:
        raise QueryError("Azure CLI is not installed in this execution environment.")
    try:
        result = subprocess.run(
            azure_cli_command(az_path, arguments),
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, "AZURE_EXTENSION_USE_DYNAMIC_INSTALL": "no"},
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        raise QueryError("Azure CLI invocation failed or timed out.") from exc
    if result.returncode:
        detail = redact(result.stderr or result.stdout).strip()[:2000]
        raise QueryError("Azure CLI request failed: " + detail)
    try:
        return json.loads(result.stdout)
    except ValueError as exc:
        raise QueryError("Azure CLI returned malformed JSON.") from exc


def validate_endpoint(value):
    try:
        parsed = urllib.parse.urlparse(value.rstrip("/"))
        port = parsed.port
    except (ValueError, AttributeError) as exc:
        raise QueryError("Prometheus endpoint is malformed.") from exc
    if parsed.scheme != "https" or not parsed.hostname:
        raise QueryError("Prometheus endpoint must be HTTPS.")
    hostname = parsed.hostname.lower()
    if hostname != "prometheus.monitor.azure.com" and not hostname.endswith(
        ".prometheus.monitor.azure.com"
    ):
        raise QueryError("Endpoint must be an Azure Monitor Prometheus endpoint.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment or port not in (None, 443):
        raise QueryError("Endpoint must not contain credentials, a query, or a fragment.")
    return value.rstrip("/")


def discover_endpoint(workspace_resource_id):
    if not WORKSPACE_PATTERN.fullmatch(workspace_resource_id):
        raise QueryError("Provide a complete Microsoft.Monitor/accounts resource ID.")
    encoded_id = urllib.parse.quote(workspace_resource_id, safe="/")
    url = (
        f"https://management.azure.com{encoded_id}"
        f"?api-version={WORKSPACE_API_VERSION}"
    )
    workspace = run_az(["rest", "--method", "get", "--url", url, "--output", "json"])
    try:
        endpoint = workspace["properties"]["metrics"]["prometheusQueryEndpoint"]
    except (KeyError, TypeError) as exc:
        raise QueryError("Azure Monitor workspace has no Prometheus query endpoint.") from exc
    return validate_endpoint(endpoint)


def acquire_token():
    response = run_az(
        [
            "account",
            "get-access-token",
            "--resource",
            PROMETHEUS_AUDIENCE,
            "--output",
            "json",
        ]
    )
    token = response.get("accessToken") if isinstance(response, dict) else None
    if not isinstance(token, str) or not token:
        raise QueryError("Azure CLI returned no usable Prometheus access token.")
    return token


def validate_query(query):
    if not isinstance(query, str) or not query.strip():
        raise QueryError("PromQL query must not be empty.")
    if len(query) > 4000:
        raise QueryError("PromQL query exceeds 4000 characters.")
    if re.search(r"__name__\s*(?:=~|!~)", query):
        raise QueryError(
            "Azure Monitor Prometheus does not support regex matchers on __name__; "
            "query explicit metric names with equality instead."
        )
    return query.strip()


def query_url(endpoint, query, time=None, start=None, end=None, step=None):
    query = validate_query(query)
    if start or end:
        if not all((start, end, step)):
            raise QueryError("Range queries require --start, --end, and --step.")
        path = "/api/v1/query_range"
        parameters = {"query": query, "start": start, "end": end, "step": step}
        mode = "range"
    else:
        path = "/api/v1/query"
        parameters = {"query": query}
        if time:
            parameters["time"] = time
        mode = "instant"
    return f"{endpoint}{path}?{urllib.parse.urlencode(parameters)}", mode


def execute_query(endpoint, query, time=None, start=None, end=None, step=None, timeout=60):
    endpoint = validate_endpoint(endpoint)
    if not 1 <= timeout <= 120:
        raise QueryError("Timeout must be 1-120 seconds.")
    if start or end:
        def instant(value):
            try:
                return float(value)
            except (ValueError, TypeError):
                try:
                    timestamp = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
                    if timestamp.tzinfo is None:
                        raise ValueError()
                    return timestamp.timestamp()
                except (ValueError, TypeError, AttributeError) as exc:
                    raise QueryError("Range times must be epoch seconds or timezone-qualified ISO-8601.") from exc
        if not start or not end or not 0 < instant(end) - instant(start) <= 3600:
            raise QueryError("Range must be positive and at most one hour.")
    url, mode = query_url(endpoint, query, time, start, end, step)
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {acquire_token()}",
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=timeout) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise QueryError("Prometheus response exceeds 8 MiB; evidence is incomplete.")
            payload = json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = redact(exc.read(2000).decode("utf-8", errors="replace"))
        raise QueryError(f"Prometheus API returned HTTP {exc.code}: {detail}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise QueryError("Prometheus API request failed or timed out.") from exc
    except (ValueError, UnicodeError) as exc:
        raise QueryError("Prometheus API returned malformed JSON.") from exc
    if not isinstance(payload, dict) or payload.get("status") != "success":
        raise QueryError("Prometheus API returned a non-success response.")
    data = payload.get("data")
    if not isinstance(data, dict) or not isinstance(data.get("result"), list):
        raise QueryError("Prometheus API returned malformed data.")
    if len(data["result"]) > 50:
        raise QueryError("Prometheus response exceeds 50 series; evidence is incomplete.")
    for series in data["result"]:
        if (not isinstance(series, dict) or not isinstance(series.get("values", []), list)
                or len(series.get("values", [])) > 3600):
            raise QueryError("Prometheus series is malformed or exceeds 3600 points.")
    return {
        "ok": True,
        "mode": mode,
        "endpoint": endpoint,
        "data": payload.get("data"),
        "warnings": payload.get("warnings", []),
    }


def build_parser():
    parser = argparse.ArgumentParser(
        description="Query Azure Monitor managed Prometheus with Azure CLI identity."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--workspace-resource-id")
    source.add_argument("--endpoint")
    parser.add_argument("--query", required=True)
    parser.add_argument("--time")
    parser.add_argument("--start")
    parser.add_argument("--end")
    parser.add_argument("--step")
    parser.add_argument("--timeout", type=int, default=60)
    return parser


def main():
    args = build_parser().parse_args()
    try:
        endpoint = (
            discover_endpoint(args.workspace_resource_id)
            if args.workspace_resource_id
            else validate_endpoint(args.endpoint)
        )
        result = execute_query(
            endpoint,
            args.query,
            time=args.time,
            start=args.start,
            end=args.end,
            step=args.step,
            timeout=args.timeout,
        )
        print(json.dumps(result, indent=2))
        return 0
    except QueryError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
