# Conversation and Instruction Design for M365 Agents

> Based on the official Microsoft guidance: [Write effective instructions for declarative agents](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/declarative-agent-instructions)

## Agent Instructions

The `instructions` field in `declarativeAgent.json` references an external `instructions.txt` file. This keeps the JSON manifest clean and makes instructions easy to edit. This is the most critical aspect of agent design.

### Instruction Limits and Token Budget

**Instructions are limited to 8,000 characters.** Every character counts — be concise and deliberate about what goes into `instructions.txt`.

**⛔ Do NOT duplicate tool/capability metadata in instructions.** Tool names, descriptions, parameters, and schemas are already available to the orchestrator through `ai-plugin.json` (`description_for_model`), MCP plugin manifests (`mcp_tool_description.tools[]`), and capability configuration in the agent manifest. Listing them in instructions wastes the 8,000-character budget.

Instructions should contain **decision logic only**: WHEN to use each capability, HOW to chain them, and WHAT to do on failure. See [Instruction Review](instruction-review.md) for the full anti-pattern catalog.

### Instruction Structure

In `declarativeAgent.json`, reference the instructions file using `${{file:instructions.txt}}`:

```json
{
  "instructions": "${{file:instructions.txt}}"
}
```

Then create `appPackage/instructions.txt` with the actual instructions in Markdown format.

---

## Instruction Components

A well-structured set of instructions ensures the agent understands its role, the tasks it should perform, and how to interact with users. The main components are:

**Required:**
- **Purpose** — What goal must the agent accomplish?
- **General guidelines** — Tone, restrictions, and general directions
- **Skills** — What capabilities and actions does the agent have?

**When relevant:**
- Step-by-step instructions
- Error handling and limitations
- Interaction examples
- Nonstandard terms / domain vocabulary
- Follow-up and closing behavior

---

## Best Practices for Instructions

### 1. Use Clear, Actionable Language

- **Focus on what Copilot should do**, not what to avoid.
- **Use precise, specific verbs**: "ask", "search", "send", "check", "use".
- **Supplement with examples** to minimize ambiguity.
- **Define any terms** that are nonstandard or unique to the organization.

❌ **Vague**: "Help users with their questions"
✅ **Specific**: "Answer questions about company policies using documents from the HR SharePoint site. If the answer isn't in the documents, direct users to hr@company.com"

### 2. Build Step-by-Step Workflows with Transitions

Break workflows into modular, unambiguous, and nonconflicting steps. Each step should include:

- **Goal**: The purpose of the step.
- **Action**: What the agent should do and which tools to use.
- **Transition**: Clear criteria for moving to the next step or ending the workflow.

### 3. Use Strict Structure

Structure is one of the strongest signals used to interpret intent:

- Use **sections** to group related tasks into logical categories, without implying sequence.
- Use **bullets** for parallel tasks that can be completed independently. Avoid numbering that might introduce unintended order.
- Use **steps** for actions that must occur in a required sequence, and reserve them only for true workflows.

### 4. Make Tasks Atomic

Break multiaction instructions into clearly separated units.

- Instead of: "Extract metrics and summarize findings."
- Use separate steps:
  1. Extract metrics.
  2. Summarize findings.

### 5. Specify Tone, Verbosity, and Output Format

If you don't specify these, the model might infer them inconsistently. Always specify:

- **Tone**: professional and concise
- **Output**: Three bullet points per section
- **Constraint**: Return only the requested format; no explanations

### 6. Structure Instructions in Markdown

