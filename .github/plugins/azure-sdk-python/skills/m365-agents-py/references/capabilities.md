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
from msal import PublicClientApplication
from microsoft_agents.activity import ActivityTypes, load_configuration_from_env
from microsoft_agents.copilotstudio.client import (
    ConnectionSettings,
    CopilotClient,
)

# Token cache (local file for interactive flows)
class LocalTokenCache:
    # See samples for full implementation
    pass

def acquire_token(settings, app_client_id, tenant_id):
# ... see SKILL.md for the full example
```

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
