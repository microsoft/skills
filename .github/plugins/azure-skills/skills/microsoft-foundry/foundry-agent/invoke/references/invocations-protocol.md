# Invocations Protocol Guide

The `invocations` protocol is **bytes in, bytes out**. The platform is pure pass-through — the raw HTTP request body is forwarded to the container and the raw response is returned. The agent developer defines what the container accepts and returns. Unlike `responses` (OpenAI-compatible with platform-managed history), `invocations` gives full control to the container code.

## Input/Output Contract

| Aspect | `responses` | `invocations` |
|--------|------------|---------------|
| **Input** | Natural language message | Raw HTTP request body from `--input-file`; format it as the container's invoke handler expects |
| **Output** | Structured OpenAI response with `output_text` | **Raw response bytes** from the container — JSON, text, or SSE events. Format is defined by the agent developer |
| **Conversation history** | Platform-managed; azd can persist the `conversationId` for reuse | Agent-managed via session filesystem |
| **Streaming** | Platform-managed | Agent-controlled |

## Discovering the Expected Input Schema

> ⚠️ **Do not guess the invocations request body.** The developer defines the schema in the container's invoke handler. The platform does not validate or transform the payload.

### 1. Fetch the OpenAPI Spec (Preferred)

Agents can register an OpenAPI spec that describes the expected request/response format. Fetch it from:

```text
GET {projectEndpoint}/agents/{agentName}/endpoint/protocols/invocations/docs/openapi.json
```

If the developer registered an `openapi_spec` when creating the server, this returns the full API contract. If not registered, it returns 404.

### 2. Inspect Agent Source Code

Look at the agent's invoke handler — the function registered with `@app.invoke_handler` (Python) or equivalent. The handler reads the raw request (e.g., `request.json()` for JSON, `request.body()` for raw bytes) and returns a `Response`.

### 3. Ask the User

If neither the OpenAPI spec nor source code is available, ask the user for the expected request body format before invoking.

## Examples

**Responses protocol** (default):

```bash
azd ai agent invoke "What is the weather in Seattle?"
```

**Invocations protocol** — agent expects `{"message": "<text>"}`:

```bash
azd ai agent invoke --protocol invocations --input-file request.json
```

Use `--output raw` when the unmodified status line, headers, and body are required. azd reuses the saved session automatically; use `--new-session` to reset agent-managed state.

## Common Use Cases

| Scenario | Why Invocations |
|----------|----------------|
| Webhook receiver (GitHub, Stripe, Jira) | External system sends its own payload format |
| Non-conversational processing (classification, extraction) | Input is structured data, not a chat message |
| Custom streaming protocol (AG-UI) | Needs raw SSE control, not OpenAI-compatible streaming |
| Protocol bridge (proprietary systems) | Caller has its own protocol that doesn't map to `/responses` |

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| 400/422 or invocation failed | Request body does not match what the container expects | Fetch OpenAPI spec or inspect handler code for the correct schema |
| 404 on OpenAPI spec | Developer did not register an `openapi_spec` | Inspect handler source code or ask the user for the API contract |
| Empty response | Agent returned no content | Check logs with `azd ai agent monitor`; verify the handler processes the request body correctly |
