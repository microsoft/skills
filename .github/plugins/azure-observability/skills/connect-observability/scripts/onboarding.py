#!/usr/bin/env python3
"""Validate local observability scope and classify supplied readiness evidence."""

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile


MAX_BYTES = 128 * 1024
UTC = dt.timezone.utc
LABEL = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}")
GUID = r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"
SEGMENT = r"[A-Za-z0-9][A-Za-z0-9._()-]{0,127}"
ARM = re.compile(
    rf"/subscriptions/{GUID}/resourceGroups/{SEGMENT}/providers/"
    rf"{SEGMENT}(?:/{SEGMENT}/{SEGMENT})+", re.IGNORECASE
)
SOURCE_TYPES = {
    "application-insights": ("microsoft.insights", ("components",)),
    "log-analytics": ("microsoft.operationalinsights", ("workspaces",)),
    "azure-monitor-workspace": ("microsoft.monitor", ("accounts",)),
    "grafana": ("microsoft.dashboard", ("grafana",)),
    "foundry-project": ("microsoft.cognitiveservices", ("accounts", "projects")),
}
BASES = {"user-confirmed", "deployment-output", "resource-metadata"}
PREREQUISITES = {"verified", "missing", "denied", "failed", "unverified"}
STATES = {
    "usable", "missing", "denied", "empty", "stale", "throttled",
    "failed", "partial", "unverified", "unsupported",
}
SIGNALS = {
    "requests", "dependencies", "traces", "exceptions", "metrics",
    "agent-runs", "evaluations", "model-calls", "tool-calls",
}
BLOCKERS = {"missing", "denied", "failed", "unsupported"}
MAPPING_FIELDS = {
    "schema_version", "application", "environment", "workload",
    "confirmed_at", "resources", "telemetry_sources",
}
SIGNAL_FIELDS = {
    "name", "source_resource_id", "required", "state", "checked_at",
    "window_start", "window_end", "freshness_seconds", "record_count",
    "latest_event_at", "complete",
}


class InputError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise InputError(message)


def fields(value, expected):
    require(type(value) is dict and set(value) == expected,
            "Object fields do not match the contract; values omitted.")


def choice(value, options):
    require(type(value) is str and value in options,
            "Unsupported contract value; values omitted.")


def positive_integer(value):
    require(type(value) is int and 0 < value <= 2**31 - 1,
            "Expected a positive integer no greater than 2147483647.")


def timestamp(value):
    require(type(value) is str and len(value) <= 40,
            "Expected an explicit UTC ISO 8601 timestamp.")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise InputError("Expected an explicit UTC ISO 8601 timestamp.") from None
    require("T" in value and parsed.utcoffset() == dt.timedelta(0),
            "Expected an explicit UTC ISO 8601 timestamp.")
    return parsed


def resource_id(value):
    require(type(value) is str and len(value) <= 2048 and ARM.fullmatch(value),
            "Expected a supported resource-group-scoped ARM resource ID.")
    return value.lower()


def version(value):
    require(type(value) is int and value == 1, "Unsupported schema version.")


def validate_mapping(value, now=None):
    now = now or dt.datetime.now(UTC)
    fields(value, MAPPING_FIELDS)
    version(value["schema_version"])
    for key in ("application", "environment"):
        require(type(value[key]) is str and LABEL.fullmatch(value[key]),
                "Application/environment must be short ASCII labels.")
    choice(value["workload"], {"web-api", "foundry-agent"})
    require(timestamp(value["confirmed_at"]) <= now,
            "Mapping confirmation cannot be in the future.")
    for key in ("resources", "telemetry_sources"):
        entries = value[key]
        require(type(entries) is list and 1 <= len(entries) <= 50,
                "Mapping lists must contain 1-50 entries.")
        seen = set()
        for entry in entries:
            expected = {"resource_id", "basis"}
            if key == "telemetry_sources":
                expected = expected | {"kind"}
            fields(entry, expected)
            rid = resource_id(entry["resource_id"])
            require(rid not in seen, "Duplicate mapping resource ID.")
            seen.add(rid)
            choice(entry["basis"], BASES)
            if key == "telemetry_sources":
                choice(entry["kind"], SOURCE_TYPES)
                namespace, types = SOURCE_TYPES[entry["kind"]]
                parts = rid.split("/")
                require(parts[6] == namespace and tuple(parts[7::2]) == types,
                        "Telemetry kind does not match the ARM resource type.")
    return value


