# Governance with Microsoft Purview - Microsoft Agent Framework Python

This reference covers integrating Microsoft Purview with Microsoft Agent Framework Python for data security, DLP policy enforcement, audit logging, and compliance.

---

## Overview

Microsoft Purview provides enterprise-grade data security, compliance, and governance for AI applications. By adding `PurviewPolicyMiddleware` to an agent's middleware pipeline, prompts and responses are evaluated against Purview DLP policies before and after AI inference. Violations can block execution; compliant interactions are logged for audit and compliance workflows.

### Benefits

- **Prevent sensitive data leaks**: Inline blocking of sensitive content based on Data Loss Prevention (DLP) policies
- **Enable governance**: Log AI interactions for Audit, Communication Compliance, Insider Risk Management, eDiscovery, and Data Lifecycle Management
- **Accelerate adoption**: Enterprise customers require compliance for AI apps; Purview integration unblocks deployment

---

## Prerequisites

- Microsoft Azure subscription with Microsoft Purview configured
- Microsoft 365 subscription with an E5 license and pay-as-you-go billing (or Microsoft 365 Developer Program tenant for testing)
- Agent Framework SDK: `pip install agent-framework --pre`
- Purview integration: `pip install agent-framework-purview`

---

## Installation

```bash
pip install agent-framework-purview
```

The package depends on `agent-framework` and adds `PurviewPolicyMiddleware` and `PurviewSettings` from `agent_framework.microsoft`.

---

## Basic Integration

### Minimal Example

```python
import asyncio
import os
from agent_framework import ChatAgent, ChatMessage, Role
from agent_framework.azure import AzureOpenAIChatClient
from agent_framework.microsoft import PurviewPolicyMiddleware, PurviewSettings
from azure.identity import AzureCliCredential, InteractiveBrowserCredential

os.environ.setdefault("AZURE_OPENAI_ENDPOINT", "<azureOpenAIEndpoint>")
os.environ.setdefault("AZURE_OPENAI_CHAT_DEPLOYMENT_NAME", "<azureOpenAIChatDeploymentName>")

async def main():
    chat_client = AzureOpenAIChatClient(credential=AzureCliCredential())
    purview_middleware = PurviewPolicyMiddleware(
        credential=InteractiveBrowserCredential(
            client_id="<clientId>",
        ),
        settings=PurviewSettings(app_name="My Secure Agent")
    )
    agent = ChatAgent(
        chat_client=chat_client,
        instructions="You are a secure assistant.",
        middleware=[purview_middleware]
    )
    response = await agent.run(ChatMessage(role=Role.USER, text="Summarize zero trust in one sentence."))
    print(response)

if __name__ == "__main__":
    asyncio.run(main())
```

### Credential Options

Use `InteractiveBrowserCredential` for interactive sign-in during development. For production, use service principal or managed identity credentials:

```python
from azure.identity import DefaultAzureCredential

purview_middleware = PurviewPolicyMiddleware(
    credential=DefaultAzureCredential(),
    settings=PurviewSettings(app_name="My Secure Agent")
)
```

### PurviewSettings

| Parameter | Description |
|-----------|-------------|
| `app_name` | Application name for audit and logging in Purview |
| (others) | See Purview SDK documentation for additional configuration |

---

## Entra Registration

Register your agent in Microsoft Entra ID and grant the required Microsoft Graph permissions:

