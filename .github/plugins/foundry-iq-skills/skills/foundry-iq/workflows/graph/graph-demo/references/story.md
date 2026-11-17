# Story

The demo makes one argument: search finds passages; a knowledge graph understands what's in them. Each act is one step in it. Say the user-facing lines below in plain words; keep commands, flags, digests and journal paths in tool calls.

## Voice

- Name things: the subscription, model, region and resource group. Never point at a row number or an ID.
- Ask one short question with a default, such as "Use it? (yes / pick another)".
- Costs come only from the cards and plan output ("about $X"); never look prices up. An unknown cost is "unknown".
- No jargon ("model discovery", "Azure CLI subscription") and no disclaimers ("this does not authorize changes or spending"). The cards cover approval.
- Ask about models; their region is only a column. Before the resources card, say in one line what it makes, such as "I'll create **gpt-5.6-luna** for chat and **text-embedding-3-small** for embeddings, with Search in **<the Search region the user named>**. OK?"

## Opening

After the starter prompt, print this pitch word for word before running anything, then Act 1:

> Foundry IQ turns a folder of documents into something an agent can reason over.
>
> I'll take **49 Microsoft earnings calls (2014–2026)** and build three things on Azure AI Search: **topics** that show what the calls are about, an **ontology** that names the things in them, and a **knowledge graph** that connects who said what about which product. Then we'll ask questions that plain search can't answer well.
>
> I'll do the work. Anything that changes Azure or costs money is on a card; there will be up to **10**. After your answers I'll show them all with their costs, and you can approve them all at once or one at a time.
>
> Want to use your own documents, ontology, or Azure Search and models instead, or have me generate an ontology from the topics? Tell me in your answer below.
>
> First, I'll check your machine and your Azure sign-in.

## Acts

1. **Readiness**: preflight, the sign-in check and the models in the signed-in subscription ([commands](install-and-checks.md#act-1-commands)). Preflight may prepare the plugin's runtimes; nothing touches Azure. "Your machine is ready. You're signed in to **<subscription>**, and here are the models you can use." Then the [intake](intake.md).
2. **Your documents become searchable.** Resources, then the sample or the user's folder, then the build with no ontology: chunks and embeddings only. "This is what search alone sees: passages and vectors. It can find text that looks like your question. It doesn't yet know that Satya Nadella is a person or that Azure is a product." With grounding, set it up here, before the build card ([grounding](grounding.md)). Show the document count and the plain-search answer, with its source, to one sample question about named facts (people, products, figures): the baseline for Act 8.
3. **Discover what the documents are about.** Topics read the chunk index in place with the run's chat model (no new model question), then publish, then the Sitemap from the one browse command publish prints. "Before we decide what things to extract, let's see what the corpus is about. Topics group passages by meaning, with no schema needed." Show the outline, broadest topics first with each share, and open one topic with a sample passage.
4. **Name the things that matter.** Standard (the default): "We'll use the standard business schema: organizations, people, products, places and events." Generated (opt-in): "The topics told us what the calls talk about. Now I'll turn that into an ontology: the types of things and how they relate. You review it before anything uses it." Go straight from the proposal to its review and approval, and say what it has in the card's words ("23 types of things, 40 links between them"). Approving it is a review, not an Azure write. Improving it with a reviewer model is offered at the end, not done here. Mine: see [my ontology](byo-ontology.md).
5. **Try before you commit.** Generated or my ontology only; the Standard path skips it. "An ontology can't be removed once it's attached, so we test it on a few documents first and look at what it actually extracts." Show classes and relationships with hits and those with none. No-go returns to Act 4.
6. **Build the graph.** "Same documents, same index. Now Search extracts entities and relationships using your ontology. Because we chunked once, this step is only extraction." With grounding: "…and resolves each name against your grounding index." Warn that the ontology can't be removed. Then verify it ([hand-offs](handoffs.md#6-attach)); show relationships per type, entities per class, grounding coverage, and every class or relationship with no facts. A failed verify stops here. After attach creates the Knowledge Base, show the native topic retrieval card: "This connects the topics to search and the Knowledge Base." Creation is complete only once that setup is verified.
7. **See it**, as soon as Act 6 finishes, then 8. **Ask questions search can't answer well**: [finish](finish.md).

## Cards by path

Number a run's cards 1..N in this order, skipping those not chosen; that N is the exact count. Grounding is always before the build and never after attach.

- Standard ontology (default): resources · grounding (if chosen) · build · topics · publish · attach · native topic retrieval
- Generated ontology: resources · grounding (if chosen) · build · topics · publish · ontology spend · ontology review · trial (recommended) · attach · native topic retrieval
- My ontology: resources · grounding (if chosen) · build · topics · publish · trial · attach · native topic retrieval

Data (sample or my folder) doesn't change the cards. The last card, native topic retrieval, connects the topics to the Knowledge Base; local publish never counts as that approval.

Before each card, even under Approve all, one plain line of what it does: "Card 4 of 7: this names about 40 topics in your index with the chat model." No caveats, other acts' budgets or IDs. After each act: **Done** (one line), **Why it matters** (one line), **Next** (the next act or card).

## Stops and recovery

| Stop | One next action |
|---|---|
| Card | Approve each step, or a card [Approve all](intake.md#then-show-the-plan-and-ask-once) doesn't cover: ask one Approve/Stop question; if it's cancelled, show the card again |
| User says stop | Nothing more runs |
| Intake | Re-ask only the missing or invalid item |
| A command fails | One plain line to the user, never the raw error; run the command its next step names |
| Partial ingestion | Offer: investigate the failed documents, or continue without them |
| Policy block | Ask for another subscription for storage and models, then re-plan |
| Quota shortfall | Explain it and offer a re-plan |
| Search region without the graph features | Re-plan Search in a region the user names; models stay put |
| Resource group this demo didn't make | Re-plan with a new group name, such as the old name plus "-2" |
| Role not yet propagated | Show the role card, then re-check |

Resume with "Continue my Foundry IQ demo": find the run from the workspace's journals and descriptors, run the read-only checks for each finished act ([hand-offs](handoffs.md#resume)), and pick up after the last act that passes. Approval holds only for one conversation: show the summary of the remaining cards and ask again.