def validate_signal(value, source_ids, confirmed_at, assessment_at):
    fields(value, SIGNAL_FIELDS)
    choice(value["name"], SIGNALS)
    choice(value["state"], STATES)
    require(type(value["required"]) is bool and type(value["complete"]) is bool,
            "Required and complete must be booleans.")
    rid = resource_id(value["source_resource_id"])
    require(rid in source_ids, "Signal source is outside the confirmed mapping.")
    checked = timestamp(value["checked_at"])
    start = timestamp(value["window_start"])
    end = timestamp(value["window_end"])
    require(confirmed_at <= checked <= assessment_at,
            "Signal check must follow confirmation and not exceed assessment time.")
    require(start < end <= checked, "Invalid observation window.")
    positive_integer(value["freshness_seconds"])
    count = value["record_count"]
    require(count is None or (type(count) is int and count >= 0),
            "Record count must be a nonnegative integer or null.")
    latest = value["latest_event_at"]
    if latest is not None:
        require(start <= timestamp(latest) <= end,
                "Latest event must fall inside the observation window.")
        require(count is None or count > 0,
                "Zero-count observations cannot contain an event timestamp.")
    if count is not None and count > 0:
        require(latest is not None, "Positive counts require a latest-event time.")
    if value["state"] == "usable":
        require(value["complete"] and count is not None and count > 0
                and latest is not None,
                "Usable requires complete, positive-count, timestamped evidence.")
    if value["state"] == "empty":
        require(value["complete"] and count == 0 and latest is None,
                "Empty requires complete, zero-count evidence without an event time.")
    if value["state"] == "partial":
        require(not value["complete"], "Partial data cannot claim completeness.")


def assess(value, now=None):
    now = now or dt.datetime.now(UTC)
    fields(value, {
        "schema_version", "mapping", "checked_at", "max_check_age_seconds",
        "prerequisites", "signals",
    })
    version(value["schema_version"])
    positive_integer(value["max_check_age_seconds"])
    checked = timestamp(value["checked_at"])
    require(checked <= now, "Assessment cannot be in the future.")
    pre = value["prerequisites"]
    fields(pre, {"tools", "identity", "mapping"})
    for state in pre.values():
        choice(state, PREREQUISITES)
    mapping = value["mapping"]
    source_ids = set()
    confirmed_at = checked
    if mapping is not None:
        validate_mapping(mapping, now)
        confirmed_at = timestamp(mapping["confirmed_at"])
        require(confirmed_at <= checked, "Assessment predates mapping confirmation.")
        source_ids = {entry["resource_id"].lower()
                      for entry in mapping["telemetry_sources"]}
    require(pre["mapping"] != "verified" or mapping is not None,
            "Verified mapping requires a validated mapping object.")
    signals = value["signals"]
    require(type(signals) is list and len(signals) <= 50,
            "Signals must be a list of at most 50 entries.")
    if all(state == "verified" for state in pre.values()):
        require(any(type(signal) is dict and signal.get("required") is True
                    for signal in signals), "Declare at least one core signal.")
    seen = set()
    results = []
    max_age = value["max_check_age_seconds"]
    report_expired = (now - checked).total_seconds() > max_age
    for signal in signals:
        validate_signal(signal, source_ids, confirmed_at, checked)
        key = (signal["name"], signal["source_resource_id"].lower())
        require(key not in seen, "Duplicate signal/source observation.")
        seen.add(key)
        expired = (now - timestamp(signal["checked_at"])).total_seconds() > max_age
        effective = signal["state"]
        if expired and effective not in BLOCKERS:
            effective = "unverified"
        elif effective == "usable":
            age = (now - timestamp(signal["latest_event_at"])).total_seconds()
            if age > signal["freshness_seconds"]:
                effective = "stale"
        results.append({**signal, "effective_state": effective,
                        "check_expired": expired})
    required = [signal for signal in results if signal["required"]]
    blockers = [signal for signal in required
                if signal["effective_state"] in BLOCKERS]
    if any(state in BLOCKERS for state in pre.values()) or blockers:
        readiness, reason = "blocked", "required-access-or-capability-blocked"
    elif report_expired:
        readiness, reason = "telemetry-unverified", "assessment-expired"
    elif any(state != "verified" for state in pre.values()):
        readiness, reason = "telemetry-unverified", "prerequisites-unverified"
    elif not any(signal["effective_state"] == "usable" for signal in required):
        readiness, reason = "telemetry-unverified", "core-telemetry-unverified"
    elif any(signal["effective_state"] != "usable" for signal in results):
        readiness, reason = "limited-coverage", "declared-signal-gaps"
    else:
        readiness, reason = "ready", "declared-signals-usable"
    return {
        "schema_version": 1,
        "basis": "supplied-observations-not-independent-verification",
        "evaluated_at": now.isoformat(),
        "checked_at": value["checked_at"],
        "readiness": readiness,
        "reasons": [reason],
        "prerequisites": pre,
        "signals": results,
    }


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON object key; values omitted.")
        result[key] = value
    return result


