# Instruction Review & Quality Audit

This reference defines how to evaluate, diagnose, and improve existing agent instructions. Use it whenever you touch instructions — whether auditing an existing agent, adding a capability, or responding to a user who says their agent "doesn't work well."

> **When to use this guide:**
> - User asks to "review", "improve", "audit", or "fix" their agent's instructions
> - User reports the agent "doesn't use the right tool", "gives generic answers", or "doesn't follow the process"
> - You are adding a capability or plugin and need to update instructions (mandatory per the editing workflow)
> - You are reviewing an agent before deployment
> - Agent behavior changed after a model update (GPT 5.0 → 5.1 → 5.2)
> - User wants to migrate instructions for a newer model version

> **Official references:** This guide synthesizes and operationalizes the official Microsoft guidance:
> - [Write effective instructions for declarative agents](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-agent-instructions)
> - [Instructions for agents with API plugins](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/instructions-api-plugins)
> - [Model changes in GPT 5.1+ for declarative agents](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-model-migration-overview)

---

## GPT 5.2 Model Awareness

As of April 2026, M365 Copilot uses **GPT 5.2**. Understanding the model's behavior is essential for writing and reviewing instructions, because the same instructions can produce very different results across model versions.

### Instruction Token Budget

**Instructions are limited to 8,000 characters.** Every character counts. This hard limit means you must be surgical about what goes into `instructions.txt`:

- **DO include:** Decision logic (WHEN to use which capability), workflows with transitions, failure handling, chaining rules, domain vocabulary, output contracts, self-evaluation gates
- **DO NOT include:** Tool descriptions, function parameter lists, API schemas, or anything already documented in the plugin metadata

> **⛔ CRITICAL: Do NOT duplicate tool/capability metadata in instructions.**
>
> The orchestrator already has access to tool names, descriptions, and parameters through:
> - `ai-plugin.json` → `description_for_model` and function definitions
> - MCP plugin manifest → `mcp_tool_description.tools[]` with full `inputSchema`
> - Capability configuration in `declarativeAgent.json`
> - Meta-prompts injected by the orchestration layer
>
> Listing tools and their parameters in instructions is a **waste of the 8,000-character budget**. Instead, instructions should provide **decision logic** that the metadata cannot express: WHEN to choose one tool over another, HOW to chain tools together, and WHAT to do when a tool returns no results.

### What belongs in instructions vs metadata

| Belongs in `instructions.txt` | Belongs in plugin metadata (NOT instructions) |
|-------------------------------|------------------------------------------------|
| WHEN to use a capability: "Search SharePoint first, fall back to web search" | Tool name and description |
| Chaining logic: "After getting weather, create a task with the result" | Function parameters and types |
| Failure handling: "If no results, ask the user to rephrase" | Input schemas and validation rules |
| Confirmation gates: "Always confirm before deleting" | Response format / adaptive cards |
| Multi-turn rules: "Collect all 3 values before calling the API" | API endpoint details |
| Domain vocabulary and business rules | Tool-level `description_for_model` |
| Output format and reasoning depth | MCP `inputSchema`, `annotations`, `execution` |

### The Model Shift: Literal-First → Intent-First

| Behavior | GPT 5.0 (old) | GPT 5.1+ / 5.2 (current) |
|----------|---------------|---------------------------|
| Interpretation | Literal — follows instructions step-by-step as written | Intent-first — interprets what instructions *intended*, not just what they said |
| Missing steps | Fails or responds narrowly | Fills gaps, infers missing steps, replans its approach |
| Ambiguity | Follows the first plausible path | Dynamically selects reasoning depth; may reorder or merge steps |
| Tone | Direct and factual by default | Adapts tone based on inferred context; supports 8 output profiles |
| Reasoning | Fixed: chat model OR reasoning model | Adaptive: chooses model + reasoning depth per sub-task within a single request |

### What This Means for Instruction Review

GPT 5.2's intent-first behavior **amplifies the impact of instruction quality**:

- **Well-structured instructions** → GPT 5.2 follows them more precisely than GPT 5.0 and can adaptively fill in routine details
- **Ambiguous instructions** → GPT 5.2 will *replan and improvise*, which may produce unexpected behavior: reordered steps, merged tasks, tone drift, added/removed steps based on inferred context
- **Output-only instructions** → GPT 5.2 will infer the entire process, often incorrectly, because the instructions give it maximum freedom to interpret intent

**Bottom line:** The weaker the instructions, the more GPT 5.2 will improvise — and improvisation in structured workflows is a bug, not a feature.

### Fixed vs Adaptive Reasoning — When to Use Each

GPT 5.2 supports two modes, and your instructions should signal which one to use:

**Use strict step-by-step instructions when:**
- The agent must follow a defined business process
- Specific formatting rules or compliance templates are required
- A fixed retrieval/reasoning sequence must be honored
- Destructive operations need confirmation gates

**Use goal-focused instructions with guardrails when:**
- Tools and knowledge sources are well-defined
- The output format is flexible
- The goal matters more than the exact path
- You want the model to adaptively plan and handle edge cases

