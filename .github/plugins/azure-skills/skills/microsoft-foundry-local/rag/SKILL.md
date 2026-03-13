---
name: rag
description: "Build Retrieval-Augmented Generation (RAG) pipelines with Foundry Local. Covers knowledge base design, retrieval strategies, context injection, and prompt templates — all running on-device with no cloud dependencies. WHEN: RAG pipeline, retrieval augmented generation, ground answers in data, knowledge base, local search, context injection, foundry local RAG, on-device RAG, document grounding, chunk retrieval."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Foundry Local RAG Pipelines

This skill provides patterns for building Retrieval-Augmented Generation (RAG) pipelines that run entirely on-device with Foundry Local — no cloud, vector database, or embeddings API required.

## Triggers

Activate this skill when the user wants to:
- Build a RAG pipeline with Foundry Local
- Ground LLM answers in local data or documents
- Create a local knowledge base
- Implement retrieval (keyword or semantic) for prompt augmentation
- Design system prompts that inject retrieved context

## Rules

1. RAG = **Retrieve** relevant context + **Augment** the prompt + **Generate** a grounded answer.
2. Start with keyword-overlap retrieval (zero dependencies) before suggesting vector search.
3. Always instruct the model to use only the provided context — prevents hallucination.
4. Keep retrieved chunks concise — local models have limited context windows (typically 4K–16K tokens).
5. For service setup, refer to **setup** skill.

---

## Architecture

```
User Question
      │
      ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Retrieve    │────►│  Augment     │────►│  Generate    │
│  (search     │     │  (build      │     │  (LLM call   │
│   knowledge  │     │   prompt     │     │   with       │
│   base)      │     │   with       │     │   context)   │
│              │     │   context)   │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## Step 1: Define a Knowledge Base

Structure your data as a list of chunks, each with a title and content:

### Python
```python
KNOWLEDGE_BASE = [
    {
        "title": "Foundry Local Overview",
        "content": (
            "Foundry Local brings the power of Azure AI Foundry to your local "
            "device without requiring an Azure subscription..."
        ),
    },
    {
        "title": "Supported Hardware",
        "content": (
            "Foundry Local automatically selects the best model variant for "
            "your hardware. NVIDIA CUDA, Qualcomm NPU, or CPU..."
        ),
    },
]
```

### JavaScript
```javascript
const KNOWLEDGE_BASE = [
    {
        title: "Foundry Local Overview",
        content: "Foundry Local brings the power of Azure AI Foundry...",
    },
    {
        title: "Supported Hardware",
        content: "Foundry Local automatically selects the best model variant...",
    },
];
```

---

## Step 2: Implement Retrieval

### Keyword Overlap (Simple — No Dependencies)

Scores chunks by word overlap with the query. Good for getting started:

#### Python
```python
def retrieve(query, knowledge_base, top_k=2):
    query_words = set(query.lower().split())
    scored = []
    for chunk in knowledge_base:
        chunk_words = set(chunk["content"].lower().split())
        overlap = len(query_words & chunk_words)
        scored.append((overlap, chunk))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored[:top_k]]
```

#### JavaScript
```javascript
function retrieve(query, knowledgeBase, topK = 2) {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    return knowledgeBase
        .map(chunk => {
            const chunkWords = new Set(chunk.content.toLowerCase().split(/\s+/));
            const overlap = [...queryWords].filter(w => chunkWords.has(w)).length;
            return { overlap, chunk };
        })
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, topK)
        .map(item => item.chunk);
}
```

### When to Upgrade

| Approach | Dependencies | Best For |
|----------|-------------|----------|
| Keyword overlap | None | Prototyping, small knowledge bases (<100 chunks) |
| TF-IDF | `scikit-learn` | Medium knowledge bases, better relevance |
| Embedding similarity | Embedding model + numpy | Large knowledge bases, semantic matching |

---

## Step 3: Augment the Prompt

Build a system prompt that injects the retrieved context and instructs the model to use only that information:

### Python
```python
def build_rag_prompt(question, retrieved_chunks):
    context = "\n".join(
        f"- {chunk['title']}: {chunk['content']}" for chunk in retrieved_chunks
    )
    system_prompt = (
        "You are a helpful assistant. Answer the user's question using "
        "ONLY the context provided below. If the context does not contain "
        "enough information, say so.\n\n"
        f"Context:\n{context}"
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": question},
    ]
```

### JavaScript
```javascript
function buildRagPrompt(question, retrievedChunks) {
    const context = retrievedChunks
        .map(c => `- ${c.title}: ${c.content}`)
        .join("\n");

    return [
        {
            role: "system",
            content:
                "You are a helpful assistant. Answer the user's question using " +
                "ONLY the context provided below. If the context does not contain " +
                "enough information, say so.\n\n" +
                `Context:\n${context}`,
        },
        { role: "user", content: question },
    ];
}
```

---

## Step 4: Generate the Answer

### Python
```python
question = "What hardware does Foundry Local support?"
chunks = retrieve(question, KNOWLEDGE_BASE, top_k=2)
messages = build_rag_prompt(question, chunks)

response = client.chat.completions.create(
    model=model_id,
    messages=messages,
    temperature=0.3,  # Lower temperature for factual answers
    max_tokens=512,
)
print(response.choices[0].message.content)
```

### JavaScript
```javascript
const question = "What hardware does Foundry Local support?";
const chunks = retrieve(question, KNOWLEDGE_BASE, 2);
const messages = buildRagPrompt(question, chunks);

const response = await client.chat.completions.create({
    model: modelInfo.id,
    messages,
    temperature: 0.3,
    max_tokens: 512,
});
console.log(response.choices[0].message.content);
```

---

## Design Guidelines

| Guideline | Rationale |
|-----------|-----------|
| Use `temperature: 0.3` or lower | RAG answers should be factual, not creative |
| Limit to 2-3 retrieved chunks | Local models have limited context windows |
| Include "say so if context is insufficient" | Prevents hallucination when data is missing |
| Chunk content to 100-300 words each | Too long = context overflow; too short = missing info |
| Include source titles in context | Helps the model attribute information |

---

## Common Pitfalls

| Mistake | Impact | Fix |
|---------|--------|-----|
| No "use only this context" instruction | Model hallucinates beyond provided data | Add explicit grounding instruction in system prompt |
| Retrieving too many chunks | Exceeds context window, degrades quality | Limit `top_k` to 2-3 for small models |
| High temperature (>0.7) for RAG | Generates creative but inaccurate answers | Use 0.1-0.3 for factual grounding |
| Not chunking documents | Entire documents overwhelm context | Split into focused 100-300 word chunks |

---

## Cross-References

- For service setup, see **setup**
- For basic chat patterns, see **chat**
- For agents with persistent instructions, see **agents**
- For testing RAG quality systematically, see **evaluation**
