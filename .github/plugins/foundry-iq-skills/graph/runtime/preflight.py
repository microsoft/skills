"""Prepare local graph-demo runtimes and check prerequisites; live inspection is explicit."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parent
DOMAINS = ("entity", "topicgraph", "ontology")
OPTIONAL_APPS = {"entity-apps", "entity-graph-apps", "foundry-iq-graph", "topicgraph-mcp", "topic-graph-mcp", "ontology-apps"}
TIMEOUT = 60
NATIVE_NEXT = (
    "TopicGraph native binary is not yet cached for this host. "
    "Run `topic-graph-build download-native` (or `topic-graph-build plan`) to review and approve "
    "downloading the latest release from Azure/foundry-iq-tool-releases, or pass --native-binary "
    "with the absolute path of a verified release binary."
)
SOURCE_NEXT = (
    "Search owns the generated Entity Graph schema; schema_org does not guarantee the Topic Graph source requirements. "
    "As soon as the physical content index exists, explicitly inspect it with --inspect-source "
    "and the Topic Graph source flags before advancing the demo or Topic Graph planning. Managed ingestion may "
    "already be running; this check does not pause or cancel it. Keep the original Entity Graph descriptor "
    "authoritative. The source needs a retrievable string key and stored, retrievable float32 vectors with an HNSW "
    "cosine or dotProduct profile (compression allowed). The "
    "TopicGraph executable's own preflight checks that it can read the original index. Never change the "
    "native executable/pins, fake metadata or rewrite historical plans. Cloud writes, native execution "
    "and publication retain their separate exact approval gates."
)
SOURCE_FLAGS = {
    "--tenant-id", "--subscription-id", "--resource-group", "--search-service",
    "--source-index", "--key-field", "--text-field", "--source-field", "--title-field",
    "--vector-field", "--embedding-model-id", "--dataset",
}

# Reuse the pinned wheel's policies, without starting native code or constructing write/state services.
NATIVE_CODE = """
import json,sys
from pathlib import Path
from topicgraph_adapters.native_runner import NativeRunner,compute_binary_sha256,get_host_rid
try:
    selected = sys.argv[1] or None
    if selected and (not Path(selected).is_absolute() or not Path(selected).is_file()):
        raise ValueError('Explicit native binary must be an existing absolute file; no fallback.')
    path = NativeRunner(binary_path=selected).resolve_and_verify()
    if selected and path != Path(selected).resolve():
        raise ValueError('Explicit native binary was not selected; no fallback.')
    sha = compute_binary_sha256(path)
    print(json.dumps({'status':'ready','path':str(path),'sha256':sha,'rid':get_host_rid()}))
except Exception as exc:
    print(json.dumps({'status':'blocked','error_code':getattr(exc,'code',type(exc).__name__),'detail':str(exc)}))
    sys.exit(1)
"""
SOURCE_CODE = """
import json,sys
from topicgraph_build.cli import _parser,LIVE_REQUIRED
from topicgraph_build.live import create_live_store
try:
    args = _parser().parse_args([*sys.argv[1:],'inspect'])
    missing = [name for name in LIVE_REQUIRED if not getattr(args,name)]
    if missing:
        raise ValueError('Missing explicit source flags: '+', '.join(missing))
    store,source,_ = create_live_store(args)
    observed = store.inspect(source)
    print(json.dumps({'status':'verified','source_index':source.index,
        'definition_fingerprint':observed['definition_fingerprint'],
        'source_binding':store.source_binding(observed)}))
except Exception as exc:
    code = getattr(exc,'code',type(exc).__name__)
    detail = (str(exc) if getattr(exc,'code',None) or isinstance(exc,ValueError) else
        'Unexpected '+type(exc).__name__+' during source inspection; run the leaf inspect command '
        'with the same source flags for diagnostics. No write or source repair was attempted.')
    if code in {'SOURCE_VECTORS_NOT_STORED','SOURCE_VECTORS_NOT_RETRIEVABLE','SOURCE_VECTOR_INVALID','NATIVE_SOURCE_INCOMPATIBLE'}:
        detail = ('The original Entity Graph source failed the pinned Topic Graph source check ('+code+'). '
            'It needs a retrievable string key and stored, retrievable float32 vectors with an HNSW cosine or dotProduct profile (compression allowed). Ask the source owner for a '
            'supported source; preflight changes no index and runs no native code.')
    print(json.dumps({'status':'blocked','error_code':code,
        'detail':detail}))
    sys.exit(1)