> **Key insight:** You can mix both in the same instruction set. Use strict process for critical workflows (ticket creation, data modification) and goal-focused for open-ended tasks (information retrieval, summarization).

### Output Style Profiles

GPT 5.2 has 8 built-in output profiles. Instead of writing verbose tone instructions, reference the profile directly:

| Profile | Behavior |
|---------|----------|
| **Default** | Verbose, explanatory, teacher-like |
| **Professional** | Neutral, structured, business-oriented |
| **Friendly** | Conversational, supportive |
| **Candid** | Direct, concise |
| **Quirky** | Expressive, informal |
| **Efficient** | Minimal verbosity, outcome-focused |
| **Nerdy** | Technical, detail-oriented, precise |
| **Cynical** | Skeptical, dry, matter-of-fact |

**Anti-pattern:** Writing 5+ lines about tone ("Be professional but approachable, don't be too formal, use simple language...").
**Fix:** `Tone: Professional` — one line is enough. The model maps this to the built-in profile.

---

## The Core Problem: Output-Focused vs Process-Focused Instructions

Most instruction failures share a single root cause: **the instructions describe what the response should look like, not how the agent should produce it.**

### Output-focused (❌ anti-pattern)

Tells the model the *shape* of the answer — tone, format, length, style — but gives it no strategy for *finding* the answer.

```md
You are a helpful HR assistant. Provide accurate answers about company policies.
Include policy numbers when available. Be concise and professional. Use bullet points.
Format responses with headers when appropriate.
```

**Why this fails:**
- The model has no idea WHERE to look (SharePoint? Email? Web search?)
- It doesn't know WHEN to use which capability
- It will hallucinate policy numbers because you told it to "include" them but didn't tell it where to find them
- Every response will have the same shape regardless of the question

### Process-focused (✅ correct pattern)

Tells the model the *decision logic* — WHEN to use which tool, in what order, and what to do when things fail. Does NOT duplicate tool descriptions or parameters already in the plugin metadata.

```md
# OBJECTIVE
Help employees find answers to HR policy questions using the company's official policy documents.

# DECISION LOGIC
- Policy/process questions → search **HR Policies** (SharePoint) first. This is the primary source.
- Org/people questions → use People knowledge directly.
- Email → search user's email ONLY when the user mentions a specific HR email or announcement.
- If the answer isn't in any source → direct users to hr@company.com. Do not guess.

# WORKFLOW

## Step 1: Classify the question
- **Goal:** Determine if this is a policy lookup, a process question, or an org question.
- **Action:** Read the user's message. Identify the topic (benefits, time off, expenses, etc.).
- **Transition:** If policy → Step 2. If org/people → use People knowledge directly. If unclear → ask one clarifying question.

## Step 2: Search policy documents
- **Goal:** Find the authoritative answer in SharePoint.
- **Action:** Search the HR Policies library for documents matching the topic. Read the relevant sections.
- **Transition:** If found → Step 3. If not found → tell the user: "I couldn't find a policy on [topic]. Contact hr@company.com for help."

## Step 3: Respond with citation
- **Goal:** Give a clear, traceable answer.
- **Action:** Summarize the policy in 2-4 bullets. Include the document name and section. If the policy references a form or process, link to it.
- **Constraint:** Never paraphrase in a way that changes the policy's meaning. If the policy is ambiguous, quote it directly and note the ambiguity.

# RESPONSE RULES
- Cite the source document for every factual claim.
- If you cannot find the answer, say so. Do not guess.
- One clarifying question at a time, only when needed.
```

**Why this works:**
- Every data source has a clear role and intent (WHEN and WHY to use it)
- The model has a decision tree, not just a personality description
- Failure cases are handled ("if not found → tell the user")
- The response rules are minimal and complementary to the process, not a substitute for it

---

## Diagnostic Checklist

Run this checklist against any set of instructions. Each failed check is a specific, fixable problem.

### A. Capability Coverage

| # | Check | How to verify | Failure signal |
|---|-------|---------------|----------------|
| A1 | Every configured capability has clear intent coverage in instructions | For each capability in `capabilities[]`, check whether the instructions describe **when and why** the agent should use the underlying data source — e.g., "search company documents" covers `OneDriveAndSharePoint` even without naming it. The exact capability name is NOT required; what matters is that the instructions give the model a clear reason and context to invoke it. | Capability is configured but instructions provide no context for when to use it → model may underuse it or use it at the wrong time |
| A2 | Every action/plugin has a matching section in instructions | Compare `actions[]` array against instruction text. Unlike built-in capabilities, plugins are custom and SHOULD be referenced by name so the model knows they exist. | Plugin exists but instructions don't reference it → model may never invoke it |
| A3 | Each data source or action has a WHEN clause | Look for conditional intent: "when the user asks about...", "for X questions, search Y", "use [data source] for [scenario]". For built-in capabilities, the WHEN clause can reference the data source by purpose ("search internal docs") rather than by capability name. For plugins, reference functions by name. | Instructions mention a data source but provide no trigger or decision logic for when to use it |
| A4 | Instructions provide decision logic, not tool descriptions | Check that instructions don't duplicate `description_for_model`, parameter lists, or schemas from plugin metadata | Token waste — this information is already available to the orchestrator |
| A5 | Instructions don't assume data sources that aren't configured | Read instruction text for intent that implies a specific capability (see Capability Reference below). Cross-check against `capabilities[]` in the manifest. Focus on **intent mismatch** — e.g., instructions say "check the user's calendar" but no `Meetings` capability is configured. Minor phrasing overlaps (e.g., "look up" could mean many things) should NOT be flagged. | Instructions clearly direct the agent to use a data source that isn't configured → the agent will try and fail, or hallucinate |

