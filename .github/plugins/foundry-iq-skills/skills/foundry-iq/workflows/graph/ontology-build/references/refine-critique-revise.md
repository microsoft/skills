# Refine, critique, revise

## Quick starts

- "Price a refine pass on the latest ontology version and show me the approval card."
- "Run one critique of version 2 against my competency questions."
- "Apply the accepted changes from critique `<id>` as a new version."

## Use this path

Use this path after a draft exists. A reviewer model checks the draft for gaps such as types with no relationships, catch-all types, and overlapping relationships, then fixes them and keeps each round as a version.

## Refine

1. Price it first: `ontology-build plan --kind refine --model-max-spend-usd <cap>`. Add `--queries <file>` when the user has questions the ontology must answer: their own `.jsonl` (one `id` and `query` per line), or a dataset's shipped questions file as is (the earnings sample's `earnings-corpus-questions.json`). Never write or convert a questions file yourself. When the reviewer/judge model is on a different deployment or Foundry/OpenAI endpoint from the proposal model, pass `--judge-deployment <dep>` and `--judge-endpoint <https-endpoint>` (always explicitly chosen by the user).
2. Show the plan `approval` card and ask one Approve/Stop question. After the user approves, run the `refine` command the plan printed, with `--plan-id`, `--approved-budget-usd`, and `--approve-model-calls`.
3. It stops on its own and never claims it's done while a proposed fix is unapplied. A malformed reviewer answer is asked again once inside the approved budget. If it still stops, run the same command again: finished calls are reused and not charged again. On `no_improvement` it keeps the best version and lists unapplied changes under `rejected`.

## Critique and revise

- `ontology-build plan --kind critique`, then show the card and ask one Approve/Stop question before `ontology-build critique`. It is one judged round that proposes changes and writes no version.
- Grounded critique asks the Knowledge Base once per question: billable model spend, at most 50 questions per run. First show a card with the question count (about one Knowledge Base retrieve each) and ask one Approve/Stop question. Only after approval run `ontology-build critique --mode grounded --queries <file.jsonl> --kb-name <kb> --ks-name <ks> --approve-model-calls --json`. It asks the Knowledge Base each question, classifies each outcome (`ONTOLOGY_GAP`, `EXTRACTION_MISS`, `GQL_PLANNING`, `TRUE_NEGATIVE`, `ANSWERED`, `graph_error`), and proposes change ops only for `ONTOLOGY_GAP` findings.
- `ontology-build revise --from-critique <id>` applies the accepted changes as a new, unapproved version. It sends nothing to the model, so it needs no approval card. `--accept <fingerprints>|all` narrows what is applied; the default is high and medium findings.

## Return

Show the result's `summary` line: what changed, why it stopped and what was spent. Give scores, finding names or rounds only if asked. Never present a refined version as approved; approval is a separate gate.
