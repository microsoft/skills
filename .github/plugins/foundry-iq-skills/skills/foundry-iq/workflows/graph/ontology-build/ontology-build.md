# Ontology build

First read [runtime setup](../graph-guide/references/install-and-checks.md#plugin-and-clis); use its `run <domain>` launcher.

Opt-in. The demo attaches `schema_org` and skips this skill; use it to generate an ontology from a Topic Graph build.

Load one path only.

| Intent | Load |
|---|---|
| Set up, connect, inspect the topics, or plan and run a proposal | [Connect, plan, propose](references/connect-plan-propose.md) |
| Refine a draft, run one critique, or apply a critique | [Refine, critique, revise](references/refine-critique-revise.md) |
| Review, approve, import, export, or hand off the current ontology | [Review, approve, export](references/review-approve-export.md) |

## Shared rules

Named runs: [run naming](../graph-guide/references/run-naming.md). Keep one absolute state directory.

Run `ontology-build doctor --json` first. Add `--json` to every verb; read `next_step` and `error_code`, but if Azure checks skip or block, use [prerequisites](../graph-guide/references/install-and-checks.md#missing-prerequisites). Input: a local Topic Graph build output folder (unpublished is fine), read-only access to its original source index, and an Azure OpenAI deployment.

Card verbs: `propose`, `refine`, `critique`, `approve`. Show each runtime `approval` card verbatim, ask one Approve/Stop question, then pass its `--plan-id` (`approve`: `--version`, `--schema-id`); never write or paraphrase your own approval text, never promise behavior the plan doesn't state, never ask the user to type an ID, and no raw `az`/REST workarounds; when the CLI blocks, stop and report the blocker. Take the model from `--build-args` or the user's explicit choice; never infer one. Never use `--force` on export unless asked. Never assign roles; show the printed command for an owner. Don't self-install tooling, read the runtime source or use Azure MCP tools. Entra only. No secrets, tenant details or passage text in output.