Use [Markdown](https://www.markdownguide.org/basic-syntax) for emphasis and clarity:

- Use `#`, `##`, `###` for section headers
- Use `-` for unordered lists and `1.` for numbered lists
- Highlight tool or system names with backticks (e.g., `Jira`, `ServiceNow`)
- Make critical instructions bold with `**`

### 7. Provide Clear Intent for Each Data Source

Describe the purpose and context for each data source the agent can use. You don't need to use the exact capability names from the manifest — M365 Copilot maps them internally. What matters is clear intent: **when** and **why** each data source should be used.

- **Actions/plugins**: Reference by name — "Use `Jira` to fetch tickets."
- **Copilot connector knowledge**: Reference by connector name — "Use `ServiceNow KB` for help articles."
- **SharePoint/OneDrive**: Describe the data source — "Search internal HR policy documents" or "Reference company documents in SharePoint."
- **Email**: Describe the scenario — "Check user emails for relevant information."
- **Teams messages**: "Search Teams channels and chat messages." (messages only — NOT transcripts)
- **Meetings**: "Check calendar events, attendees, and meeting transcripts." (transcripts come from `Meetings`, not `TeamsMessages`)
- **Code interpreter**: "Use code interpreter to generate charts."
- **People knowledge**: "Look up people in the organization for contact info."

> **Common mistake:** Assuming meeting transcripts are part of `TeamsMessages`. Transcripts are retrieved through the `Meetings` capability. `TeamsMessages` covers channel posts, DMs, and meeting chat messages only. See the [Capability Reference](instruction-review.md#capability-reference-v16) for the full mapping.

### 8. Provide Examples

- For simple scenarios, examples aren't needed.
- For complex scenarios, use **few-shot prompting** — give more than one example to illustrate different aspects or edge cases.

### 9. Control Reasoning Through Phrasing

Your wording signals how much reasoning the model should apply:

**Deep reasoning:**
```md
Use deep reasoning. Break the problem into steps, analyze each step, evaluate alternatives, and justify the final decision. Reflect before answering.
Task: Determine the optimal 3-year migration strategy given constraints A, B, and C.
```

**Moderate reasoning (balanced):**
```md
Provide a concise but structured explanation. Include a short summary, 3 key drivers, and a final recommendation. No step-by-step reasoning required.
Task: Explain the tradeoffs between solution X and Y.
```

**Fast and minimal reasoning:**
```md
Short answer only. No reasoning or explanation. Provide the final result only.
Task: Extract the product name and renewal date from this paragraph.
```

### 10. Add a Self-Evaluation Step

A self-check step reinforces completeness. For example:

> Before finalizing, confirm that all items from Section A appear in the summary.

### 11. Iterate on Your Instructions

Developing instructions is an iterative process:

1. **Create** instructions and conversation starters following this guidance.
2. **Publish** your agent.
3. **Test** your agent:
   - Compare results against Microsoft 365 Copilot.
   - Verify conversation starters work as expected.
   - Verify the agent acts according to instructions.
   - Confirm prompts outside conversation starters are handled appropriately.
4. **Iterate** on instructions to further improve output.

---

## Example Instructions

The following example is for an IT help desk agent:

**`appPackage/instructions.txt`:**
```md
# OBJECTIVE
Guide users through issue resolution by gathering information, checking outages, narrowing down solutions, and creating tickets if needed. Ensure the interaction is focused, friendly, and efficient.

# RESPONSE RULES
- Ask one clarifying question at a time, only when needed.
- Present information as concise bullet points or tables.
- Avoid overwhelming users with details or options.
- Always confirm before moving to the next step or ending.
- Use tools only if data is sufficient; otherwise, ask for missing info.

# WORKFLOW

## Step 1: Gather Basic Details
- **Goal:** Identify the user's issue.
- **Action:**
  - Proceed if the description is clear.
  - If unclear, ask a single, focused clarifying question.
    - Example:
      User: "Issue accessing a portal."
      Assistant: "Which portal?"
- **Transition:** Once clear, proceed to Step 2.

## Step 2: Check for Ongoing Outages
- **Goal:** Rule out known outages.
- **Action:**
  - Query `ServiceNow` for current outages.
  - If an outage is found:
    - Share details and ETA.
    - Ask: "Is your issue unrelated? If yes, I can help further."
    - If yes, go to Step 3. If no/no response, end politely.
  - If none, inform the user and go to Step 3.

## Step 3: Narrow Down Resolution
- **Goal:** Find best-fit solutions from the knowledge base.
- **Action:**
  - Search `ServiceNow KB` for related articles.
  - **Iterative narrowing:** Don't list all results. Instead:
    - Ask clarifying questions based on article differences.
    - Eliminate irrelevant options with user responses.
    - Repeat until the best solution is found.
  - Provide step-by-step fix instructions.
  - Confirm: "Did this help? If not, I can go deeper or create a ticket."

## Step 4: Create Support Ticket
- **Goal:** Log unresolved issues.
- **Action:**
  1. Map category and subcategory from the `sys_choice` SharePoint file.
  2. Fetch user's UPN (email) with the people capability.
  3. Fill the ticket with: Caller ID, Category, Subcategory, Description, attempted steps, error codes.
- **Transition:** Confirm ticket creation and next steps.

# OUTPUT FORMATTING RULES
- Use bullets for actions, lists, next steps.
- Use tables for structured data where UI allows.
- Avoid long paragraphs; keep responses skimmable.
- Always confirm before ending or submitting tickets.
```

---

## Instruction Design Patterns

### Pattern 1: Deterministic Workflows

Remove ambiguity by defining atomic steps, explicit formulas, and required validation:

```md
## Task: Metrics and ROI (Deterministic)

### Definitions (Do not invent)
- Metrics to compute: [Metric1], [Metric2], [Metric3]
- ROI definition: ROI = (Benefit - Cost) / Cost
- Source of truth: Use ONLY the provided document(s) for inputs

### Steps (Sequential — do not reorder)
Step 1: Locate inputs for [Metric1-3] in the document. Quote the source.
Step 2: Compute [Metric1-3] exactly as defined. If any input is missing, stop and ask.
Step 3: Compute ROI using the definition above. Do not substitute other formulas.
Step 4: Output ONLY the table in the format below.

### Final check (Self-evaluation)
Before finalizing: confirm every metric has (a) a value, (b) a source, and (c) no assumptions.
```

### Pattern 2: Parallel vs Sequential Structure

Make sure the model separates parallel and sequential logic:

```md
## Section A — Extract Data
- Extract pricing changes.
- Extract margin changes.
- Extract sentiment themes.

## Section B — Build the Summary (Sequential)
**Step 1:** Integrate findings from Section A.
**Step 2:** Produce the 2-page call prep summary.
```

### Pattern 3: Explicit Decision Rules

Add if/then rules to prevent unintended model interpretation:

```md
Read the product report.
Check category performance.
If performance is stable or improving, write the summary section.
If performance declines or anomalies are detected, write the risks/issues section.
```

### Pattern 4: Output Contract

Define shape, structure, tone, and allowed content:

```md
## Output Contract (Mandatory)
Goal: [one sentence]
Format: [bullet list | table | 2 pages | JSON]
Detail level: [short | medium | detailed] — do not exceed [X] bullets per section
Tone: [Professional | Friendly | Efficient]
Include: [A, B, C]
Exclude: No extra recommendations, no extra context, no "helpful tips"
```

### Pattern 5: Self-Evaluation Gate

Add an explicit self-check step before responding:

```md
## Final Check: Self-Evaluation
Before finalizing the output, review your response for completeness, ensure that all Section A elements are accurately represented, check for inconsistencies, and revise if needed.
```

### Pattern 6: Literal-Execution Header

Use when an agent shows inference drift or step reordering, especially after a model update:

```md
Always interpret instructions literally.
Never infer intent or fill in missing steps.
Never add context, recommendations, or assumptions.
Follow step order exactly with no optimization.
Respond concisely and only in the requested format.
Do not call tools unless a step explicitly instructs you to do so.
```

---

## Conversation Starters

Conversation starters are pre-written prompts that users can click to begin conversations. They showcase the agent's capabilities and guide users toward productive interactions. Defined in the `conversation_starters` array in `declarativeAgent.json`.

### Best Practices

#### 1. Showcase Different Capabilities

```json
{
  "conversation_starters": [
    {
      "title": "Employee Handbook",
      "text": "What are the latest updates to the employee handbook?"
    },
    {
      "title": "Leadership Emails",
      "text": "Summarize emails from the leadership team this week"
    },
    {
      "title": "My Tickets",
      "text": "Show me open support tickets assigned to me"
    },
    {
      "title": "Satisfaction Trends",
      "text": "Analyze customer satisfaction trends from last month"
    }
  ]
}
```

#### 2. Make Them Specific and Actionable
❌ **Too vague**: "Help me with something"
❌ **Too broad**: "Tell me about the project"
✅ **Specific**: "What are the Q4 deliverables for the Phoenix project?"
✅ **Actionable**: "Create a support ticket for a printer issue"

#### 3. Cover Common Use Cases

Identify the top 3-5 tasks users will perform:

```json
{
  "conversation_starters": [
    { "title": "Vacation Days", "text": "How many vacation days do I have left?" },
    { "title": "Remote Work", "text": "What is the remote work policy?" },
    { "title": "Expense Reports", "text": "How do I submit an expense report?" },
    { "title": "Benefits Contact", "text": "Who do I contact about benefits questions?" }
  ]
}
```

#### 4. Use Natural Language

Write starters as users would naturally speak:

✅ Good: "What's the latest on Project Phoenix?"
❌ Bad: "Query project status for Phoenix"

#### 5. Provide 3-6 Starters (Not Too Many)
- **Too few** (<3): Users don't see the full capability range
- **Just right** (3-6): Good variety without overwhelming
- **Too many** (>6): Clutters UI, users won't read them all

---

## Avoiding Common Prompt Failures

> **Reviewing existing instructions?** If you are auditing or improving instructions that already exist (rather than writing from scratch), use the [Instruction Review](instruction-review.md) guide instead. It provides a diagnostic checklist, named anti-patterns, and before/after rewrite examples.

| Problem | Solution |
|---------|----------|
| **Overeager tool use** — model calls tools without needed inputs | Add: "Only call the tool if necessary inputs are available; otherwise, ask the user." |
| **Repetitive phrasing** — model reuses example phrasing verbatim | Use few-shot prompting with varied examples. |
| **Verbose explanations** — model overexplains or provides excessive formatting | Add verbosity constraints and concise examples. |
| **Too vague** — instructions lack specific guidance | Add concrete examples for each capability. |
| **Too restrictive** — over-constrained agents refuse reasonable requests | Relax constraints; focus on what to do, not what to avoid. |
| **Missing error handling** — no guidance for when things go wrong | Add explicit error handling sections. |
| **Scope creep** — instructions cover too many unrelated domains | Focus on one domain; redirect out-of-scope requests. |
