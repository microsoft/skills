# Voice Agent Subtypes

Author Voice Agent services with canonical `kind: voice`. Silently recognize legacy `kind: prompt-voice` services as Voice Agents, and normalize them to `kind: voice` when editing.

Classify a Voice Agent in this exact order:

1. `subProtocol: live` -> **GPT-Live Voice**.
2. Otherwise, `conversationEngine.type: hosted_agent` -> **Hosted Voice wrapper**.
3. Otherwise, `modelType: managed` or `self_deployed` -> **Prompt Voice**.

Stop when discriminators conflict or none identifies a subtype; do not guess.

A Hosted Voice wrapper names a distinct `kind: hosted` target through `conversationEngine.name`. Selecting the wrapper includes that target as a dependency. A standalone `kind: hosted` service using `invocations_ws` is not a managed Voice Agent.
