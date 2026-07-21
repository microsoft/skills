# m365-agents-py capability coverage

**SDK/package**: `microsoft-agents-hosting-core, microsoft-agents-hosting-aiohttp, microsoft-agents-activity, microsoft-agents-authentication-msal, microsoft-agents-copilotstudio-client`

This reference mirrors the actual capability sections in `SKILL.md` and provides concrete non-hero examples for implementation guidance.

## Hero scenarios covered in SKILL.md

- `Core Workflow: aiohttp-hosted AgentApplication`
- `AgentApplication Routing`
- `Streaming Responses with Azure OpenAI`
- `OAuth / Auto Sign-In`

## Important non-hero scenarios with examples

### `Copilot Studio Client (Direct to Engine)`

```python
import asyncio
from os import environ
from msal import PublicClientApplication
from microsoft_agents.activity import ActivityTypes
from microsoft_agents.copilotstudio.client import (
    ConnectionSettings,
    CopilotClient,
)


def acquire_token(app_client_id: str, tenant_id: str) -> str:
    pca = PublicClientApplication(
        client_id=app_client_id,
        authority=f"https://login.microsoftonline.com/{tenant_id}",
    )

    scopes = ["https://api.powerplatform.com/.default"]
    accounts = pca.get_accounts()

    if accounts:
        response = pca.acquire_token_silent(scopes, account=accounts[0])
    else:
        response = pca.acquire_token_interactive(scopes=scopes)

    return response["access_token"]


async def main() -> None:
    settings = ConnectionSettings(
        environment_id=environ["COPILOTSTUDIOAGENT__ENVIRONMENTID"],
        agent_identifier=environ["COPILOTSTUDIOAGENT__SCHEMANAME"],
    )

    token = acquire_token(
        app_client_id=environ["COPILOTSTUDIOAGENT__AGENTAPPID"],
        tenant_id=environ["COPILOTSTUDIOAGENT__TENANTID"],
    )

    # CopilotClient does not implement the context manager protocol; close
    # any underlying resources explicitly when your application shuts down.
    copilot_client = CopilotClient(settings, token)

    # Start conversation and collect the opening activities
    opening_activities = copilot_client.start_conversation(True)
    async for activity in opening_activities:
        if activity.text:
            print(activity.text)

    # Send a message and iterate replies; CopilotClient retains the conversation ID
    replies = copilot_client.ask_question("Hello!")
    async for reply in replies:
        if reply.type == ActivityTypes.message:
            print(reply.text)


asyncio.run(main())
```

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
