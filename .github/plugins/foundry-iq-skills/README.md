# Foundry IQ Skills

Get help with Foundry IQ (Azure AI Search), build agents that answer questions
using your documents, and explore connections across your data.

## Get started

In Copilot CLI, install the plugin:

```text
/plugin marketplace add microsoft/azure-skills
/plugin install foundry-iq-skills@azure-skills
```

Then try: **"Show me what Foundry IQ graph can do."** Copilot runs a preflight
and guides you through prerequisites, resource selection and approvals.

To update an installed plugin:

```text
/plugin update foundry-iq-skills@azure-skills
```

### Install in Codex

Codex loads the portable `plugin.json`, `mcp.json` and `skills/` at the plugin
root. Place this plugin folder at `<marketplace-root>/foundry-iq-skills` and
create `<marketplace-root>/.agents/plugins/marketplace.json`:

```json
{"name": "foundry-iq-local", "plugins": [{"name": "foundry-iq-skills",
  "source": {"source": "local", "path": "./foundry-iq-skills"},
  "policy": {"installation": "AVAILABLE", "authentication": "ON_INSTALL"},
  "category": "Productivity"}]}
```

Then register and install it, and start a new Codex session:

```text
codex plugin marketplace add <marketplace-root>
codex plugin add foundry-iq-skills@foundry-iq-local
codex mcp list
```

The `foundry-iq-graph` tools should be listed.

## What's included

| Need | How the plugin helps |
|---|---|
| Azure AI Search and Foundry IQ | Get guidance on indexes, keyword, vector and semantic search, access, ingestion, retrieval quality and grounded agents. |
| Try graphs end to end | A guided demo takes sample documents or your data through graph creation and questions. |
| Entity graphs | Provision or connect resources, extract entities and relationships, and answer multi-hop questions. |
| Topic graphs | Build and explore corpus-wide themes and publish topics for retrieval. |
| Ontologies | Draft, refine, review and export an ontology, or inspect versions and validate an OWL file. |
| Graph-backed grounding | Provision, build and query a grounding index. |

Graph and ontology requests use guided graph capabilities.
Ordinary skills remain CLI-first; MCP hosts that support Apps can also show
Entity Graph, Topic Graph, ontology and grounding Apps resources over MCP.
Other Search requests use shared context, security and API guidance with
official Azure documentation. This plugin is not for Microsoft Graph API,
other Azure products or continuous evaluation.

## Prerequisites

