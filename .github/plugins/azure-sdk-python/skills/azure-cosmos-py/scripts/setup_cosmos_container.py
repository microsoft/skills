#!/usr/bin/env python3
"""
Cosmos DB Container Setup CLI Tool

Create and configure Azure Cosmos DB containers with proper partitioning,
throughput settings, and indexing policies.

Usage:
    python setup_cosmos_container.py --database mydb --container orders --partition-key /customer_id
    python setup_cosmos_container.py --database mydb --container events --partition-key /device_id /day --throughput 1000
    python setup_cosmos_container.py --database mydb --container data --partition-key /pk --serverless

Environment Variables:
    COSMOS_ENDPOINT  - Cosmos DB account endpoint URL
    COSMOS_KEY       - Cosmos DB account key (optional if using DefaultAzureCredential)
"""

import argparse
import json
import os
import sys
from typing import Any

from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient, PartitionKey
from azure.cosmos.exceptions import CosmosHttpResponseError


def get_cosmos_client() -> CosmosClient:
    """Create Cosmos DB client from environment variables."""
    endpoint = os.environ.get("COSMOS_ENDPOINT")
    if not endpoint:
        raise ValueError("COSMOS_ENDPOINT environment variable required")

    # Try key auth first, fall back to DefaultAzureCredential
    key = os.environ.get("COSMOS_KEY")
    if key:
        return CosmosClient(url=endpoint, credential=key)
    else:
        credential = DefaultAzureCredential()
        return CosmosClient(url=endpoint, credential=credential)


def create_indexing_policy(
    include_paths: list[str] | None = None,
    exclude_paths: list[str] | None = None,
    composite_indexes: list[list[dict]] | None = None,
) -> dict[str, Any]:
    """Build an indexing policy."""
    policy = {
        "indexingMode": "consistent",
        "automatic": True,
        "includedPaths": [],
        "excludedPaths": [],
    }

    # Include paths (default: all)
    if include_paths:
        policy["includedPaths"] = [{"path": p} for p in include_paths]
    else:
        policy["includedPaths"] = [{"path": "/*"}]

    # Exclude paths
    if exclude_paths:
        policy["excludedPaths"] = [{"path": p} for p in exclude_paths]

    # Always exclude _etag
    policy["excludedPaths"].append({"path": "/_etag/?"})

    # Composite indexes for ORDER BY on multiple fields
    if composite_indexes:
        policy["compositeIndexes"] = composite_indexes

    return policy


def create_container(
    client: CosmosClient,
    database_id: str,
    container_id: str,
    partition_key_paths: list[str],
    throughput: int | None = None,
    ttl: int | None = None,
    indexing_policy: dict | None = None,
) -> dict[str, Any]:
    """Create or update a Cosmos DB container."""

    # Get or create database
    try:
        database = client.create_database_if_not_exists(id=database_id)
        print(f"Database: {database_id}")
    except CosmosHttpResponseError as e:
        print(f"Error creating database: {e.message}")
        raise

    # Build partition key
    if len(partition_key_paths) == 1:
        partition_key = PartitionKey(path=partition_key_paths[0])
    else:
        # Hierarchical partition key
        partition_key = PartitionKey(path=partition_key_paths)

    # Container properties
    container_props = {"id": container_id, "partition_key": partition_key}

    # Add TTL if specified
    if ttl is not None:
        container_props["default_time_to_live"] = ttl

    # Add indexing policy if specified
    if indexing_policy:
        container_props["indexing_policy"] = indexing_policy

    # Create container
    try:
        if throughput:
            container = database.create_container_if_not_exists(
                **container_props, offer_throughput=throughput
            )
        else:
            container = database.create_container_if_not_exists(**container_props)

        print(f"Container: {container_id}")
        print(f"Partition key: {partition_key_paths}")

    except CosmosHttpResponseError as e:
        if e.status_code == 409:
            print(f"Container {container_id} already exists")
            container = database.get_container_client(container_id)
        else:
            print(f"Error creating container: {e.message}")
            raise

    # Get container properties
    properties = container.read()

    return {
        "database": database_id,
        "container": container_id,
        "partition_key": partition_key_paths,
        "self_link": properties.get("_self"),
        "resource_id": properties.get("_rid"),
    }