def reject_constant(_value):
    raise InputError("Non-finite JSON numbers are not supported.")


def read_json(path):
    with Path(path).open("rb") as stream:
        data = stream.read(MAX_BYTES + 1)
    require(len(data) <= MAX_BYTES, "Input exceeds the 128 KiB limit.")
    try:
        return json.loads(data.decode("utf-8"), object_pairs_hook=unique_object,
                          parse_constant=reject_constant)
    except (ValueError, UnicodeError, RecursionError):
        raise InputError("Invalid UTF-8 JSON; values omitted.") from None


def mapping_path(project):
    root = Path(project).resolve()
    require(root.is_dir(), "Project directory does not exist.")
    directory = root / ".obs"
    path = directory / "application.json"
    require(not directory.is_symlink() and not path.is_symlink()
            and directory.resolve() == directory and path.resolve() == path,
            "Symlink or redirected mapping destinations are not supported.")
    return root, directory, path


def git_status(root, arguments):
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *arguments],
            capture_output=True, timeout=15, check=False,
        )
    except FileNotFoundError:
        raise InputError("Git is required to verify local persistence safeguards.") from None
    require(result.returncode in (0, 1),
            "Git could not verify the persistence destination.")
    return result.returncode


def save_mapping(value, project, consent=False, replace=False):
    require(consent, "Explicit persistence consent is required.")
    validate_mapping(value)
    root, directory, path = mapping_path(project)
    relative = ".obs/application.json"
    require(git_status(root, ["ls-files", "--error-unmatch", "--", relative]) == 1,
            "Refusing to persist mapping to a tracked destination.")
    require(git_status(root, ["check-ignore", "--no-index", "-q", "--", relative]) == 0,
            "Destination must be Git-ignored; request an approved ignore-rule change.")
    require(replace or not path.exists(),
            "Mapping exists; replacement requires explicit --replace.")
    payload = (json.dumps(value, indent=2, allow_nan=False) + "\n").encode("utf-8")
    require(len(payload) <= MAX_BYTES, "Mapping exceeds the 128 KiB limit.")
    directory.mkdir(exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=directory, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        if replace:
            os.replace(temporary, path)
        else:
            os.link(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return {"saved": True, "cloud_access_verified": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for command in ("validate", "assess", "save"):
        sub = commands.add_parser(command)
        sub.add_argument("input", type=Path)
        if command == "save":
            sub.add_argument("--project", required=True, type=Path)
            sub.add_argument("--consent", action="store_true")
            sub.add_argument("--replace", action="store_true")
    load = commands.add_parser("load")
    load.add_argument("--project", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == "load":
            _, _, path = mapping_path(args.project)
            result = {"mapping": validate_mapping(read_json(path)),
                      "requires_live_revalidation": True}
        else:
            value = read_json(args.input)
            if args.command == "assess":
                result = assess(value)
            elif args.command == "validate":
                validate_mapping(value)
                result = {"valid": True, "cloud_access_verified": False}
            else:
                result = save_mapping(value, args.project, args.consent, args.replace)
        print(json.dumps(result, indent=2, allow_nan=False))
        return 0
    except InputError as error:
        print(f"Error: {error}", file=sys.stderr)
    except (OSError, UnicodeError, subprocess.TimeoutExpired):
        print("Error: Local file or Git operation failed; details omitted.",
              file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
