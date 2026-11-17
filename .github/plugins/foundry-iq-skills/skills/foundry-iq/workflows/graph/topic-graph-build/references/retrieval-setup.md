# Native retrieval setup

Use this to turn on topic retrieval in Search or a Knowledge Base, including for an existing verified generation. Browsing alone doesn't need it. Never rebuild just to activate.

## Plan, approve, configure

1. Keep the original absolute `--state-dir`. If no verified generation exists, finish [plan and apply](plan-and-apply.md) first. Use the runtime launcher from [setup](../../graph-guide/references/install-and-checks.md#plugin-and-clis).
2. Pick the verified generation and, for KB retrieval, the existing Knowledge Source and Knowledge Base on its content index. With a deferred ontology, take both names from the final attached descriptor. Recommend stored default **off**; **on** sets `balanced` for every caller of that field or Knowledge Source. Plan (read-only):

   ```bash
   topic-graph-build --state-dir <absolute-state> --json plan-retrieval --generation-id <generation> --topic-diversity off --knowledge-source <existing-ks> --knowledge-base <existing-kb>
   ```

   Omit the Knowledge Source and Knowledge Base for Search-only setup.
3. Show `approval_card.text` verbatim and ask one Approve/Stop question. Build or publish approval doesn't count. After approval, run in the main shell (`initial_wait: 600`):

   ```bash
   topic-graph-build --state-dir <absolute-state> --json configure-retrieval --plan-id <approved-plan> --confirm-writes
   topic-graph-build --state-dir <absolute-state> --json verify-retrieval --plan-id <approved-plan>
   ```

   The card names every change. Configure never creates a missing index, Knowledge Source or Knowledge Base, never changes access, and never deletes an old generation.

## Verify queries

Readback is not proof. Run `verify-retrieval`, and report `live_queries: not_run` until a query runs. To compare, ask the same question with `entity-graph-consume query --query <question> --topic-diversity default|on|off` (add `--graph --query-mode kb` for the KB arm), or use On and Off in Why Graph.

## Failure and return

A blocked plan or configure reports a typed blocker. Report it; no hand-written REST or SDK workaround.

After an uncertain or partial update, stop and run `verify-retrieval` with the same plan, not build `reconcile`. Conflicts need a fresh `plan-retrieval` and approval. Never blindly retry or roll back.

Setup is complete only when readback reports `state: configured` for every selected resource. After reingestion or a new generation, repeat this with the new generation and final Knowledge Source and Knowledge Base.

Return the generation, topic index, chosen default, resource states, whether live queries ran, and the next safe action.