1. [Register an application in Microsoft Entra ID](https://learn.microsoft.com/entra/identity-platform/quickstart-register-app)
2. Add the following permissions to the Service Principal:
   - [ProtectionScopes.Compute.All](/graph/api/userprotectionscopecontainer-compute) – For policy evaluation
   - [ContentActivity.Write](/graph/api/activitiescontainer-post-contentactivities) – For audit logging
   - [Content.Process.All](/graph/api/userdatasecurityandgovernance-processcontent) – For content processing

3. Use the Entra app ID as `client_id` when using `InteractiveBrowserCredential`, or configure the service principal for `DefaultAzureCredential`

See [dataSecurityAndGovernance resource type](https://learn.microsoft.com/graph/api/resources/datasecurityandgovernance) for details.

---

## Purview Policies

Configure Purview policies to define what content is blocked or logged:

1. Use the Microsoft Entra app ID from the registration above
2. [Configure Microsoft Purview](https://learn.microsoft.com/purview/developer/configurepurview) to enable agent communications data flow
3. Define DLP policies that apply to your agent's prompts and responses

Policies determine:
- Which sensitive data types trigger blocks (e.g., PII, financial data)
- Whether to block, log, or allow with warnings
- How data flows into Purview for Audit, Communication Compliance, Insider Risk Management, and eDiscovery

---

## DLP Policy Behavior

When `PurviewPolicyMiddleware` is in the pipeline:

1. **Before inference**: User prompts are evaluated against DLP policies. If a policy violation is detected, the middleware can terminate the request and return a safe response instead of calling the AI.
2. **After inference**: AI responses are evaluated. If a violation is detected, the response can be blocked or redacted before returning to the user.
3. **Logging**: Compliant (and optionally non-compliant) interactions are logged to Purview for audit and compliance workflows.

The exact behavior depends on how Purview policies are configured (block, warn, audit-only, etc.).

---

## Combining with Other Middleware

Purview middleware is a chat middleware: it intercepts chat requests and responses. Combine it with agent and function middleware for layered governance:

```python
from agent_framework.microsoft import PurviewPolicyMiddleware, PurviewSettings
from azure.identity import DefaultAzureCredential

purview_middleware = PurviewPolicyMiddleware(
    credential=DefaultAzureCredential(),
    settings=PurviewSettings(app_name="Enterprise Assistant")
)

agent = ChatAgent(
    chat_client=chat_client,
    instructions="You are a secure enterprise assistant.",
    middleware=[
        logging_agent_middleware,   # Log all runs
        purview_middleware,         # DLP and audit
        timing_function_middleware, # Track function latencies
    ]
)
```

Order matters: middleware executes in sequence. Placing Purview early ensures all prompts and responses pass through DLP checks.

---

## Audit Logging

Purview audit logging captures:

- Timestamps and user/service identities
- Prompts and responses (subject to policy and retention settings)
- Function call arguments and results (when applicable)
- Policy evaluation outcomes

Use Purview and Microsoft 365 Compliance Center to:

- Search audit logs for AI interactions
- Integrate with Communication Compliance, Insider Risk Management, and eDiscovery
- Meet regulatory requirements (GDPR, HIPAA, etc.)

---

## Compliance Patterns

### Pattern 1: Block Sensitive Content

Configure Purview DLP to block prompts or responses containing PII, financial data, or other sensitive types. The middleware prevents the request from reaching the AI or blocks the response from reaching the user.

### Pattern 2: Audit-Only Mode

Configure policies to log without blocking. Use for:
- Monitoring adoption and usage
- Identifying training or policy improvements
- Compliance reporting without disrupting users

### Pattern 3: Per-Request Override

Use run-level middleware to apply Purview only to specific runs:

```python
result = await agent.run(
    "Sensitive query here",
    middleware=[purview_middleware]
)
```

Agent-level middleware applies to all runs; run-level adds Purview only when needed.

### Pattern 4: Layered Validation

Combine Purview with custom validation middleware:

```python
async def custom_validation_middleware(context, next):
    # Custom checks before Purview
    if not is_user_authorized(context):
        context.terminate = True
        return
    await next(context)

agent = ChatAgent(
    chat_client=chat_client,
    instructions="...",
    middleware=[custom_validation_middleware, purview_middleware]
)
```

---

## Error Handling

Purview middleware may raise exceptions for:
- Authentication failures (invalid or expired credentials)
- Network or service unavailability
- Configuration errors (missing permissions, invalid app registration)

Handle these in your application or wrap the agent run in try/except:

```python
try:
    response = await agent.run(user_message)
except Exception as e:
    logger.error("Purview or agent error: %s", e)
    # Fallback behavior: block, retry, or return safe message
```

---

## Resources

- [PyPI: agent-framework-purview](https://pypi.org/project/agent-framework-purview/)
- [GitHub: Microsoft Agent Framework Purview Integration (Python)](https://github.com/microsoft/agent-framework/tree/main/python/packages/purview)
- [Code Sample: Purview Policy Enforcement (Python)](https://github.com/microsoft/agent-framework/tree/main/python/samples/getting_started/purview_agent)
- [Create and run an agent with Agent Framework](https://learn.microsoft.com/agent-framework/tutorials/agents/run-agent?pivots=programming-language-python)