- A supported agent client, such as
  [GitHub Copilot CLI](https://github.com/github/copilot-cli), Claude Code,
  Cursor or Codex. GitHub Copilot CLI is the host tested end to end.
  [Git](https://git-scm.com/) is needed to add a plugin marketplace.
- [Node.js](https://nodejs.org/) and npm for Azure MCP Server. The graph MCP
  launcher also uses Node.js; the optional viewer needs **22.13 or later**.
- For graph workflows, [Python](https://www.python.org/downloads/) **3.12, 3.13
  or 3.14**, with standard `venv` and `pip`. Runtime setup needs access to your
  configured Python package sources; the plugin does not install Python.
- For live graph operations, [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
  and an identity signed in to the intended tenant:

  ```powershell
  az login --tenant "<tenant-id-or-domain>"
  ```

- Access to the target subscription and resources, including the permissions
  needed for the requested operation. Creating role assignments requires
  additional authority; being signed in is not sufficient.

**For the complete graph demo, use Windows x64 or Linux x64/ARM64.** Python
runtime setup also supports macOS Apple Silicon, but the native Topic Graph
build executable does not support macOS; do not expect the full demo there.

For graph builds, have documents or use the supplied Microsoft earnings-call
sample. You can connect compatible existing Search, Storage and chat/embedding
model deployments, or approve creation of new resources. Graph features must
be available in the chosen Search region and service; model availability,
quota and permissions are checked for your selected resources. A Free-tier or
key-only Search service is not compatible with the existing-resource graph path.

You can ask for explanations and planning without Azure access. Live builds,
queries and resource changes require the corresponding access and services.

## Prepare the graph runtime

No source checkout, manual runtime archive, global Python package installation
or frontend build is required.

For explicit setup, replace `<installed-plugin>` with the installed plugin
folder containing `graph` and `skills`. Run from your workspace:

```powershell
python -I "<installed-plugin>\graph\runtime\bootstrap.py" setup entity
```

On macOS and Linux, use forward slashes in the path.

Set up `topicgraph`, `ontology` or `grounding` in place of `entity` when the
chosen procedure needs that domain. Setup verifies bundled artifacts and
dependency locks and prepares an isolated external cache using configured
package sources; it makes no Azure or model calls. First use may also prepare
an absent cache. Topic Graph may download its native builder with your approval.

If Python discovery picks the wrong interpreter, set `FOUNDRY_IQ_PYTHON` to an
absolute Python 3.12, 3.13 or 3.14 executable and rerun setup. The graph MCP
server starts through `graph/runtime/launch-python.mjs`, which looks for Python
on the host's PATH; if none is found, set `FOUNDRY_IQ_PYTHON` in the
environment your host starts from. The plugin never changes your global PATH
or project dependencies. Runtime locks cover Windows x64, Linux x64/ARM64 and
macOS Apple Silicon; macOS Intel is not supported. See
[route checks](skills/foundry-iq/workflows/graph/graph-guide/references/install-and-checks.md)
for details.

## Example prompts

- "Show me what Foundry IQ graph can do."
- "Run the Foundry IQ graph demo on a small sample of my documents."
- "Build a graph from the documents in my local folder."
- "Check whether my existing Search, Storage and OpenAI resources are ready for Entity Graph."
- "Show which organizations connect to Project X, with sources."
- "Find the main themes across my document collection."
- "Draft an ontology from these topics and help me review it."
- "Validate this OWL file and explain its classes."
- "Why are new documents missing from my Azure AI Search index?"
- "How can I combine keyword and vector search?"
- "Help me prepare a REST request for this Azure AI Search operation."

### Optional: explore in a browser

After a verified graph publication or cited answer, ask to open the Knowledge
Graph Playground. It is a local, read-only, selected-context viewer, not a
separate model-backed chat. Complete the
[viewer prerequisites](graph/apps-host/README.md), then run it with Node.js
22.13 or later:

```powershell
node "<installed-plugin>\graph\apps-host\launch.mjs" --config "<operator-config.json>"
```

Open the loopback URL it prints. Type `quit` or press Ctrl+C to stop it.

## Important callouts

- **Preview APIs.** Graph builds and some queries use `2026-11-01-preview`;
  other steps may use different fixed versions. You can't change these through
  the general skill. Check the graph guide for the version each workflow uses;
  not every Search service or region supports preview APIs.
- **Costs and approval.** Creating resources, indexing documents and asking
  model-backed questions can cost money, even with sample documents. Review
  and approve the specific resource, data and cost plan before changes. A
  changed plan needs new approval; approval to run a demo does not include
  cleanup or deletion.
- **Data access.** Graphs, summaries, topic indexes and caches are copies of
  source data, and do not automatically keep its access permissions. Check who
  can access them, keep links to the source, and plan for updates and revoked
  access. Never put keys, tokens or private document content in prompts or logs.
- **Resource reuse and cleanup.** Confirm which resources will be reused or
  created. Cleanup needs explicit approval and must leave shared or reused
  resources intact. Setup or connection checks alone don't prove that a build
  or end-to-end query succeeded.

## Learn more

- [Foundry IQ skill instructions](https://learn.microsoft.com/en-us/azure/developer/azure-skills/plugins/foundry-iq/foundry-iq)
- [Graph workflow](skills/foundry-iq/workflows/graph/graph.md)
- [Knowledge Graph Playground guide](graph/apps-host/README.md)
- [Azure AI Search documentation](https://learn.microsoft.com/azure/search/)
- [Foundry IQ and agentic retrieval](https://learn.microsoft.com/azure/search/agentic-retrieval-overview)
- [Hybrid search](https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview)
- [Document-level access control](https://learn.microsoft.com/azure/search/search-document-level-access-overview)
- [Azure AI Search API and SDK versions](https://learn.microsoft.com/azure/search/search-api-versions)
