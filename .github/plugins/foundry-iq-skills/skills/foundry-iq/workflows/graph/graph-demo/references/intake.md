# Intake

The only questionnaire. Ask it after Act 1 in one message with numbered questions and the defaults filled in, so "defaults are fine" is a complete answer.

1. **Tenant.** Name it before any sign-in.
2. **Subscription and a new resource group name.** Ask "You're signed in to **<subscription>**. Use it for storage, models and Search? (yes / pick another; Search can have its own subscription)". For another, ask for its name, show its models and re-ask item 3. Storage and new models default to West US 3. Search goes in a region where the graph features are available; ask the user if unsure, and never pick one yourself; without an answer, Search goes with the models. Next to the Search region, ask for the Search subscription; default "Same as above". For another, give the plan that subscription and a new Search group, `<prefix>-search-rg` ([new resources](../../entity-graph-provision/references/new-resources.md) has the overrides). Use the run's suggested group name (item 9); a group this demo made earlier can be reused, and the plan keeps what's already there. Or use existing Search, storage and models: [connect existing](../../entity-graph-provision/references/connect-existing-resources.md); skip the items that connect answers.
3. **Models.** Show the Act 1 model table as is: usable chat and embedding models by name and region, the user's own first. Ask for one embedding model and one chat model by name, or "create new ones for me" (the default when none are usable). The user always picks the chat model, even when there's only one.
4. **Data.** Sample earnings calls (default), a local folder, or an existing Blob container with an explicit prefix or whole-container scope ([my data](byo-data.md)).
5. **Ontology.** Standard (default): the built-in business ontology, with no ontology spend, review or trial. Opt in to one generated from the topics, or give the path to a `.jsonld` file ([my ontology](byo-ontology.md)).
6. **Ontology spend cap.** Only for a generated ontology. Default $1.
7. **Trial size N.** Only for a generated ontology or my ontology. Default 5.
8. **Grounding.** Skip, Wikidata seed, or the path to an entity file ([grounding](grounding.md)). Default: Wikidata seed for the sample, skip for user data. For an entity file, also ask for its licence.
9. **Run name.** A short label such as travel, finance or mydocs; propose a corpus-derived default (`earnings` for the sample). Resolve it once using [run naming](../../graph-guide/references/run-naming.md); use the returned prefix throughout this run.

## Validate before the first card

| Input | Must hold | If not |
|---|---|---|
| Subscription | Access confirmed | Re-ask item 2 |
| Folder | Exists and is not empty; the build's inventory reports what will be indexed and what will be skipped | Re-ask item 4 |
| Blob source | Exact account ARM ID, HTTPS endpoint, container and approved prefix or whole-container scope; read-only inventory succeeds | Re-ask item 4 |
| `.jsonld` | `ontology-consume check` passes | Re-ask item 5 |
| Trial size | 1 ≤ N < M, where M is the number of documents; with fewer than two documents there is no trial | Re-ask item 7 |
| Entity file | Exists; CSV, JSONL or Parquet; has the columns the grounding build needs; has a licence; within the edge limit | Re-ask item 8 |
| Run name | Normalizes to 1-24 ASCII letters, digits and single dashes | Re-ask item 9 |

Re-ask only the item that is missing or invalid; keep every other answer.

## Then show the plan and ask once

Show one plain run summary:

- the run's N cards in order, each in plain words ([cards by path](story.md#cards-by-path)); name the longer steps (build, topics, attach) without times;
- the subscription, resource group, resource names, Search region and models, by name;
- every known cost ("about $X");
- the caps that apply: the number of Act 8 questions, plus the ontology spend cap (generated only) and trial size N (generated or my ontology; not a document cap for a Blob source, see [my data](byo-data.md)); Act 8 makes model calls on one question only;
- every charge whose cost is unknown, named. Unknown is never zero.

Then ask one question: **Approve all**, **Approve each step** or **Stop**.

- **Approve all**: before each card, still say its "Card k of N" line and show the card verbatim, then apply it without asking. For a generated ontology, this covers the ontology review; still show what the ontology contains.
- Even under Approve all, stop and ask one Approve/Stop question for a card that:
  - differs from the summary: another resource, region, model or group, more documents, a higher cost or a new unknown charge;
  - changes roles or network settings on anything this demo didn't create;
  - comes after a failure; a blocked, partial or uncertain result; or a card or command you re-ran. Retries a command handles itself before it succeeds don't count;
  - follows a no-go trial.
- Cleanup and deletes are never covered.
- **Approve each step**: ask one Approve/Stop question before every card.
- **Stop**, or the user says stop at any time: nothing more runs.

Approval holds only for this conversation. On "Continue my Foundry IQ demo", show the summary of the remaining cards and ask again. Then start Act 2.