### B. Process Structure

| # | Check | How to verify | Failure signal |
|---|-------|---------------|----------------|
| B1 | Instructions contain at least one workflow or decision tree | Look for steps, numbered sequences, or if/then rules | Instructions are a flat list of personality traits — model has no strategy |
| B2 | Workflows have Goal → Action → Transition per step | Each step names what it achieves, what to do, and when to move on | Steps are vague or lack transitions → model gets stuck or skips ahead |
| B3 | Decision points have explicit if/then rules | Ambiguous situations have defined behavior | Model guesses instead of following a prescribed path |
| B4 | Failure cases are handled | "If not found", "if unclear", "if error" have defined responses | Model hallucinates or goes silent when things don't go as expected |

### C. Anti-Pattern Detection

| # | Anti-pattern | What it looks like | Fix |
|---|---|---|---|
| C1 | **Output-only instructions** | 80%+ of text is about tone, format, length, style | Add a CAPABILITIES section and at least one WORKFLOW |
| C2 | **Personality-first instructions** | Opens with "You are a friendly, helpful..." and stays there | Move personality to a short RESPONSE RULES section at the end; lead with OBJECTIVE and CAPABILITIES |
| C3 | **Capability gap** | `declarativeAgent.json` has 3 capabilities and 2 plugins; instructions provide intent coverage for only 1 | Add decision logic for each uncovered data source — describe WHEN and WHY the agent should use it (exact capability names are not required for built-in capabilities) |
| C4 | **Orphaned starters** | Conversation starter references a capability not mentioned in instructions | Either add the capability to instructions or remove the starter |
| C5 | **Tool ambiguity** | Instructions say "search for documents" but the agent has multiple document sources and no guidance on which to prefer | Clarify the intent: "Search the **HR Policies** library first; if not found, try the **Company Wiki**" |
| C6 | **Hallucination invitation** | "Include [specific data] in your response" without specifying where to find it | Add: "Retrieve [data] from [capability]. If not found, do not include it." |
| C7 | **Compound tasks** | "Extract metrics and summarize findings and create a report" | Break into separate atomic steps with transitions |
| C8 | **Over-restriction** | Long list of "do NOT" rules with few "DO" rules | Rewrite as positive directives; keep restrictions to genuine guardrails only |
| C9 | **Missing reasoning calibration** | No indication of how deep the model should think | Add a reasoning header: "Short answer only" or "Break the problem into steps" depending on task complexity |
| C10 | **No self-evaluation** | Instructions end without a verification step | Add: "Before responding, confirm: [checklist]" |
| C11 | **Tool/parameter dumping** | Instructions list tool names with descriptions and parameters already in plugin metadata | Remove tool descriptions and parameters from instructions. Keep only WHEN/chaining/failure logic. Reclaim token budget for decision logic. |

### D. GPT 5.2 Model-Sensitivity Anti-Patterns

These anti-patterns are specifically caused or amplified by the GPT 5.1+/5.2 intent-first behavior. They may not have caused issues on GPT 5.0 but will cause problems now.

| # | Anti-pattern | What it looks like | Fix |
|---|---|---|---|
| D1 | **Fused/ambiguous tasks** | Single instruction with multiple actions: "extract metrics and summarize" | GPT 5.2 may merge steps or infer unintended processes. Split into atomic steps with explicit transitions. |
| D2 | **Incorrect numbering** | Numbered lists used for parallel tasks that have no required order | GPT 5.2 treats numbering as a strict sequence signal. Use bullets (`-`) for parallel tasks; reserve numbering for true sequential workflows. |
| D3 | **Implicit formats** | No explicit tone, structure, or verbosity specified | GPT 5.2 will infer these and may produce inconsistent results. Specify the output profile (`Tone: Professional`) and format explicitly. |
| D4 | **Weak Markdown hierarchy** | Mixed list types, unclear headers, inconsistent nesting | GPT 5.2 uses structure as a control signal. Clean up: `##` for sections, `-` for parallel items, `Step N:` for sequences. |
| D5 | **No validation step** | Instructions end without a self-check gate | GPT 5.2 may choose faster reasoning and return incomplete output. Add: "Before finalizing, confirm: [checklist]" |
| D6 | **Verbose tone instructions** | 5+ lines describing desired tone and style | Replace with a single output profile reference: `Tone: Professional` or `Tone: Efficient`. GPT 5.2 maps these to built-in profiles. |
| D7 | **Vague verbs** | "Verify", "process", "handle", "clean" without specifying observable actions | Replace with precise verbs: "search", "compare", "list", "call [function]", "ask the user for" |
| D8 | **Missing stabilizing header** | Agent that previously worked on GPT 5.0 now shows drift (reordered steps, added reasoning, tone changes) | Add a literal-execution header at the top as an interim fix (see Stabilizing Header section below) |

