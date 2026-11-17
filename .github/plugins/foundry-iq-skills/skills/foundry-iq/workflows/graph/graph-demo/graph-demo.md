# Graph demo

Starter prompt: "Show me what Foundry IQ graph can do." The demo drives itself: one intake reply, one approval choice, then cards. "Continue my Foundry IQ demo" resumes at the last finished act; there is no demo state file.

**Run it yourself.** Run commands in this conversation; say what they do and wait for it to finish, Azure writes too. No subagents or background shells, no reading or importing runtime source, no scripts of your own, no Azure MCP tools, doc pages, help text or hand-made `az rest`. Follow printed commands. On failure, say one plain line; follow next_step; run doctor only for sign-in problems.

| Need | Load |
|---|---|
| Opening, acts, cards, stops | [Story](references/story.md) |
| Intake, validation | [Intake](references/intake.md) |
| Existing resources | [Connect existing](../entity-graph-provision/references/connect-existing-resources.md) |
| Folder or Blob source | [My data](references/byo-data.md) |
| Own `.jsonld` | [My ontology](references/byo-ontology.md) |
| Grounding | [Grounding](references/grounding.md) |
| Questions, recap, cleanup | [Finish](references/finish.md) |
| Exact commands | [Hand-offs](references/handoffs.md) |
| Act 1 commands | [Checks](references/install-and-checks.md) |

## Acts

1 Readiness, then intake. 2 Searchable documents: resources, grounding (if chosen), chunk-and-embed build. 3 Topics and publish, on every path. 4 Ontology. 5 Trial. 6 Attach, then native topic retrieval. 7 See it. 8 Questions.

## Rules

- Ask every intake question in one message; validate, show the run summary and ask once: Approve all, Approve each step or Stop (Intake). Approve all skips the leaves' card question.
- Before each card, say one plain line and show it verbatim. Never ask for an ID or cover cleanup. Re-show cancelled cards.
- Finish Hand-offs' native topic retrieval gate after attach, before Act 7; publish enables browsing only.
- Speak plainly (Voice in Story).
