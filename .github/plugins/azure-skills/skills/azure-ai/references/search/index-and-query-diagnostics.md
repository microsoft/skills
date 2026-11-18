# Azure AI Search index, vector/hybrid query and indexer diagnostics

For classic Azure AI Search (`Microsoft.Search/searchServices`) index schemas,
vector/hybrid/semantic queries, indexer/skillset errors and Azure Monitor logs.
Route **Foundry IQ knowledge bases and connectors** to `foundry-iq`, and generic
Foundry agent creation to `microsoft-foundry`.

## Workflow

1. Classify: **schema/query** (`400`, unexpected hybrid/semantic results),
   **indexer/skillset** (failed items, enrichment auth) or **throttling**
   (`503`/`429`). Never ask for admin/query keys or echo query values.
2. For an index JSON (`search_index_get`, REST or IaC) or query payload, check
   `node --version` (Node.js 22+).
   **Without Node** (don't install it unasked), read the JSON and check one
   top-level `Edm.String` key field plus each table row in step 3, without
   echoing query text, filter literals or vectors. Otherwise run the
   [local schema/query validator](../../scripts/validate-search-schema.mjs):

   ```bash
   node "<skill-directory>/scripts/validate-search-schema.mjs" --index "<index.json>" --query "<query.json>"
   ```

   ```powershell
   & node "<skill-directory>\scripts\validate-search-schema.mjs" --index "<index.json>" --query "<query.json>"
   ```

   [Bash](../../scripts/validate-search-schema.sh) and
   [PowerShell](../../scripts/validate-search-schema.ps1) launchers use exit codes
   `0` report/`--help`, `1` file/JSON error, `2` usage error, `3` Node 22+ missing.
3. Verify common schema, query and operational failure modes:

| Symptom | Public contract check |
|---|---|
| Vector query `400` or ignored | Vector field must use `Collection(Edm.Single)` (or narrow `Half`/`Int16`/`SByte`, or `Byte` with `vectorEncoding: "packedBit"`, whose `dimensions` count bits so queries send `ceil(dimensions/8)` bytes), `searchable: true`, positive `dimensions` matching the embedding model output, and a valid `vectorSearchProfile` -> `algorithm`. `kind: "text"` vector queries require an integrated `vectorizer` on the profile. |
| Semantic query `400` | `queryType: "semantic"` requires a `semanticConfiguration` (or `defaultConfiguration`) whose prioritized content/keyword fields exist and have `searchable: true`. |
| `$filter` / `orderby` / `facets` / `select` `400` | Referenced fields must not disable `filterable`, `sortable`, `facetable` or `retrievable` (`hidden: false`). REST defaults omitted attributes by type: simple fields are filterable, facetable (not `GeographyPoint`) and retrievable; only single-valued fields are sortable; vector fields are none of these. Azure SDK field classes have no defaults. |
| Indexer/skillset failures | Inspect indexer status (`lastResult.status`, `errors[]`, `warnings[]` with `key`, `name`, `statusCode`). Verify data-source RBAC, skillset AI Services identity/key attachment and projection target field mappings. |
| `503` / `429` throttling | Queries and indexing share replicas/partitions; heavy indexing or replica changes raise dropped queries. |

4. For permitted live checks, prefer `azure__search` (`search_index_list`,
   `search_index_get`, `search_query`) and keyless RBAC (`Search Index Data Reader` /
   `Search Service Contributor`). When diagnostic settings export to
   Log Analytics, check `AzureMetrics` (`ThrottledSearchQueriesPercentage`,
   `SearchLatency`, `SearchQueriesPerSecond`, `DocumentsProcessedCount`,
   `SkillExecutionCount`, `IndexVectorUsage`) and `AzureDiagnostics`
   (`Category == "OperationLogs"`, `OperationName`, `ResultType`,
   `ResultSignature`, `DurationMs`). Absent logs are not proof of zero traffic.

## Sources

- [Create a vector index](https://learn.microsoft.com/azure/search/vector-search-how-to-create-index) | [Create an index: field attribute defaults](https://learn.microsoft.com/azure/search/search-how-to-create-search-index#configure-field-definitions)
- [Monitoring data reference](https://learn.microsoft.com/azure/search/monitor-azure-cognitive-search-data-reference)
