#!/usr/bin/env python3
"""Gate explicitly supplied sanitized aggregates; no telemetry or change execution."""

import argparse
import datetime as dt
import json
import math
from pathlib import Path
import re
import sys


UTC = dt.timezone.utc
MAX_BYTES = 128 * 1024
LABEL = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")
STATES = {
    "usable", "missing", "denied", "empty", "stale", "partial", "failed",
    "unsupported", "noncomparable", "throttled", "unverified",
}


class InputError(Exception):
    pass


def require(condition):
    if not condition:
        raise InputError("Invalid recovery input; consult the contract. Values omitted.")


def fields(value, names):
    require(type(value) is dict and set(value) == set(names.split()))


def label(value):
    require(type(value) is str and LABEL.fullmatch(value) is not None)


def integer(value, minimum=1):
    require(type(value) is int and minimum <= value <= 2147483647)


def number(value):
    require(type(value) in (int, float))
    try:
        require(math.isfinite(value) and value >= 0)
    except OverflowError:
        require(False)


def percentile(value):
    number(value)
    require(0 < value <= 100)


def timestamp(value):
    require(type(value) is str and len(value) <= 40 and "T" in value)
    try:
        result = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise InputError("Invalid timestamp; explicit UTC required. Values omitted.") from None
    require(result.utcoffset() == dt.timedelta(0))
    return result


def validate_evidence(value, kind, evaluated):
    fields(value, "state complete source query_ref collected_at window_start "
           "window_end first_event_at latest_event_at sample_count total workload version"
           + (" percentile percentile_value" if kind == "percentile" else ""))
    require(type(value["state"]) is str and value["state"] in STATES)
    require(type(value["complete"]) is bool)
    for key in ("source", "query_ref", "workload", "version"):
        label(value[key])
    start, end, collected = (
        timestamp(value[key]) for key in ("window_start", "window_end", "collected_at")
    )
    require(start < end <= collected <= evaluated)
    count, total, first, latest = (
        value[key] for key in ("sample_count", "total", "first_event_at", "latest_event_at")
    )
    if kind == "percentile":
        percentile(value["percentile"])
        require(total is None)
        if value["percentile_value"] is not None:
            number(value["percentile_value"])
            require(count is not None and type(count) is int and count > 0)
    if count is None:
        require(total is None and first is None and latest is None)
    else:
        integer(count, 0)
        if total is not None:
            number(total)
            if kind == "fraction":
                require(type(total) is int and total <= count)
        if count == 0:
            require(first is None and latest is None and (total is None or total == 0))
        else:
            require(first is not None and latest is not None
                    and start <= timestamp(first) <= timestamp(latest) <= end)
            if count == 1:
                require(timestamp(first) == timestamp(latest))
    if value["state"] == "empty":
        require(count == 0)
    if value["state"] == "partial":
        require(not value["complete"])


