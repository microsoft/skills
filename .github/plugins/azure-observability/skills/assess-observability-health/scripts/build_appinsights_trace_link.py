"""Build an Azure portal Application Insights end-to-end transaction URL."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import uuid
from datetime import datetime


EVENT_TABLES = (
    "availabilityResults",
    "requests",
    "dependencies",
    "traces",
    "customEvents",
    "exceptions",
)


def iso_timestamp(value: str) -> str:
    normalized = value.replace("Z", "+00:00")
    try:
        datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid ISO-8601 timestamp: {value}") from exc
    return value


def event_item_id(value: str) -> str:
    try:
        uuid.UUID(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "event-id must be the telemetry itemId UUID, not a request, "
            "dependency, or span id"
        ) from exc
    return value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a DetailsV2Blade link for an Application Insights event.")
    parser.add_argument("--subscription-id", required=True)
    parser.add_argument("--resource-group", required=True)
    parser.add_argument("--component-name", required=True)
    parser.add_argument("--resource-id", required=True)
    parser.add_argument("--event-id", required=True, type=event_item_id)
    parser.add_argument("--operation-id", required=True)
    parser.add_argument("--timestamp", required=True, type=iso_timestamp)
    parser.add_argument("--event-table", required=True, choices=EVENT_TABLES)
    parser.add_argument("--end-time", required=True, type=iso_timestamp)
    parser.add_argument("--duration-ms", type=int, default=86_400_000)
    parser.add_argument("--cache-id")
    parser.add_argument("--portal-host", default="https://portal.azure.com/")
    return parser.parse_args()


def build_url(args: argparse.Namespace) -> tuple[str, str]:
    cache_id = args.cache_id or str(uuid.uuid5(
        uuid.NAMESPACE_URL,
        f"{args.operation_id}:{args.event_id}",
    ))
    component = {
        "SubscriptionId": args.subscription_id,
        "ResourceGroup": args.resource_group,
        "Name": args.component_name,
        "LinkedApplicationType": 0,
        "ResourceId": urllib.parse.quote(args.resource_id, safe=""),
        "ResourceType": urllib.parse.quote("microsoft.insights/components", safe=""),
        "IsAzureFirst": False,
    }
    data_model = {
        "eventId": args.event_id,
        "operationId": args.operation_id,
        "timestamp": args.timestamp,
        "cacheId": cache_id,
        "eventTable": args.event_table,
        "timeContext": {
            "durationMs": args.duration_ms,
            "endTime": args.end_time,
        },
    }
    query = "feature.agentsBladeUseIframe=true&feature.agentsEvaluationsTab=true"
    fragment = (
        "#view/AppInsightsExtension/DetailsV2Blade/ComponentId~/"
        f"{urllib.parse.quote(json.dumps(component, separators=(',', ':')), safe='')}"
        "/DataModel~/"
        f"{urllib.parse.quote(json.dumps(data_model, separators=(',', ':')), safe='')}"
    )
    url = f"{args.portal_host.rstrip('/')}/?{query}{fragment}"
    return url, cache_id


def main() -> int:
    args = parse_args()
    if args.duration_ms <= 0:
        print(json.dumps({"ok": False, "error": "duration-ms must be positive"}))
        return 2

    url, cache_id = build_url(args)
    print(json.dumps({"ok": True, "url": url, "cache_id": cache_id}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