def show_container_info(client: CosmosClient, database_id: str, container_id: str):
    """Display detailed container information."""
    database = client.get_database_client(database_id)
    container = database.get_container_client(container_id)

    properties = container.read()

    print("\n=== Container Information ===")
    print(f"Database: {database_id}")
    print(f"Container: {container_id}")
    print(f"Partition Key: {properties.get('partitionKey', {}).get('paths', [])}")

    # TTL
    ttl = properties.get("defaultTtl")
    if ttl == -1:
        print("TTL: Enabled (per-item)")
    elif ttl:
        print(f"TTL: {ttl} seconds")
    else:
        print("TTL: Disabled")

    # Indexing policy
    index_policy = properties.get("indexingPolicy", {})
    print(f"Indexing Mode: {index_policy.get('indexingMode', 'consistent')}")

    # Throughput
    try:
        offer = container.read_offer()
        print(f"Throughput: {offer.offer_throughput} RU/s")
        if offer.properties.get("content", {}).get("offerAutopilotSettings"):
            max_throughput = offer.properties["content"]["offerAutopilotSettings"][
                "maxThroughput"
            ]
            print(f"Autoscale Max: {max_throughput} RU/s")
    except Exception:
        print("Throughput: Serverless or database-level")

    # Item count (approximate)
    try:
        query = "SELECT VALUE COUNT(1) FROM c"
        count = list(
            container.query_items(query=query, enable_cross_partition_query=True)
        )[0]
        print(f"Item Count: ~{count}")
    except Exception:
        print("Item Count: Unable to retrieve")


def main():
    parser = argparse.ArgumentParser(
        description="Create and configure Cosmos DB containers",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument("--database", "-d", required=True, help="Database ID")
    parser.add_argument("--container", "-c", required=True, help="Container ID")
    parser.add_argument(
        "--partition-key",
        "-pk",
        nargs="+",
        required=True,
        help="Partition key path(s). Use multiple for hierarchical keys.",
    )
    parser.add_argument(
        "--throughput",
        "-t",
        type=int,
        help="Provisioned throughput in RU/s (omit for serverless)",
    )
    parser.add_argument(
        "--serverless",
        action="store_true",
        help="Use serverless mode (no throughput provisioning)",
    )
    parser.add_argument(
        "--ttl", type=int, help="Default TTL in seconds (-1 for per-item TTL)"
    )
    parser.add_argument(
        "--exclude-paths",
        nargs="+",
        help="Paths to exclude from indexing (e.g., /large_field/*)",
    )
    parser.add_argument(
        "--composite-index",
        action="append",
        nargs="+",
        metavar="PATH",
        help="Composite index paths (can specify multiple times). Format: --composite-index /field1 /field2",
    )
    parser.add_argument(
        "--info",
        action="store_true",
        help="Show container information instead of creating",
    )
    parser.add_argument(
        "--output",
        "-o",
        choices=["json", "text"],
        default="text",
        help="Output format (default: text)",
    )

    args = parser.parse_args()

    # Validate arguments
    if args.throughput and args.serverless:
        print("Error: Cannot specify both --throughput and --serverless")
        sys.exit(1)

    # Ensure partition key paths start with /
    partition_keys = []
    for pk in args.partition_key:
        if not pk.startswith("/"):
            pk = f"/{pk}"
        partition_keys.append(pk)

    try:
        client = get_cosmos_client()
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)

    # Show info mode
    if args.info:
        try:
            show_container_info(client, args.database, args.container)
        except CosmosHttpResponseError as e:
            print(f"Error: {e.message}")
            sys.exit(1)
        return

    # Build indexing policy
    indexing_policy = None
    if args.exclude_paths or args.composite_index:
        composite_indexes = None
        if args.composite_index:
            composite_indexes = [
                [{"path": p, "order": "ascending"} for p in index_paths]
                for index_paths in args.composite_index
            ]

        indexing_policy = create_indexing_policy(
            exclude_paths=args.exclude_paths, composite_indexes=composite_indexes
        )

    # Create container
    try:
        result = create_container(
            client=client,
            database_id=args.database,
            container_id=args.container,
            partition_key_paths=partition_keys,
            throughput=args.throughput if not args.serverless else None,
            ttl=args.ttl,
            indexing_policy=indexing_policy,
        )
    except CosmosHttpResponseError as e:
        print(f"Error: {e.message}")
        sys.exit(1)

    # Output result
    if args.output == "json":
        print(json.dumps(result, indent=2))
    else:
        print("\n=== Container Created ===")
        print(f"Database: {result['database']}")
        print(f"Container: {result['container']}")
        print(f"Partition Key: {result['partition_key']}")
        if args.throughput:
            print(f"Throughput: {args.throughput} RU/s")
        else:
            print("Throughput: Serverless")
        if args.ttl:
            print(f"TTL: {args.ttl} seconds")

        print("\nContainer ready for use!")


if __name__ == "__main__":
    main()