### E. API Plugin Instruction Anti-Patterns

These apply specifically to agents with API plugins (actions).

| # | Anti-pattern | What it looks like | Fix |
|---|---|---|---|
| E1 | **No function-level WHEN clauses** | Instructions mention the plugin but don't say when to call each function | List every function with a WHEN clause: "`getRepairs` — use when user asks to find or list repairs" |
| E2 | **No chaining instructions** | Agent has multiple plugins or plugin + capability but no guidance on combining them | Add chaining rules: "After calling `getWeather`, use the result to call `createTask` with the temperature in the title" |
| E3 | **No multi-turn collection** | Function requires 3+ parameters but instructions don't say to collect them before calling | Add: "Before calling `createRepair`, collect title, description, and assignee. Ask for missing values." |
| E4 | **Missing confirmation for writes** | POST/PATCH/DELETE functions have no confirmation gate in instructions | Add: "Before calling `deleteRepair`, confirm: 'Are you sure you want to delete repair #[id]?'" |
| E5 | **Negative/contrasting instructions** | "Don't call getWeather for indoor temperatures" instead of defining valid cases | Rewrite as positive: "Call `getWeather` only for outdoor weather queries with a location." |
| E6 | **No cross-capability chaining** | Agent has SharePoint knowledge + API plugin but instructions treat them as isolated | Add chaining: "Search SharePoint for project statuses, then call `createTask` for each project needing follow-up" |

---

## Capability Reference (v1.6)

Use this table to understand what each built-in capability provides and to detect intent mismatches between instructions and the manifest. This is a **guide for understanding intent**, not a keyword checklist.

> **⚠️ IMPORTANT: M365 Copilot uses internal names for built-in capabilities** that differ from the manifest identifiers (e.g., `OneDriveAndSharePoint`). The orchestrator already knows which capabilities are configured — instructions do NOT need to use the exact capability name. What matters is that the instructions convey **clear intent** for when and why the agent should access each data source. For example, "search our internal HR documents" is sufficient coverage for `OneDriveAndSharePoint` — you don't need to write "use the OneDriveAndSharePoint capability."

| Capability name | What it provides | Instruction intent that implies this capability |
|----------------|-------------|--------------------------------------------------|
| `WebSearch` | Search the web for grounding | "search the web", "look online", "find on the internet", "web results", "current news" |
| `OneDriveAndSharePoint` | Search SharePoint sites, OneDrive files, document libraries | "SharePoint", "OneDrive", "documents", "files", "shared files", "document library", "site" |
| `GraphConnectors` | Search Copilot connectors (external data sources) | "Jira", "ServiceNow", "connector", "external system", "tickets", connector-specific names |
| `GraphicArt` | Generate images from text | "create image", "generate art", "draw", "illustration", "visual" |
| `CodeInterpreter` | Run Python code for analysis, math, visualizations | "calculate", "analyze data", "run code", "chart", "graph", "visualization", "Excel analysis" |
| `Dataverse` | Search Dataverse tables | "Dataverse", "CRM", "Dynamics", "Power Platform data", "business data" |
| `TeamsMessages` | Search Teams channels, chats, meeting chats (messages only — NOT transcripts) | "Teams", "channels", "chat", "messages", "Teams messages", "mentions", "DMs" |
| `Email` | Search user's email (and shared/group mailboxes) | "email", "inbox", "messages", "mail", "sent items", "flagged", "unread" |
| `People` | Search people in the organization | "people", "org chart", "who is", "manager", "reports to", "birthday", "OOO", "colleagues" |
| `ScenarioModels` | Use task-specific AI models | "model", "custom model", "specialized model" |
| `Meetings` | Search calendar events, meeting details, **and meeting transcripts** | "meetings", "calendar", "events", "schedule", "invites", "attendees", "join link", "transcript", "what was discussed", "meeting notes", "recording" |
| `EmbeddedKnowledge` | Use files bundled in the app package | "embedded files", "local files", "bundled docs" (not yet available) |

> **How to use this table:** During Phase 2 (Comprehension Check) and Phase 3 (Diagnose), use this table to understand intent alignment — not for strict keyword matching. For **A1**: if a capability is in the manifest but the instructions never describe a scenario where the agent would use that data source (even in general terms), flag it as a gap — but do NOT require the exact capability name. For **A5**: if the instructions clearly direct the agent to access a data source that has no corresponding capability configured, flag it as an intent mismatch. Ambiguous phrasing that could apply to multiple capabilities should NOT be flagged.

> **Advanced capability configuration:** Some capabilities support scoping (e.g. `OneDriveAndSharePoint` with `items_by_url`, `Email` with `shared_mailbox` and `folders`, `TeamsMessages` with specific channel URLs, `Meetings` with `items_by_id`, `People` with `include_related_content`). When reviewing instructions, also check whether scoping in the manifest aligns with what the instructions describe — e.g. instructions say "search all SharePoint" but the capability is scoped to a single site.