def validate(value, now):
    fields(value, "schema_version incident scope change evaluated_at "
           "max_evidence_age_seconds checks supporting_results")
    require(type(value["schema_version"]) is int and value["schema_version"] == 1)
    label(value["incident"])
    evaluated = timestamp(value["evaluated_at"])
    require(evaluated <= now)
    integer(value["max_evidence_age_seconds"])
    scope, change = value["scope"], value["change"]
    fields(scope, "environment targets confirmed confirmed_at")
    label(scope["environment"])
    require(type(scope["targets"]) is list and 1 <= len(scope["targets"]) <= 50)
    for target in scope["targets"]:
        label(target)
    require(len(set(scope["targets"])) == len(scope["targets"]))
    require(type(scope["confirmed"]) is bool)
    require(timestamp(scope["confirmed_at"]) <= evaluated)
    fields(change, "id version deployed_at confirmed")
    label(change["id"])
    label(change["version"])
    require(type(change["confirmed"]) is bool)
    deployed = timestamp(change["deployed_at"])
    require(deployed <= evaluated)
    require(type(value["supporting_results"]) is list
            and len(value["supporting_results"]) <= 50)
    for result in value["supporting_results"]:
        fields(result, "kind reference state")
        require(type(result["kind"]) is str
                and result["kind"] in {"deployment", "evaluation"})
        label(result["reference"])
        require(type(result["state"]) is str
                and result["state"] in {"passed", "failed", "partial", "unknown"})
    require(type(value["checks"]) is list and len(value["checks"]) <= 50)
    seen = set()
    for check in value["checks"]:
        require(type(check) is dict)
        fields(check, "id target role required metric kind unit operator threshold "
               "expected_workload comparable min_samples min_observation_seconds "
               "freshness_seconds original post"
               + (" percentile" if check.get("kind") == "percentile" else ""))
        for key in ("id", "target", "metric", "unit", "expected_workload"):
            label(check[key])
        require(check["id"] not in seen and check["target"] in scope["targets"])
        seen.add(check["id"])
        for key, options in (
            ("role", {"symptom", "guardrail"}),
            ("kind", {"mean", "fraction", "percentile", "unsupported"}),
            ("operator", {"lte", "gte"}),
        ):
            require(type(check[key]) is str and check[key] in options)
        require(type(check["required"]) is bool and type(check["comparable"]) is bool)
        number(check["threshold"])
        if check["kind"] == "fraction":
            require(check["threshold"] <= 1 and check["unit"] == "ratio")
        if check["kind"] == "percentile":
            percentile(check["percentile"])
        for key in ("min_samples", "min_observation_seconds", "freshness_seconds"):
            integer(check[key])
        for key in ("original", "post"):
            validate_evidence(check[key], check["kind"], evaluated)
        require(timestamp(check["original"]["window_end"]) <= deployed)
        require(timestamp(check["post"]["window_start"]) >= deployed)
    return value


def evidence_gaps(check, key, now, max_age):
    evidence = check[key]
    gaps = []
    if check["kind"] == "unsupported":
        gaps.append("unsupported_measurement")
    if evidence["state"] != "usable":
        gaps.append("source_" + evidence["state"])
    if not evidence["complete"]:
        gaps.append("source_incomplete")
    count = evidence["sample_count"]
    measured = (
        evidence["percentile_value"] if check["kind"] == "percentile" else evidence["total"]
    )
    if count is None or measured is None:
        gaps.append("measurement_missing")
    if check["kind"] == "percentile" and evidence["percentile"] != check["percentile"]:
        gaps.append("percentile_mismatch")
    if count is None or count < check["min_samples"]:
        gaps.append("insufficient_samples")
    start, end = (timestamp(evidence[k]) for k in ("window_start", "window_end"))
    if (end - start).total_seconds() < check["min_observation_seconds"]:
        gaps.append("insufficient_observation")
    first, latest = evidence["first_event_at"], evidence["latest_event_at"]
    if first is None or latest is None or (
        timestamp(latest) - timestamp(first)
    ).total_seconds() < check["min_observation_seconds"]:
        gaps.append("insufficient_observed_span")
    if evidence["workload"] != check["expected_workload"]:
        gaps.append("workload_mismatch")
    # Historical incident evidence is fresh relative to its own window, not today.
    anchor = now if key == "post" else end
    if latest is None or (anchor - timestamp(latest)).total_seconds() > check["freshness_seconds"]:
        gaps.append("stale_or_missing_events")
    if key == "post" and (
        now - timestamp(evidence["collected_at"])
    ).total_seconds() > max_age:
        gaps.append("expired_evidence")
    return gaps


def measurement(check, key):
    evidence = check[key]
    if check["kind"] == "percentile":
        return evidence["percentile_value"]
    return evidence["total"] / evidence["sample_count"]


def passes(check, value):
    if check["operator"] == "lte":
        return value <= check["threshold"]
    return value >= check["threshold"]


