---
name: azure-maf-hosting-deployment-py
description: This skill should be used when the user asks about "deploy agent", "host agent", "DevUI", "protocol adapter", "production deployment", "test agent locally", "agent hosting", "FastAPI hosting", or needs guidance on deploying, hosting, or testing Microsoft Agent Framework agents in Python production environments. Make sure to use this skill whenever the user mentions running an agent locally, testing agents in a browser, exposing agents over HTTP, choosing between DevUI and AG-UI, Azure Functions for agents, comparing Python vs .NET hosting, or any production deployment of MAF agents, even if they don't explicitly say "hosting" or "deployment".
version: 0.1.0
---

# MAF Hosting and Deployment - Python Production Guide

This skill covers production deployment and local testing of Microsoft Agent Framework (MAF) agents in Python. Use this skill when selecting hosting options, configuring DevUI for development testing, or planning production deployments. The hosting landscape differs significantly between Python and .NET: many ASP.NET protocol adapters are .NET-only; Python relies on DevUI for testing and AG-UI with FastAPI for production hosting.

## Python Deployment Landscape Overview

Most official hosting documentation describes ASP.NET Core integration. Distinguish clearly between what is available on each platform.

**Available in Python:**

- **DevUI**: Sample app for running and testing agents locally. Web interface + OpenAI-compatible Responses API. Not for production.
- **AG-UI via FastAPI**: Production-ready hosting using `add_agent_framework_fastapi_endpoint()`. Expose agents via HTTP with SSE streaming, thread management, and AG-UI protocol support. Cross-reference the **maf-ag-ui-py** skill for setup and configuration.
- **Azure Functions (durable agents)**: Host agents in serverless functions with durable state. Cross-reference the **maf-agent-types-py** skill for `AgentFunctionApp` and orchestration patterns.

**.NET-only (no Python equivalent):**

- **ASP.NET Core hosting**: `MapOpenAIChatCompletions`, `MapOpenAIResponses`, `MapA2A` – protocol adapters that map agents to OpenAI Chat Completions, Responses, and A2A endpoints.
- **Protocol adapter libraries**: `Microsoft.Agents.AI.Hosting.OpenAI`, `Microsoft.Agents.AI.Hosting.A2A.AspNetCore` – these NuGet packages have no Python equivalent.

**Planned for Python (check release notes for availability):**

- OpenAI Chat Completions / Responses integration (expose agents via OpenAI-compatible HTTP endpoints without AG-UI).
- A2A protocol integration for agent-to-agent communication.
- ASP.NET-equivalent hosting patterns for Python.

## DevUI as Primary Testing Tool

DevUI is the primary tool for testing MAF agents in Python before production deployment. It is a **sample application** intended for development only, not production.

### When to Use DevUI

DevUI is useful for:

- Visually debug and test agents and workflows interactively
- Validate agent behavior before integrating into a hosted application
- Use the OpenAI-compatible API to test with the OpenAI Python SDK
- Inspect OpenTelemetry traces for agent execution flow
- Iterate quickly on agent design without writing a custom hosting layer

### DevUI Capabilities

- **Web interface**: Interactive UI for chat-style testing
- **Directory-based discovery**: Automatically discover agents and workflows from a directory structure
- **In-memory registration**: Register entities programmatically via `serve(entities=[...])`
- **OpenAI-compatible Responses API**: Use `base_url="http://localhost:8080/v1"` with the OpenAI SDK
- **Tracing**: OpenTelemetry spans for agent execution, tool calls, and workflow steps
- **Sample gallery**: Browse and download examples when no entities are discovered

### Quick Start

**Programmatic registration:**

```python
from agent_framework import ChatAgent
from agent_framework.openai import OpenAIChatClient
from agent_framework.devui import serve

agent = ChatAgent(
    name="WeatherAgent",
    chat_client=OpenAIChatClient(),
    instructions="You are a helpful weather assistant."
)
serve(entities=[agent], auto_open=True)
```

**Directory discovery:**

```bash
pip install agent-framework-devui --pre
devui ./agents --port 8080
```

