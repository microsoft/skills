# Foundry IQ Skills

Build grounded knowledge experiences with [Azure AI Search (Foundry IQ)](https://learn.microsoft.com/azure/search/agentic-retrieval-overview).

This plugin helps GitHub Copilot CLI create and use Foundry IQ knowledge bases, using your existing Azure resources when possible.

## Security

> [!WARNING]
> The `foundry-iq-skills` plugin uses `npx` to download and run the Azure MCP Server, inheriting the local environment's `.npmrc` configuration. Install this plugin only on trusted devices. A compromised `.npmrc` configuration could cause `npx` to download and execute malicious code, potentially resulting in remote code execution.

## Skill

- **foundry-iq**: Build, connect, query, and troubleshoot Foundry IQ knowledge experiences using supported Azure resources.

## What it helps with

- Create or reuse an Azure AI Search (Foundry IQ) service
- Create a File knowledge source from local files
- Create a knowledge source from Azure Blob Storage or Azure Data Lake Storage
- Create a knowledge base and validate that its content is searchable
- Query an existing knowledge base and return citations
- Connect an existing knowledge base to an agent
- Diagnose knowledge base failures and unsupported requests
- Prepare a cleanup plan for resources created by the workflow

The skill is intended for Foundry IQ knowledge-base workflows. It does not support classic Azure AI Search (Foundry IQ) application, index, or query development, generic agent creation, or repository-file search.

## Prerequisites

- [Git](https://git-scm.com/downloads), required to add the plugin marketplace
- [GitHub Copilot CLI](https://github.com/github/copilot-cli)
- [Python 3.12 or later](https://www.python.org/downloads/), required to run the plugin's helper scripts
- Access to the Azure subscriptions and resources involved in your request
- An authenticated Azure identity with the permissions required for the requested read or change

If you use Azure CLI for authentication, install the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) and sign in:

```bash
az login
```

The plugin supports Copilot CLI on Windows and Linux. Depending on the task, it uses supported Azure SDK, REST, infrastructure-as-code, Azure MCP Server, or native knowledge-base MCP interfaces.

## Installation

Run these commands in Copilot CLI:

```text
/plugin marketplace add microsoft/azure-skills
/plugin install foundry-iq-skills@azure-skills
```

To update the plugin:

```text
/plugin update foundry-iq-skills@azure-skills
```

## Example prompts

- "Create a knowledge base from `./docs`."
- "Create a knowledge base from this Blob container."
- "Query this knowledge base with citations."
- "Connect this knowledge base to my existing agent."
- "Why is retrieval from this knowledge base failing?"

## Before changes are made

The skill starts with read-only checks and can reuse Azure resources you identify. It asks whether to use an existing service, find compatible services, or create a new one before performing broader discovery.

It asks for your approval before it:

- Creates an Azure AI Search (Foundry IQ) service, knowledge source, or knowledge base
- Connects a knowledge base to an agent
- Makes another planned change to Azure resources

Approval applies to the plan shown to you. If the plan changes, the skill asks again. Cleanup is handled as a separate planning workflow. The skill can also perform supported deletion of workflow-owned resources after separate approval.

## Learn more

- [Azure AI Search (Foundry IQ) overview](https://learn.microsoft.com/azure/search/search-what-is-azure-search)
- [Foundry IQ and agentic retrieval](https://learn.microsoft.com/azure/search/agentic-retrieval-overview)
- [Azure AI Search (Foundry IQ) API and SDK versions](https://learn.microsoft.com/azure/search/search-api-versions)
- [Azure AI Search (Foundry IQ) REST API](https://learn.microsoft.com/en-us/rest/api/searchservice/?source=recommendations)
- [Azure MCP Server tools for Azure AI Search (Foundry IQ)](https://learn.microsoft.com/azure/developer/azure-mcp-server/tools/azure-ai-search)
- [Foundry IQ skill details](skills/foundry-iq/SKILL.md)