### Version-Capability Matrix

Use this table during Phase 1 step 7 to check if the agent's schema version supports the capabilities its instructions imply.

| Capability | Minimum version | What it unlocks |
|------------|----------------|------------------|
| `WebSearch` | v1.0 | Web search for grounding |
| `OneDriveAndSharePoint` | v1.0 | SharePoint/OneDrive file search |
| `GraphConnectors` | v1.0 | External data via Copilot connectors |
| `GraphicArt` | v1.0 | Image generation from text |
| `CodeInterpreter` | v1.0 | Python code execution, data analysis, charts |
| `Dataverse` | v1.3 | CRM/Dynamics/Power Platform table search |
| `TeamsMessages` | v1.3 | Teams channel posts, DMs, meeting chat messages (NOT transcripts) |
| `Email` | v1.3 | Email search (inbox, shared mailboxes, group mailboxes) |
| `People` | v1.3 | Org chart, people search, OOO, birthdays |
| `ScenarioModels` | v1.4 | Task-specific AI models |
| `behavior_overrides` | v1.4 | `discourage_model_knowledge`, suggestions toggle |
| `disclaimer` | v1.4 | Disclaimer text at conversation start |
| `Meetings` | v1.5 | Calendar events, attendees, meeting transcripts, recordings |
| `sensitivity_label` | v1.6 | Purview sensitivity labels (with embedded files) |
| `worker_agents` | v1.6 | Connected agents (delegate to other declarative agents) |
| `EmbeddedKnowledge` | v1.6 | Local files bundled in app package (not yet available) |
| `user_overrides` | v1.6 | Let users toggle capabilities on/off |
| `People.include_related_content` | v1.6 | Include related docs, emails, and Teams messages for people searches |
| `Email.group_mailboxes` | v1.6 | Search Microsoft 365 Group mailboxes |
| `Meetings.items_by_id` | v1.6 | Scope to specific meetings/series |

> **How to use:** If the agent is on v1.4 and the instructions reference "meeting transcripts" or "calendar events", flag that `Meetings` requires v1.5+. If the instructions reference "people and what we have in common", flag that `People.include_related_content` requires v1.6. Always offer to upgrade — never silently change the version.

---

## Review Workflow

When reviewing instructions, follow this sequence:

### Phase 1: Inventory

1. Read `declarativeAgent.json` — list all capabilities, actions, conversation starters, and the schema version
2. Read `instructions.txt` (or inline instructions) — note the structure (or lack of it)
3. **Measure instruction length** — count the characters in `instructions.txt`. If inline, count the `instructions` field value. Record the count against the **8,000-character limit**. If over → flag immediately as a blocking issue.
4. If API plugins exist, read the `ai-plugin.json` to understand what functions are available and their parameter requirements
5. If MCP plugins exist, read the plugin manifest to understand what tools are available
6. Check the `version` field — note which GPT model era the instructions were likely written for
7. **Version upgrade analysis** — Cross-reference the current schema version against the capabilities implied by the instructions (use the Version-Capability Matrix below). If the instructions describe functionality that requires a newer schema version, flag it. Example: instructions say "review meeting transcripts" but the agent is on v1.4 — `Meetings` capability (which includes transcripts) requires v1.5+.

> **Quick length check:** `wc -m appPackage/instructions.txt` (Unix/macOS/WSL) or `(Get-Content appPackage/instructions.txt -Raw).Length` (PowerShell)

### Phase 2: Comprehension Check

Before running any diagnostic, **explain back to the user what you understood** from reading all the files in Phase 1. This surfaces misunderstandings early and gives the user a chance to provide domain context you lack.

Present your understanding in this structure:

```
## Here's what I understood about your agent

**Purpose:** [One sentence — what this agent is for and who uses it]

**Workflow:** [Summarize the decision process the instructions describe — what does the agent do first, when does it use which capability, what are the branching conditions?]

**Capabilities used:**
- [Capability 1] — used for [what scenario]
- [Capability 2] — used for [what scenario]
- [Any configured capability NOT mentioned in instructions — flag it]

**Capability alignment:**
| Capability | In manifest? | In instructions? | Gap |
|------------|-------------|-----------------|-----|
| [For each configured capability] | ✅ | ✅ or ❌ | [If ❌: instructions never reference this — model won't know when to use it] |
| [For each capability implied by instructions but NOT configured] | ❌ | ✅ | [Instructions assume this exists but it's not configured — will fail or hallucinate] |

**Version upgrade opportunities:**
- [If the current schema version is not the latest (v1.6), list capabilities available in newer versions that could benefit this agent's intent. Example: "You're on v1.4. Upgrading to v1.5 would unlock `Meetings` (calendar + transcripts), which aligns with your instruction's references to meeting prep and scheduling."]
- [If already on v1.6: "✅ You're on the latest schema version — no upgrade needed."]

**Tone / personality:** [What personality or communication style the instructions establish, if any]

**Gaps or things I'm unsure about:**
- [Anything ambiguous, unclear, or that seems to be missing context]
- [Domain-specific terms or processes you don't fully understand]
```

