# Azure Kusto Graph Skills

Kusto graph analysis, IRQL security hunting pipelines, and graph visualization skills for Azure Data Explorer.

## Security

> [!WARNING]
> The `azure-kusto-graph-skills` plugin uses `npx` to download and run the Azure MCP Server, inheriting the local environment's `.npmrc` configuration. Install this plugin only on trusted devices. A compromised `.npmrc` configuration could cause `npx` to download and execute malicious code, potentially resulting in remote code execution.

## Skills

- **azure-kusto-graph** — Build and query graphs using KQL graph operators (make-graph, graph-match, shortest paths, connected components, persistent models)
- **azure-kusto-irql** — Compose IRQL incident response pipelines using Get_*, Extract_*, and Enrich_* functions
- **azure-kusto-irql-graph** — Generate Lift_To_Graph mappings and Graph_Render_View visualizations from query results