def assess(value, now=None):
    now = now or dt.datetime.now(UTC)
    require(isinstance(now, dt.datetime) and now.utcoffset() == dt.timedelta(0))
    validate(value, now)
    global_gaps = []
    if not value["scope"]["confirmed"]:
        global_gaps.append("scope_unconfirmed")
    if not value["change"]["confirmed"]:
        global_gaps.append("change_unconfirmed")
    if (now - timestamp(value["evaluated_at"])).total_seconds() > value["max_evidence_age_seconds"]:
        global_gaps.append("expired_assessment")
    results = []
    for index, check in enumerate(value["checks"]):
        original_gaps = evidence_gaps(
            check, "original", now, value["max_evidence_age_seconds"]
        )
        post_gaps = evidence_gaps(check, "post", now, value["max_evidence_age_seconds"])
        if check["post"]["version"] != value["change"]["version"]:
            post_gaps.append("candidate_version_mismatch")
        reasons = list(global_gaps)
        reasons.extend("original_" + gap for gap in original_gaps)
        reasons.extend("post_" + gap for gap in post_gaps)
        if not check["comparable"]:
            reasons.append("noncomparable")
        original = None if original_gaps else measurement(check, "original")
        post = None if post_gaps else measurement(check, "post")
        if check["role"] == "symptom" and original is not None and passes(check, original):
            reasons.append("original_symptom_not_established")
        delta = None if reasons or original is None or post is None else post - original
        # A sufficient post-change absolute violation stands even if baseline or
        # an unrelated check is unavailable. Recovery requires both windows.
        if not global_gaps and check["comparable"] and post is not None and not passes(check, post):
            verdict = "NOT_RECOVERED"
            reasons.append("post_threshold_violation")
        elif reasons:
            verdict = "INCONCLUSIVE"
        else:
            verdict = "VERIFIED_RECOVERED"
        results.append({
            "check_index": index, "required": check["required"], "verdict": verdict,
            "reasons": reasons, "original_value": original, "post_value": post,
            "delta": delta,
        })
    required = [result for result in results if result["required"]]
    has_symptom = any(c["required"] and c["role"] == "symptom" for c in value["checks"])
    covered_targets = {
        c["target"] for c in value["checks"] if c["required"] and c["role"] == "symptom"
    }
    plan_gaps = [] if has_symptom else ["required_symptom_missing"]
    if covered_targets != set(value["scope"]["targets"]):
        plan_gaps.append("required_target_symptom_missing")
    if any(result["state"] != "passed" for result in value["supporting_results"]):
        plan_gaps.append("unresolved_supporting_evidence")
    if any(result["verdict"] == "NOT_RECOVERED" for result in required):
        verdict = "NOT_RECOVERED"
    elif plan_gaps or not required or any(
        result["verdict"] != "VERIFIED_RECOVERED" for result in required
    ):
        verdict = "INCONCLUSIVE"
    else:
        verdict = "VERIFIED_RECOVERED"
    return {
        "schema_version": 1, "verdict": verdict,
        "reasons": global_gaps + plan_gaps,
        "checks": results, "supporting_results_establish_recovery": False,
    }


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result)
        result[key] = value
    return result


def reject_constant(_value):
    require(False)


def read_input(path):
    with Path(path).open("rb") as stream:
        raw = stream.read(MAX_BYTES + 1)
    require(len(raw) <= MAX_BYTES)
    return json.loads(
        raw.decode("utf-8"), object_pairs_hook=unique_object,
        parse_constant=reject_constant,
    )


class SafeParser(argparse.ArgumentParser):
    def error(self, message):
        raise InputError("Invalid command arguments; values omitted.")


def main(argv=None):
    try:
        parser = SafeParser(description=__doc__)
        parser.add_argument("input", help="Path to sanitized evidence JSON")
        args = parser.parse_args(argv)
        result = assess(read_input(args.input))
        print(json.dumps(result, allow_nan=False, sort_keys=True))
        return 0
    except (InputError, OSError, ValueError, RecursionError, OverflowError):
        print("Invalid recovery input or local read error; values omitted.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
