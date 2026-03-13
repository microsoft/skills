---
name: evaluation
description: "Test and evaluate LLM output quality with Foundry Local. Covers golden datasets, rule-based scoring, LLM-as-judge patterns, side-by-side prompt comparison, and handling service crashes under sustained load. WHEN: evaluate LLM, golden dataset, LLM as judge, prompt comparison, test AI output, eval framework, benchmark local model, quality scoring, evaluate agent, prompt engineering, A/B test prompts, regression testing."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Foundry Local Evaluation Framework

This skill provides patterns for systematically testing and evaluating LLM output quality using Foundry Local — entirely on-device.

## Triggers

Activate this skill when the user wants to:
- Create a golden dataset for testing AI responses
- Implement rule-based checks (keyword coverage, length, forbidden terms)
- Use LLM-as-judge scoring with a rubric
- Compare prompt variants side by side
- Build a regression testing framework for prompts
- Systematically test agent quality

## Rules

1. **Use golden datasets** — define expected outputs before testing, not after.
2. **Combine rule-based and LLM-based scoring** — rules catch obvious issues, LLM judges catch nuance.
3. **Handle HTTP 500 under sustained load** — the service may crash after ~13-15 completions; add try/catch with fallback.
4. **Lower temperature for evaluation** — use 0.1 for LLM-as-judge to get consistent scoring.
5. For service setup, refer to **setup** skill.

---

## Architecture

```
Golden Dataset          Prompt Variants          Scoring
┌──────────────┐       ┌───────────────┐       ┌──────────────┐
│ Test cases   │──────►│ Agent run     │──────►│ Rule-based   │
│ with expected│       │ with variant  │       │   + LLM      │
│ keywords     │       │ system prompt │       │   judge      │
└──────────────┘       └───────────────┘       └──────────────┘
                                                      │
                                               ┌──────▼──────┐
                                               │ Comparison  │
                                               │ Report      │
                                               └─────────────┘
```

---

## Step 1: Define a Golden Dataset

Each test case includes an input, expected keywords, and a category:

### Python
```python
GOLDEN_DATASET = [
    {
        "input": "What tools do I need to build a wooden deck?",
        "expected": ["saw", "drill", "screws", "level", "tape measure"],
        "category": "product-recommendation",
    },
    {
        "input": "How do I fix a leaky kitchen faucet?",
        "expected": ["wrench", "washer", "plumber", "valve", "seal"],
        "category": "repair-guidance",
    },
    {
        "input": "How do I safely use a circular saw?",
        "expected": ["safety", "glasses", "guard", "clamp", "blade"],
        "category": "safety-advice",
    },
]
```

### JavaScript
```javascript
const GOLDEN_DATASET = [
    {
        input: "What tools do I need to build a wooden deck?",
        expected: ["saw", "drill", "screws", "level", "tape measure"],
        category: "product-recommendation",
    },
    {
        input: "How do I fix a leaky kitchen faucet?",
        expected: ["wrench", "washer", "plumber", "valve", "seal"],
        category: "repair-guidance",
    },
];
```

---

## Step 2: Define Prompt Variants

Compare different system prompts to find the most effective one:

```python
PROMPT_VARIANTS = {
    "baseline": (
        "You are a helpful assistant. Answer the user's question clearly."
    ),
    "specialised": (
        "You are a DIY expert. Recommend specific tools and materials, "
        "provide step-by-step guidance, and include safety tips."
    ),
}
```

---

## Step 3: Rule-Based Scoring

Deterministic checks that don't require an LLM call:

### Python
```python
FORBIDDEN_TERMS = ["home depot", "lowes", "amazon"]

def score_rules(response, expected_keywords):
    words = response.lower().split()
    word_count = len(words)
    response_lower = response.lower()

    # Length check: 50-500 words
    length_score = 1.0 if 50 <= word_count <= 500 else 0.0

    # Keyword coverage
    found = [kw for kw in expected_keywords if kw.lower() in response_lower]
    keyword_score = len(found) / len(expected_keywords) if expected_keywords else 1.0

    # Forbidden terms
    forbidden_found = [t for t in FORBIDDEN_TERMS if t in response_lower]
    forbidden_score = 0.0 if forbidden_found else 1.0

    combined = (length_score + keyword_score + forbidden_score) / 3.0

    return {
        "length_score": length_score,
        "keyword_score": keyword_score,
        "keywords_found": found,
        "keywords_missing": [kw for kw in expected_keywords if kw.lower() not in response_lower],
        "forbidden_score": forbidden_score,
        "combined": round(combined, 2),
    }
```

