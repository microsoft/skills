# Detect an existing Python framework

Check the agent source root (the service's `project` path in `azure.yaml` for a Foundry hosted agent) for `langgraph.json` or a direct `langchain`, `langgraph`, or `langchain-azure-ai` dependency (including extras such as `[hosting]`) in `pyproject.toml` or `requirements.txt`.

If found, read [LangChain and LangGraph hosting](./langchain-langgraph-hosting.md) before answering or editing, even for plan-only requests. State that LangChain / LangGraph is the existing framework and name the manifest evidence, even if the exact hosting adapter is unknown. Do not ask the user to choose the framework again.