See **`references/devui.md`** for detailed setup, directory discovery, tracing, security, and API reference.

## AG-UI and FastAPI as the Python Hosting Path

For production deployment of MAF agents in Python, use **AG-UI with FastAPI**. The `agent-framework-ag-ui` package provides `add_agent_framework_fastapi_endpoint()`, which registers an agent as an HTTP endpoint with SSE streaming and AG-UI protocol support.

### Why AG-UI for Production

AG-UI provides:

- Remote agent hosting accessible by multiple clients
- Server-Sent Events (SSE) for real-time streaming
- Protocol-level thread management
- Human-in-the-loop approvals and state synchronization
- Compatibility with CopilotKit and other AG-UI clients

### Minimal FastAPI Hosting

```python
from agent_framework import ChatAgent
from agent_framework_ag_ui import add_agent_framework_fastapi_endpoint
from fastapi import FastAPI

agent = ChatAgent(chat_client=..., instructions="...")
app = FastAPI()
add_agent_framework_fastapi_endpoint(app, agent, "/")
```

For full AG-UI setup, human-in-the-loop, state management, and client configuration, consult the **maf-ag-ui-py** skill.

## Hosting Decision Framework

| If you need... | Choose | Why |
|----------------|--------|-----|
| Local agent iteration and trace inspection | DevUI | Fastest feedback loop during development |
| Production HTTP endpoint for frontend clients | AG-UI + FastAPI | Standardized streaming protocol and thread/run semantics |
| Durable serverless orchestration | Azure Functions durable agents | Built-in durability and orchestration hosting |
| OpenAI-compatible adapters (`MapOpenAI*`) | .NET hosting stack | Python equivalent is not generally available yet |

## Deployment Options Summary

| Option | Platform | Use Case | Production |
|--------|----------|----------|------------|
| DevUI | Python | Local testing, debugging, iteration | No |
| AG-UI + FastAPI | Python | Production web hosting, multi-client access | Yes |
| Azure Functions (durable) | Python | Serverless, durable orchestrations | Yes |
| ASP.NET MapOpenAI* | .NET only | OpenAI-compatible HTTP endpoints | Yes |
| ASP.NET MapA2A | .NET only | A2A protocol for agent-to-agent | Yes |

## General Deployment Concepts

### Environment and Credentials

Store API keys and secrets in environment variables or `.env` files. Never commit credentials to source control. Document required variables in `.env.example`.

### Observability

Enable OpenTelemetry tracing where available. DevUI captures and displays traces in its debug panel. For production, configure OTLP export to Jaeger, Zipkin, Azure Monitor, or Datadog. Set `OTLP_ENDPOINT` when using DevUI with tracing.

### Security

- Bind to localhost (`127.0.0.1`) for development.
- Use a reverse proxy (nginx, Caddy) for external access with HTTPS.
- Enable authentication when exposing beyond localhost. DevUI supports `--auth` with Bearer tokens.
- Use user mode (`--mode user`) in DevUI when sharing with non-developers to restrict developer APIs.
- For DevUI + MCP tools, prefer explicit cleanup/lifecycle handling for long-lived sessions.

## Additional Resources

### Reference Files

- **`references/devui.md`** – DevUI setup, directory discovery, tracing integration, security considerations, API reference, and Python sample patterns
- **`references/deployment-landscape.md`** – Full Python vs. .NET hosting comparison, Python hosting roadmap, AG-UI as the primary Python path, and cross-references to maf-ag-ui-py and maf-agent-types-py
- **`references/acceptance-criteria.md`** – Correct/incorrect patterns for DevUI setup, directory discovery, AG-UI hosting, Azure Functions, OpenAI SDK integration, tracing, security, resource cleanup, and platform selection

### Related Skills

- **maf-ag-ui-py** – FastAPI hosting with `add_agent_framework_fastapi_endpoint`, human-in-the-loop, state management, and client setup
- **maf-agent-types-py** – Durable agents via `AgentFunctionApp`, Azure Functions hosting, orchestration patterns