"""


def bootstrap_module():
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("demo_bootstrap", ROOT / "bootstrap.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def execute(command: list[str], *, env: dict | None = None, cwd: Path | None = None):
    return subprocess.run(command, env=env, cwd=cwd, capture_output=True, text=True,
                          check=False, timeout=TIMEOUT)


def source_arguments(values: list[str]) -> list[str]:
    if not values or len(values) % 2:
        raise ValueError("--inspect-source requires explicit Topic Graph global flag/value pairs.")
    seen = set()
    for flag, value in zip(values[::2], values[1::2]):
        if flag not in SOURCE_FLAGS or not value or value.startswith("--"):
            raise ValueError("Only read-only Topic Graph source flags are accepted; no verbs, state, naming or write flags.")
        if flag in seen:
            raise ValueError(f"Duplicate source flag: {flag}")
        seen.add(flag)
    return values


def child_check(bootstrap, environment: Path, code: str, arguments: list[str]) -> dict:
    result = execute([str(bootstrap.python_path(environment)), "-I", "-B", "-c", code, *arguments],
                     env=bootstrap.child_env(environment), cwd=environment)
    observed = json.loads(result.stdout)
    expected = "ready" if code == NATIVE_CODE else "verified"
    if not isinstance(observed, dict) or observed.get("status") not in {expected, "blocked"}:
        raise ValueError("Invalid prerequisite response.")
    if result.returncode and observed["status"] != "blocked":
        raise ValueError("Prerequisite process failed despite a success response.")
    if observed["status"] != "blocked":
        required = ("path", "sha256", "rid") if expected == "ready" else (
            "source_index", "definition_fingerprint", "source_binding")
        if not all(observed.get(name) for name in required):
            raise ValueError("Prerequisite response lacks verification evidence.")
    return observed


def preflight(native_binary: str | None = None, inspect_source: list[str] | None = None) -> dict:
    bootstrap = bootstrap_module()
    runtimes = {}
    environments = {}
    for domain in DOMAINS:
        instruction = f'Run explicit setup: "{sys.executable}" -I "{ROOT / "bootstrap.py"}" setup {domain}'
        checks = {}
        try:
            spec, key, environment = bootstrap.specification(domain)
            if bootstrap.needs_setup(environment):
                bootstrap.setup(spec, key, environment)
                bootstrap.bind_python(bootstrap.interpreter_binding(domain))
            bootstrap.verify(spec, key, environment)
            environments[domain] = environment
            for entrypoint in spec["entry_points"]:
                if entrypoint in OPTIONAL_APPS:
                    continue
                try:
                    result = execute([sys.executable, "-I", "-B", str(ROOT / "bootstrap.py"),
                                      "run", domain, entrypoint, "--help"])
                    checks[entrypoint] = {"status": "ready" if result.returncode == 0 else "blocked"}
                    if result.returncode:
                        checks[entrypoint]["detail"] = (result.stderr or result.stdout).strip()
                except (OSError, subprocess.TimeoutExpired) as exc:
                    checks[entrypoint] = {"status": "blocked", "detail": str(exc)}
            status = "ready" if checks and all(c["status"] == "ready" for c in checks.values()) else "blocked"
            runtimes[domain] = {"status": status, "entrypoints": checks}
            if status == "blocked":
                runtimes[domain]["next_step"] = instruction + "; inspect the startup error; preflight never repairs."
        except (bootstrap.RuntimeErrorDetail, OSError, ValueError, KeyError, TypeError) as exc:
            runtimes[domain] = {"status": "blocked", "detail": str(exc), "next_step": instruction}

    native = {"status": "blocked", "detail": "Topic Graph runtime must pass before its pinned resolver can be loaded."}
    if runtimes["topicgraph"]["status"] == "ready":
        try:
            native = child_check(bootstrap, environments["topicgraph"], NATIVE_CODE, [native_binary or ""])
        except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
            native = {"status": "blocked", "detail": str(exc)}
    if (native["status"] == "blocked" and not native_binary
            and native.get("error_code") == "NATIVE_BINARY_NOT_FOUND"):
        # Not cached yet is expected on a cold start: topic-graph-build plan downloads it behind approval.
        native["status"] = "download_pending"
    native["distribution"] = "github-release:Azure/foundry-iq-tool-releases:latest"
    native["next_step"] = NATIVE_NEXT if native["status"] != "ready" else (
        "Verified against the recorded Azure/foundry-iq-tool-releases receipt (or explicit --native-binary); "
        "recheck after any runtime or binary update."
    )
    runtimes_ready = all(r["status"] == "ready" for r in runtimes.values())
    local_ready = runtimes_ready and native["status"] in {"ready", "download_pending"}
    source = {"status": "unknown", "next_step": SOURCE_NEXT}
    if inspect_source is not None:
        try:
            arguments = source_arguments(inspect_source)
            if not local_ready:
                raise ValueError("Local prerequisites failed; no source/authentication request was made.")
            source = child_check(bootstrap, environments["topicgraph"], SOURCE_CODE, arguments)
            source["next_step"] = (
                "Retain this exact physical index, mapping and freeze evidence; leaf inspect must recheck at handoff. "
                "This is a source check, not build, model, quota or write approval."
                if source["status"] == "verified" else SOURCE_NEXT
            )
        except (OSError, ValueError, subprocess.TimeoutExpired) as exc:
            source = {"status": "blocked", "detail": str(exc), "next_step": SOURCE_NEXT}
    blocked = not local_ready or source["status"] == "blocked"
    verified = source["status"] == "verified" and native["status"] == "ready"
    status = "blocked" if blocked else ("ready" if verified else "conditional")
    return {
        "schema_version": 1, "route": "graph-demo", "phase": "prerequisites", "status": status,
        "local_status": "ready" if local_ready else "blocked",
        "runtimes": runtimes, "native": native, "source": source,
        "scope": "Prerequisites only; no Azure write, model readiness, or whole-chain success claim.",
        # Exit 0 for ready and conditional (status tells them apart); only blocked fails.
        "exit_code": 1 if blocked else 0,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--native-binary", help="Operator-selected absolute trusted topicgraph path.")
    parser.add_argument("--inspect-source", nargs=argparse.REMAINDER,
                        help="Explicit opt-in to live read-only Azure source inspection; remaining Topic Graph source flags.")
    args = parser.parse_args(argv)
    try:
        report = preflight(args.native_binary, args.inspect_source)
    except (OSError, ValueError, ImportError, KeyError, TypeError) as exc:
        report = {
            "schema_version": 1, "route": "graph-demo", "phase": "prerequisites",
            "status": "blocked", "exit_code": 1, "error_code": "PREFLIGHT_UNAVAILABLE",
            "detail": str(exc), "next_step": "Reinstall the complete plugin; preflight will not repair it.",
        }
    print(json.dumps(report))
    return report["exit_code"]


if __name__ == "__main__":
    raise SystemExit(main())
