---
name: chat
description: "Chat completion patterns with Foundry Local's OpenAI-compatible API. Covers streaming, multi-turn conversations, temperature tuning, and conversation history management. WHEN: foundry local chat, local LLM chat, streaming response, chat completion, conversation history, multi-turn, OpenAI SDK with foundry, api_key not-required, stream tokens, on-device chat, local inference, chat parameters."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Foundry Local Chat Completions

This skill provides patterns for chat completions using Foundry Local's OpenAI-compatible API across Python, JavaScript, and C#.

## Triggers

Activate this skill when the user wants to:
- Create a chat completion with a local model
- Stream responses token by token
- Build multi-turn conversations with history
- Configure temperature, max_tokens, or other parameters
- Use the OpenAI SDK with Foundry Local

## Rules

1. **Always use `manager.endpoint`** for the base URL — never hardcode a port.
2. **API key is `"not-required"`** — Foundry Local does not authenticate.
3. **Use `model_info.id`** (the full hardware-specific ID) in API calls, not the alias.
4. **Streaming syntax differs across languages** — use the correct pattern for each.
5. For service setup, refer to **setup** skill.

---

## Single-Turn Chat (Non-Streaming)

### Python
```python
response = client.chat.completions.create(
    model=model_id,
    messages=[{"role": "user", "content": "What is the golden ratio?"}],
    temperature=0.7,
    max_tokens=512,
)
print(response.choices[0].message.content)
```

### JavaScript
```javascript
const response = await client.chat.completions.create({
    model: modelInfo.id,
    messages: [{ role: "user", content: "What is the golden ratio?" }],
    temperature: 0.7,
    max_tokens: 512,
});
console.log(response.choices[0].message.content);
```

### C#
```csharp
var chatClient = client.GetChatClient(model.Id);
var result = await chatClient.CompleteChatAsync("What is the golden ratio?");
Console.WriteLine(result.Value.Content[0].Text);
```

---

## Streaming Chat

Streaming returns tokens as they are generated, providing a responsive user experience.

### Python
```python
stream = client.chat.completions.create(
    model=model_id,
    messages=[{"role": "user", "content": "What is the golden ratio?"}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="", flush=True)
print()
```

### JavaScript
```javascript
const stream = await client.chat.completions.create({
    model: modelInfo.id,
    messages: [{ role: "user", content: "What is the golden ratio?" }],
    stream: true,
});

for await (const chunk of stream) {
    if (chunk.choices[0]?.delta?.content) {
        process.stdout.write(chunk.choices[0].delta.content);
    }
}
console.log();
```

### C#
```csharp
var chatClient = client.GetChatClient(model.Id);
var updates = chatClient.CompleteChatStreaming("What is the golden ratio?");

foreach (var update in updates)
{
    if (update.ContentUpdate.Count > 0)
    {
        Console.Write(update.ContentUpdate[0].Text);
    }
}
Console.WriteLine();
```

---

## Multi-Turn Conversations

Foundry Local is stateless — you must maintain conversation history yourself by appending each user message and assistant response.

### Python
```python
history = [
    {"role": "system", "content": "You are a helpful assistant."},
]

def chat(user_message):
    history.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model=model_id,
        messages=history,
        temperature=0.7,
        max_tokens=512,
    )

    assistant_reply = response.choices[0].message.content
    history.append({"role": "assistant", "content": assistant_reply})
    return assistant_reply
```

### JavaScript
```javascript
const history = [
    { role: "system", content: "You are a helpful assistant." },
];

async function chat(userMessage) {
    history.push({ role: "user", content: userMessage });

    const response = await client.chat.completions.create({
        model: modelInfo.id,
        messages: history,
        temperature: 0.7,
        max_tokens: 512,
    });

    const reply = response.choices[0].message.content;
    history.push({ role: "assistant", content: reply });
    return reply;
}
```

### C#
```csharp
var messages = new List<ChatMessage>
{
    new SystemChatMessage("You are a helpful assistant."),
};

async Task<string> ChatAsync(string userMessage)
{
    messages.Add(new UserChatMessage(userMessage));

    var result = await chatClient.CompleteChatAsync(messages);
    var reply = result.Value.Content[0].Text;

    messages.Add(new AssistantChatMessage(reply));
    return reply;
}
```

---

## Common Pitfalls

| Mistake | Impact | Fix |
|---------|--------|-----|
| Forgetting to append assistant message to history | Model loses context each turn | Always `history.append({"role": "assistant", ...})` |
| Using alias instead of full model ID in API calls | May fail or select wrong variant | Use `manager.get_model_info(alias).id` |
| Hardcoding `http://localhost:5000/v1` | Fails when port changes | Use `manager.endpoint` |
| Setting `stream=True` but reading `.message.content` | Content is in `.delta.content` for streams | Check `chunk.choices[0].delta.content` |

---

## REST API (cURL)

You can also call the API directly. Get the port from `foundry service status`:

```bash
curl http://localhost:<PORT>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "<full-model-id>",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100,
    "temperature": 0.7
  }'
```

---

## Parameters Reference

| Parameter | Default | Notes |
|-----------|---------|-------|
| `temperature` | 1.0 | Lower = more deterministic, higher = more creative |
| `max_tokens` | model-specific | Maximum tokens to generate |
| `top_p` | 1.0 | Nucleus sampling threshold |
| `stream` | `false` | Enable token-by-token streaming |
| `stop` | none | Stop sequences |

---

## Cross-References

- For service setup and model management, see **setup**
- For grounding chat with local data, see **rag**
- For agents with system instructions, see **agents**
