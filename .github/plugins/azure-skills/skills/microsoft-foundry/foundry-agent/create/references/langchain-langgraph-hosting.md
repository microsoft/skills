# LangChain and LangGraph Hosting

Use this guidance when creating, migrating, or re-hosting a LangChain or LangGraph agent on Foundry.

## Design Intent

Preserve the agent's existing framework behavior and minimize migration-specific code. Choose the least invasive hosting path that satisfies the requested behavior.

Treat migration as additive. Do not delete or replace user-authored code, and do not remove existing dependencies. Add only the hosting configuration, files, and dependencies required to run the existing agent on Foundry.

Do not add, remove, or replace the agent's checkpointer unless the user explicitly requests a checkpointing change. Checkpointing belongs to the agent's application logic, not its hosting configuration.

## Hosting Decision

| Need | Hosting path |
|------|--------------|
| Standard LangChain or LangGraph agent hosting with no custom server behavior | **Configuration-only** |
| Custom request handling, protocol behavior, lifecycle control, or other hosting behavior that configuration cannot express | **Host server integration** |

Prefer configuration-only hosting unless the user explicitly requests custom hosting behavior or the existing agent demonstrably requires it. Do not add host server integration merely because the project already contains agent code.

## Sample Selection

Use the parent workflow's azd sample selection guidance. For configuration-only hosting, select the sample matching the required protocol:

| Protocol | Sample |
|----------|--------|
| Responses | [Configuration-driven agent (Responses, LangGraph, Python)](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/responses/10-run/azure.yaml) |
| Invocations | [Configuration-driven agent (Invocations, LangGraph, Python)](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/invocations/03-run/azure.yaml) |

Use a host server integration sample only when the hosting decision above requires that path.

Samples provide hosting patterns only. Use their manifests, adapters, protocol wiring, and deployment configuration as references; do not treat sample application structure or conventions as the desired final application.