Then ask:
> Does this match your intent? Is there anything I'm missing or misunderstanding about how this agent should work?

**Wait for the user's response before proceeding to Phase 3.** The user's clarifications become additional context for the diagnostic — they may reveal that something you'd flag as a "gap" is intentional, or surface requirements that aren't written anywhere.

> **Shortcut:** For proactive reviews triggered from the editing workflow (where the user didn't ask for a review), you may combine Phase 2 into a brief confirmation: "I see this agent is designed to [purpose]. The instructions cover [X, Y] but don't mention [Z capability]. Does that sound right?" — then proceed.

### Phase 3: Diagnose

Run the **full Diagnostic Checklist** — sections A (Capability Coverage), B (Process Structure), C (Anti-Patterns), D (GPT 5.2 Model Sensitivity), and E (API Plugin patterns, if applicable). Record every failed check.

For rapid assessment or when reviewing multiple agents, use the **Structured Evaluation Prompt** (see section below) — paste the current instructions into the template and run the automated checks. The eval prompt covers all checklist sections in a single pass.

When scoring issues, factor in the user's clarifications from Phase 2 — if they confirmed a gap is intentional, downgrade or skip that check.

### Phase 4: Report

Present findings to the user in this format:

```
## Instruction Review

**Instruction length:** [X] / 8,000 characters [✅ within limit | ⚠️ close (>6,500) | ❌ over limit]

### What's working
- [List things that are correctly structured]

### Issues found
| # | Issue | Severity | Description |
|---|-------|----------|-------------|
| 1 | C1 — Output-only | High | Instructions describe response format but have no workflow for finding answers |
| 2 | A1 — Intent gap | Medium | Email capability is configured but instructions never describe when the agent should search email — no decision logic for this data source |
| 3 | C11 — Token waste | Medium | Tool descriptions duplicated from plugin metadata — reclaim ~800 chars |
| 4 | C6 — Hallucination risk | Medium | "Include policy numbers" but no instruction on where to find them |

### Recommended structure
[Show the proposed skeleton with sections mapped to their capabilities]

### Token budget impact
[If rewrite is needed, estimate: current length → projected length after fix]
```

### Phase 5: Rewrite (only after user confirms)

Follow **Detect → Inform → Ask** — the same protocol used for JSON errors. Present the diagnosis, propose the fix, wait for approval before rewriting.

When rewriting:
- Preserve any existing content that passes the checklist
- Incorporate the domain context and clarifications gathered in Phase 2 — use the user's own terminology and process descriptions
- Do NOT invent domain-specific content (policy names, SharePoint URLs, process details) — ask the user
- Structure using the process-focused pattern: OBJECTIVE → DECISION LOGIC → WORKFLOW → FAILURE HANDLING → RESPONSE RULES → SELF-CHECK
- Ensure every configured capability has clear intent coverage in the instructions with WHEN clauses and chaining rules — built-in capabilities don't need exact names, but actions/plugins should be named
- **Do NOT add tool descriptions or parameters** — these are already in plugin metadata
- **Measure the result** — verify the rewritten instructions are within 8,000 characters. If over, cut in this priority order:
  1. Remove any remaining tool descriptions/parameter lists (C11)
  2. Replace verbose tone blocks with a single output profile reference (D6)
  3. Consolidate redundant workflow steps
  4. If still over, ask the user what to prioritize

---

## Before/After Examples

### Example 1: Knowledge Base Agent

**Capabilities configured:** `OneDriveAndSharePoint` (scoped to `/sites/IT-KB/Documents`), `WebSearch` (scoped to `docs.contoso.com`)

**❌ Before (output-focused):**
```md
You are an IT knowledge base assistant. Help users find answers to technical questions.
Be thorough but concise. Use bullet points when listing steps. Always be professional
and patient. If you don't know the answer, say so politely.
```

**Issues:** C1 (output-only), A1 (two capabilities configured, zero intent coverage — instructions don't describe when to use any data source), C5 (tool ambiguity — "find answers" doesn't say where), C6 (no sourcing strategy)

**✅ After (process-focused — decision logic only, no tool descriptions):**
```md
# OBJECTIVE
Help employees resolve IT questions by searching internal documentation and company-approved external resources.

# DECISION LOGIC
- Always search the **IT Knowledge Base** (SharePoint) first — this is the primary source.
- If not found in the KB → search **docs.contoso.com** as a secondary source.
- If not found in either → escalate: "Please submit a ticket to helpdesk@contoso.com or the ServiceNow portal."

# WORKFLOW

## Step 1: Understand the question
- **Goal:** Identify what the user needs help with.
- **Action:** If the question is clear, proceed. If vague (e.g., "it's not working"), ask ONE clarifying question: what system, what error, what they were trying to do.
- **Transition:** Once clear → Step 2.

## Step 2: Search
- **Goal:** Find the answer in internal documentation.
- **Action:** Search IT-KB. If not found, search docs.contoso.com.
- **Transition:** If found → Step 3. If not found in either → escalate.

## Step 3: Respond
- **Action:** Summarize the solution in numbered steps. Cite the source document name.
- **Constraint:** Do not combine information from multiple documents without noting it.

# RESPONSE RULES
Tone: Professional
- Cite the source for every answer.
- One clarifying question at a time.
- If multiple solutions exist, present the simplest first.
```

---

### Example 2: Agent with API Plugin

**Capabilities configured:** `Email`, API plugin (Repairs API with GET/POST/PATCH/DELETE)

**❌ Before (output-focused):**
```md
You help manage repair tickets and can access email. Be helpful and professional.
When showing repairs, display them in a clear format with the ticket ID, title,
status, and assignee. For new tickets, confirm the details before creating them.
```

**Issues:** C1 (output-only), A2 (Repairs API not explained), C5 ("can access email" — when? for what?), B3 (no decision rules for CREATE vs SEARCH vs UPDATE), E1 (no function-level WHEN clauses), E3 (no multi-turn collection), E4 (no confirmation for destructive ops)

**✅ After (process-focused — decision logic only, no tool descriptions):**
```md
# OBJECTIVE
Help users search, create, and manage repair tickets. Use email context when relevant to a repair.

# DECISION LOGIC
- When user asks to find repairs → search by keyword or ID. If no results, offer to create one.
- When user reports a new issue → collect title, description, and assignee first. Confirm details before creating.
- When user asks to update a repair → identify the ticket first (by ID or search), confirm what to change, then update.
- When user asks to delete → identify the ticket, **always confirm before deleting**.
- Use **Email** ONLY when: (a) the user mentions an email about a repair, or (b) you need a reference number from prior correspondence.

# FAILURE HANDLING
- No results from search → ask user to rephrase or offer to create a new ticket.
- User provides incomplete info for creation → ask for missing values one at a time.
- Ambiguous intent (search vs create) → ask: "Would you like me to search for an existing repair or create a new one?"

# RESPONSE RULES
Tone: Professional
- Always show the ticket ID when referencing a repair.
- Confirm before any destructive operation.
```

---

### Example 3: MCP Server Agent

**Capabilities configured:** MCP plugin (Microsoft Docs with `docs_search` tool)

**❌ Before (output-focused):**
```md
You are a documentation search assistant. Help users find relevant Microsoft
documentation. Provide clear, well-organized responses. Include links when available.
Summarize key points from the documentation you find.
```

**Issues:** C1 (output-only), A2 (MCP tool not referenced), C6 ("include links when available" — where do they come from?), C9 (no reasoning calibration), D3 (no explicit tone/format — GPT 5.2 will infer inconsistently), D5 (no validation step)

**✅ After (process-focused — decision logic only, no tool descriptions):**
```md
# OBJECTIVE
Help users find and understand official Microsoft documentation.

# DECISION LOGIC
- For factual questions → search docs, summarize the most relevant result with title and link.
- For comparisons ("X vs Y") → search for each topic separately, present side-by-side citing both.
- For troubleshooting ("error Z") → search with the error message first, then by product + "known issues" if no match.
- If no results after two searches → tell the user: "I couldn't find official documentation. Try browsing https://learn.microsoft.com directly."

# GROUNDING RULES
- Never answer from general knowledge — always search first.
- Cite the source document for every claim.
- Do not stitch information across documents without noting it.

# RESPONSE RULES
Tone: Efficient
Reasoning: Short answer for simple lookups. Break into steps for troubleshooting.

# SELF-CHECK
Before responding: confirm you searched, cited a source, and answered the actual question asked.
```

---

## Stabilizing Header — Interim Fix for Model Drift

If an agent that worked on GPT 5.0 shows unexpected behavior on GPT 5.2 (reordered steps, added reasoning, tone drift, merged tasks), add this header at the **top** of `instructions.txt` as an immediate stabilization:

```md
Always interpret instructions literally.
Never infer intent or fill in missing steps.
Never add context, recommendations, or assumptions.
Follow step order exactly with no optimization.
Respond concisely and only in the requested format.
Do not call tools unless a step explicitly instructs you to do so.
```

**This is a temporary fix**, not a long-term solution. Use it to stabilize behavior while you rewrite the instructions using the process-focused structure from this guide. Once the instructions are properly structured with explicit workflows, remove the header — well-structured instructions don't need it, and the header prevents GPT 5.2 from using its adaptive reasoning which can be beneficial for open-ended tasks.

> **Reference:** [Pattern 8 — Literal-execution header](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-agent-instructions#pattern-8-apply-a-literal-execution-header-for-immediate-stability)

---

## Structured Evaluation Prompt

For rapid auditing of existing instructions — especially when migrating from GPT 5.0 to 5.2 or reviewing multiple agents at scale — use this structured evaluation prompt. Paste the agent's current instructions into the `<instructions>` block and run the analysis:

```md
You are reviewing declarative agent instructions for GPT 5.2 stability.

INPUT
<instructions>
[PASTE CURRENT INSTRUCTIONS]
</instructions>

TASK
Concise audit. Identify ONLY issues and exact fixes.

CHECKS
- Step order: identify ambiguity, missing steps, or merged steps → propose atomic, numbered steps.
- Tool use: identify auto-calls, retries, or tool switching → add "use only in step X; no auto-retry".
- Grounding: detect inference, blending, or citation gaps → add "cite only retrieved; no inference; no cross-document stitching".
- Missing-data handling: if retrieval is empty or conflicting → add "stop and ask the user".
- Verbosity: identify chatty or explanatory output → replace with "return only the requested data/format".
- Contradictions or duplicates: resolve discrepancies; prefer explicit over implied.
- Vague verbs ("verify", "process", "handle", "clean"): replace with precise, observable actions.
- Safety: prohibit step reordering, optimization, or reinterpretation.
- Reasoning calibration: match reasoning depth to task type (fast extraction vs deep analysis).
- API plugin functions: verify each function has a WHEN clause, multi-turn parameter collection, and confirmation gates for writes.

OUTPUT (concise)
- Header patch (3–6 lines) — stabilizing header if needed
- Top 5 changes (bullet list: "Issue → Fix")
- Example rewrite (≤10 lines) for the riskiest step
```

> **Reference:** [Pattern 9 — Evaluate and migrate existing instructions](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-agent-instructions#pattern-9-evaluate-and-migrate-existing-declarative-agent-instructions)

---

## API Plugin Chaining Patterns

When an agent has API plugins, instructions must cover how functions chain together. Missing chaining instructions cause the agent to treat each function as isolated, forcing the user to manually bridge between calls.

### Pattern: Output-as-Input Chaining

Use the result of one API call as input for another:

```md
To get the weather, always use the `getWeather` action, then create a task with
the title "temperature in [location]: [temperature]" by calling `createTask`.
```

### Pattern: Conversation-History Chaining

Use prior responses to handle follow-up actions:

```md
1. When the user asks to list all to-dos, call `getTasks` to retrieve the list with title and ID.
2. After listing, if the user asks to delete a to-do by name, use the ID from the previous response to call `deleteTask`.
```

### Pattern: Cross-Capability Chaining (SharePoint + API)

Combine knowledge sources with API actions:

```md
- To get project statuses, use SharePoint knowledge from **ProjectDeadlines**.
- Always create a to-do for each project using the status update for the title by calling `createTask`.
```

### Pattern: Capability + Code Interpreter Chaining

Process API output with code interpreter:

```md
When the user asks to list all to-dos, call `getTasks` to retrieve the list,
then use code interpreter to generate a chart based on the output.
```

### Pattern: Multi-Turn Parameter Collection

When a function requires multiple parameters, instruct the agent to collect all values before calling:

```md
If the user asks about the weather:
1. Ask the user for location.
2. Ask the user for forecast day.
3. Ask the user for unit system (Metric or Imperial).
4. Only call `getWeather` when you have all three values.
```

**Anti-pattern:** Letting the agent call the function with partial parameters and handle errors — this produces a poor user experience.

---

## Domain Vocabulary

Define specialized terms, formulas, acronyms, and dataset-specific language in a dedicated section. This prevents GPT 5.2 from incorrectly inferring definitions.

```md
# VOCABULARY
- **ROI** — Return on Investment. Calculate as: (Benefit - Cost) / Cost. Do not use any other formula.
- **SLA** — Service Level Agreement. In this context, refers to the 4-hour response time commitment.
- **P1/P2/P3** — Priority levels. P1 = production down, P2 = degraded, P3 = cosmetic/minor.
- **CSAT** — Customer Satisfaction score, on a 1-5 scale. Do not invent definitions; use only these.
```

---

## Minimum Quality Bar

Instructions pass the quality bar when ALL of these are true:

1. **Every configured capability has clear intent coverage in the instructions** — the instructions describe when and why the agent should use each data source. Built-in capabilities do NOT need to be referenced by their exact manifest name (M365 Copilot uses internal names); what matters is clear decision logic. Actions/plugins SHOULD be referenced by name.
2. **At least one workflow exists** with Goal → Action → Transition (or equivalent decision rules)
3. **Failure cases are handled** — the instructions say what to do when a search returns nothing, a tool fails, or the user's question is ambiguous
4. **Output-focused content is ≤20% of the total** — tone, format, and style rules exist but don't dominate
5. **No hallucination invitations** — every "include X" statement has a corresponding "retrieve X from Y" instruction
6. **No tool/parameter duplication** — instructions contain decision logic only; tool descriptions, parameters, and schemas live in plugin metadata
7. **Within the 8,000-character limit** — if instructions exceed this, cut tool descriptions first, then consolidate verbose workflows
8. **Reasoning depth is calibrated** — fast extraction tasks say "short answer only"; analysis tasks say "break the problem into steps"
9. **Markdown structure is clean** — sections use `##`, parallel tasks use bullets, sequential workflows use numbered steps; no mixed list types
10. **API plugin functions have WHEN clauses, chaining rules, and confirmation gates** (if applicable)
11. **A self-evaluation gate exists** — instructions end with "Before responding, confirm: [checklist]"
12. **No GPT 5.2 model-sensitivity anti-patterns** — no fused tasks, no incorrect numbering, no vague verbs, no verbose tone blocks

If any of these fail, the instructions need improvement before deployment.
