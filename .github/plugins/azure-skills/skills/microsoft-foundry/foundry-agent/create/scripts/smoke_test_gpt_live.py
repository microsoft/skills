"""Smoke-test a deployed Microsoft Foundry GPT-Live Voice Agent.

Exit codes:
  0: passed, help, or dry-run
  1: dependency, authentication, protocol, or validation failure
  2: usage or argument validation error
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass, field
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from smoke_test_voice import acquire_token, positive_integer

API_VERSION = "v1"
PREVIEW_HEADER = "VoiceAgents=V1Preview"


class SmokeError(Exception):
    pass


@dataclass
class Evidence:
    event_types: list[str] = field(default_factory=list)
    closed: bool = False
    close_reason: str = ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Smoke-test a deployed Microsoft Foundry GPT-Live Voice Agent."
    )
    parser.add_argument("--endpoint", required=True, help="Foundry project endpoint")
    parser.add_argument("--agent-name", required=True, help="GPT-Live agent name")
    parser.add_argument("--timeout", type=positive_integer, default=180)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.endpoint.strip() or not args.agent_name.strip():
        parser.error("--endpoint and --agent-name must not be empty")
    return args


def normalize_endpoint(value: str) -> str:
    parsed = urlsplit(value.strip())
    path = parsed.path.rstrip("/")
    project = path.removeprefix("/api/projects/")
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or not path.startswith("/api/projects/")
        or not project
        or "/" in project
    ):
        raise SmokeError(
            "--endpoint must be an HTTPS Foundry project endpoint ending in "
            "/api/projects/<project>, without credentials, query, or fragment"
        )
    return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


def websocket_url(endpoint: str, agent: str) -> str:
    parsed = urlsplit(endpoint)
    path = (
        f"{parsed.path}/agents/{quote(agent, safe='')}"
        "/endpoint/protocols/voice/live/sessions"
    )
    return urlunsplit(("wss", parsed.netloc, path, f"api-version={API_VERSION}", ""))


def fetch_json(url: str, token: str) -> dict[str, object]:
    request = Request(
        url,
        headers={
            "Authorization": "{} {}".format("Bearer", token),
            "Foundry-Features": PREVIEW_HEADER,
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SmokeError(f"HTTP {exc.code}: {body}") from exc
    except (URLError, OSError, json.JSONDecodeError) as exc:
        raise SmokeError(f"Foundry request failed: {exc}") from exc


def resolve_agent(endpoint: str, agent: str, token: str) -> tuple[str, str, str]:
    agent_url = f"{endpoint}/agents/{quote(agent, safe='')}"
    payload = fetch_json(f"{agent_url}?api-version={API_VERSION}", token)
    versions = payload.get("versions")
    latest = versions.get("latest") if isinstance(versions, dict) else None
    definition = latest.get("definition") if isinstance(latest, dict) else None
    if not isinstance(definition, dict):
        raise SmokeError("Agent response did not include versions.latest.definition")
    if definition.get("sub_protocol") != "live" or definition.get(
        "model_type"
    ) != "self_deployed":
        raise SmokeError(
            "Agent must use sub_protocol=live and model_type=self_deployed"
        )
    model = definition.get("model")
    if not isinstance(model, str) or not model.strip():
        raise SmokeError("Agent definition must reference a model deployment")
    version = str(latest.get("version", "")).strip()
    if not version:
        raise SmokeError("Agent response did not include the latest version")
    return agent_url, version, model.strip()


async def receive(events: object, evidence: Evidence) -> None:
    async for event in events:
        kind = event.type
        evidence.event_types.append(kind)
        if kind == "error":
            raise SmokeError(f"GPT-Live error: {event.error.message}")
        if kind == "session.closed":
            evidence.close_reason = event.reason
            if event.reason != "close_requested":
                raise SmokeError(
                    "GPT-Live session closed unexpectedly: "
                    f"{event.reason}"
                )
            evidence.closed = True
            return
    raise SmokeError("WebSocket ended without session.closed")


async def run_smoke(args: argparse.Namespace, endpoint: str) -> int:
    try:
        import openai
        from openai import AsyncOpenAI
    except ImportError as exc:
        raise SmokeError(
            f"Missing GPT-Live SDK dependency ({exc}). Install with: "
            'python -m pip install "openai[realtime]==3.19.2"'
        ) from exc
    if openai.__version__ != "3.19.2":
        raise SmokeError(
            "GPT-Live smoke testing requires openai[realtime]==3.19.2"
        )

    token = acquire_token()
    agent_url, version, model = resolve_agent(endpoint, args.agent_name, token)
    evidence = Evidence()

    async with asyncio.timeout(args.timeout):
        async with AsyncOpenAI(
            api_key=token,
            base_url=f"{agent_url}/endpoint/protocols/voice",
            max_retries=0,
        ) as client:
            async with client.live.connect(
                extra_headers={"Foundry-Features": PREVIEW_HEADER},
                extra_query={
                    "api-version": API_VERSION,
                    "x-agent-version-override": version,
                },
                max_retries=0,
                websocket_connection_options={
                    "open_timeout": 20,
                    "close_timeout": 5,
                    "max_size": 1024 * 1024,
                },
            ) as connection:
                events = connection.__aiter__()
                async for event in events:
                    evidence.event_types.append(event.type)
                    if event.type == "error":
                        raise SmokeError(f"GPT-Live startup error: {event.error.message}")
                    if event.type == "session.started":
                        break
                    if event.type == "session.closed":
                        raise SmokeError("Session closed before session.started")
                else:
                    raise SmokeError("WebSocket ended before session.started")

                receiver = asyncio.create_task(receive(events, evidence))
                try:
                    await connection.session.close()
                    await asyncio.gather(receiver)
                    if not evidence.closed:
                        raise SmokeError("Session did not emit session.closed")
                finally:
                    if not receiver.done():
                        receiver.cancel()
                    await asyncio.gather(receiver, return_exceptions=True)

    print(
        json.dumps(
            {
                "agent": args.agent_name,
                "agent_version": version,
                "model_deployment": model,
                "session_started": True,
                "session_closed": evidence.closed,
                "close_reason": evidence.close_reason,
                "event_types": evidence.event_types,
            },
            indent=2,
        )
    )
    return 0


def main() -> int:
    if sys.version_info < (3, 11):
        print("ERROR: Python 3.11 or later is required.", file=sys.stderr)
        return 1
    args = parse_args()
    try:
        endpoint = normalize_endpoint(args.endpoint)
        if args.dry_run:
            print("DRY-RUN: GPT-Live Voice Agent Smoke Test")
            print(f"  Project Endpoint : {endpoint}")
            print(f"  Agent Name       : {args.agent_name}")
            print(f"  WebSocket URL    : {websocket_url(endpoint, args.agent_name)}")
            print(f"  Timeout (s)      : {args.timeout}")
            print(f"  Header           : Foundry-Features: {PREVIEW_HEADER}")
            print("  Auth Resource    : https://ai.azure.com")
            return 0
        return asyncio.run(run_smoke(args, endpoint))
    except TimeoutError:
        print(f"ERROR: Timed out after {args.timeout}s.", file=sys.stderr)
        return 1
    except SmokeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(
            f"ERROR: Unexpected GPT-Live failure ({type(exc).__name__}): {exc}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