### JavaScript
```javascript
const FORBIDDEN_TERMS = ["home depot", "lowes", "amazon"];

function scoreRules(response, expectedKeywords) {
    const words = response.toLowerCase().split(/\s+/);
    const responseLower = response.toLowerCase();

    const lengthScore = words.length >= 50 && words.length <= 500 ? 1.0 : 0.0;

    const found = expectedKeywords.filter(kw => responseLower.includes(kw.toLowerCase()));
    const keywordScore = expectedKeywords.length > 0
        ? found.length / expectedKeywords.length
        : 1.0;

    const forbiddenFound = FORBIDDEN_TERMS.filter(t => responseLower.includes(t));
    const forbiddenScore = forbiddenFound.length === 0 ? 1.0 : 0.0;

    return {
        lengthScore,
        keywordScore,
        keywordsFound: found,
        forbiddenScore,
        combined: Math.round(((lengthScore + keywordScore + forbiddenScore) / 3.0) * 100) / 100,
    };
}
```

---

## Step 4: LLM-as-Judge Scoring

Use the same local model to grade response quality:

### Python
```python
import json
import re

JUDGE_SYSTEM_PROMPT = """\
You are an impartial quality evaluator. Rate the following response on a scale of 1-5.

Rubric:
- 1: Completely wrong or irrelevant
- 2: Partially correct but missing key information
- 3: Adequate but could be improved significantly
- 4: Good response with only minor issues
- 5: Excellent, comprehensive, well-structured response

Respond ONLY with valid JSON (no code fences):
{"score": <1-5>, "reasoning": "<brief explanation>"}
"""

def llm_judge(client, model_id, question, response):
    try:
        result = client.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Question: {question}\n\nResponse to evaluate:\n{response}",
                },
            ],
            temperature=0.1,  # Low temperature for consistent scoring
            max_tokens=256,
        )

        raw = result.choices[0].message.content.strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

        parsed = json.loads(raw)
        score = max(1, min(5, int(parsed.get("score", 3))))
        return {"score": score, "reasoning": parsed.get("reasoning", "")}
    except Exception:
        # Fallback: extract a number or default to 3
        numbers = re.findall(r"\b([1-5])\b", raw if 'raw' in dir() else "")
        return {"score": int(numbers[0]) if numbers else 3, "reasoning": "Fallback score"}
```

---

## Step 5: Run Evaluation Pipeline

### Python
```python
def run_agent(client, model_id, system_prompt, user_input):
    result = client.chat.completions.create(
        model=model_id,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ],
        temperature=0.7,
        max_tokens=512,
    )
    return result.choices[0].message.content.strip()


# Run evaluation for each prompt variant
results = {}

for variant_name, system_prompt in PROMPT_VARIANTS.items():
    variant_results = []

    for test_case in GOLDEN_DATASET:
        # Get agent response
        response = run_agent(client, model_id, system_prompt, test_case["input"])

        # Score with rules
        rule_scores = score_rules(response, test_case["expected"])

        # Score with LLM judge
        judge_result = llm_judge(client, model_id, test_case["input"], response)

        variant_results.append({
            "input": test_case["input"],
            "category": test_case["category"],
            "rule_score": rule_scores["combined"],
            "judge_score": judge_result["score"],
        })

    results[variant_name] = variant_results

# Compare variants
for name, scores in results.items():
    avg_rule = sum(r["rule_score"] for r in scores) / len(scores)
    avg_judge = sum(r["judge_score"] for r in scores) / len(scores)
    print(f"{name}: Rule={avg_rule:.2f}, Judge={avg_judge:.1f}/5")
```

---

## Handling Service Crashes Under Sustained Load

The Foundry Local service may return HTTP 500 after ~13-15 sequential completions. Add retry logic:

```python
import time

def safe_completion(client, model_id, messages, max_retries=2):
    for attempt in range(max_retries + 1):
        try:
            result = client.chat.completions.create(
                model=model_id,
                messages=messages,
                temperature=0.7,
                max_tokens=512,
            )
            return result.choices[0].message.content.strip()
        except Exception as e:
            if attempt < max_retries:
                print(f"Retry {attempt + 1} after error: {e}")
                time.sleep(2)
            else:
                raise
```

If retries don't help, restart the service:
```bash
foundry service stop
foundry service start
```

---

## Evaluation Design Guidelines

| Guideline | Rationale |
|-----------|-----------|
| Write golden dataset before prompts | Prevents confirmation bias |
| Use 5+ test cases per category | Statistical significance |
| Combine rule + LLM scoring | Rules catch format issues; LLM catches content quality |
| Use `temperature: 0.1` for judge | Consistent scoring across runs |
| Include forbidden terms check | Catches hallucinated brand names or competitors |
| Test after every prompt change | Regression testing for prompt engineering |

---

## Common Pitfalls

| Mistake | Impact | Fix |
|---------|--------|-----|
| No try/catch around LLM judge | Pipeline crashes on HTTP 500 | Add fallback score (default 3) |
| High temperature for judge | Inconsistent scores | Use 0.1 |
| Too few test cases | Results not statistically meaningful | Use 5+ per category |
| Only using LLM judge (no rules) | Missing obvious format failures | Combine both approaches |
| Evaluating only one prompt variant | No comparison baseline | Always test at least 2 variants |

---

## Cross-References

- For service setup, see **setup**
- For agents to evaluate, see **agents**
- For RAG pipelines to evaluate, see **rag**
- For chat patterns, see **chat**
