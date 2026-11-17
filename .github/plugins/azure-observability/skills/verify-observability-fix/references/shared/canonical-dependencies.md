# Discover canonical specialist dependencies

This plugin contains four core skills. `azure-diagnostics` and
`microsoft-foundry` are canonical external instruction dependencies, not bundled
copies, automatic installs or mandatory prerequisites for evidence-only core
investigation. They add relevant specialist expertise; they do not supply
telemetry authorization.

## Check host availability before choosing a fallback

For an agent/model/tool failure or an AI-specific trace/runtime/evaluation
question, perform this checkpoint before starting more core investigation.
Apply it to `azure-diagnostics` when Azure service-specific expertise is needed.
Existing sufficient findings need no redundant handoff.

1. Check the current host-exposed skill names/descriptions, including enabled
   Azure Skills and other plugins, not just this plugin's four directories.
   If the host offers skill discovery, use that supported mechanism when
   necessary. A tool/MCP list is not a skill inventory. Not bundled, no sibling
   directory, or absent from one plugin manifest does not mean unavailable.
2. If the relevant specialist is exposed and enabled, use the actual supported
   skill-loading mechanism and verify the load before choosing core fallback.
   Use the discovered name, including any host-provided prefix; never invent
   an invocation. Ordinary instruction loading within the retained ceiling
   needs no new setup or redundant telemetry-approval prompt.
3. If loading fails, report the actual failed-load result. If explicit invocation
   is required or policy disables loading, retain that restriction and explain
   the supported user action; do not bypass it with file reads or another name.
   Check the selected workflow's prerequisites and side effects before executing
   any scripts or operations; instruction loading grants no additional consent.
4. If the host exposes neither the skill nor a supported discovery mechanism,
   report availability unverified in this session, not confirmed absent or
   uninstalled. Do not scan caches, fetch upstream instructions or query Azure
   to establish skill availability. Continue permitted core analysis with this
   specific limitation and offer a supported host visibility/refresh check.

Before fallback, give a concise reason based on the actual discovery/load result:
not exposed in this session, disabled, explicit invocation required, failed load,
incomplete resources or incompatible workflow side effects. Never say both
canonical specialists are unavailable after checking only one. Direct Azure
Monitor tools can be used by a loaded Foundry workflow; their presence is not
a reason to skip applicable specialist instructions. Loading a skill is not
delegating to an external service or creating a remote investigation.

## Select only what the current question needs

| Need | Canonical dependency | Core fallback |
|---|---|---|
| Azure service-specific diagnostics beyond the local affected-path workflow | `azure-diagnostics`, Microsoft Azure Skills | [Bounded investigation](investigation/README.md) using supplied sanitized evidence or sufficient existing approved operations |
| AI-specific trace/runtime or existing evaluation interpretation | `microsoft-foundry`, Microsoft Azure Skills | Preserve agent/model/tool evidence, separate semantic and transport outcomes, and analyze the affected application/dependency path locally; disclose any unanswered AI-specific question |

Use the host's actual discovered name, origin/version and supported loading
mechanism. Disambiguate duplicate names; do not assume a repository directory,
sibling path, slash command, manifest resolver or cross-plugin RPC activates a
skill. Discovery is not installed-and-complete proof, loading proof, execution
proof, access or approval. Report these states separately.

Load only the relevant workflow after checking complete instructions/resources
and host restrictions. Respect explicit-invocation flags. Do not fetch/read files
from an absent dependency, bypass disabled loading, or follow its automatic
bootstrap, sign-in, cache migration, setup, job or collector steps. This package's
retained scope, no-query/no-save restrictions and approval ceiling govern the
handoff. If a specialist cannot work inside them, retain the blocker and use the
permitted core path rather than silently expanding authorization.
External specialists have their own entry requirements and execution defaults.
Inspect prerequisites and side effects of the actual selected workflow, including
automatic setup and nested scripts, before any operation. If mandatory setup
cannot be skipped within retained approval, report blocked setup explicitly;
do not assume upstream is evidence-only safe or execute its preflight to find out.

Before any specialist operation, state selected instructions, necessary actual
operations, retained scope/window, remaining read/row/retry budget and blockers.
Afterward distinguish instructions loaded, operations executed and fallback used.
Preserve evidence, selected finding, declines and consumed budgets across returns;
no repeated health sweep, scope interview or specialist loop.

## Missing or blocked dependency

Missing, disabled, failed-load, incomplete and policy-blocked are different
states. Name the precise blocker, continue permitted evidence-only investigation,
and offer setup only if the unresolved question needs it. Never install, fetch,
connect, authenticate, change identity/RBAC or execute scripts automatically.
A declined setup is retained; no repeated prompt absent a material change/request.

Review one concrete publisher-supported setup proposal using
[acquire-capability](acquire-capability.md#2-review-one-concrete-setup-proposal).
It covers need, source/revision, full contents, destination/dependencies,
licensing/policy and side effects, followed by separate applicable setup approval.
Then use [host discovery/loading](acquire-capability.md#3-load-another-skill-through-the-host)
and verify the actual load. No installation command or package ID is invented here.
If no supported installer is exposed, guide the developer through the documented
host action instead. Reuse existing tools/identity; setup never grants live reads.

Canonical Microsoft publisher sources and installation guidance:

- [Microsoft Azure Skills repository](https://github.com/microsoft/azure-skills)
- [Azure Skills installation guidance](https://github.com/microsoft/azure-skills#install-in-60-seconds)
- [Canonical azure-diagnostics source](https://github.com/microsoft/azure-skills/tree/main/.github/plugins/azure-skills/skills/azure-diagnostics)
- [Canonical microsoft-foundry source](https://github.com/microsoft/azure-skills/tree/main/.github/plugins/azure-skills/skills/microsoft-foundry)

These publisher links track a moving branch, not a pinned dependency version or
proof of current host installation, compatibility or tool availability. Resolve
and review the selected origin/revision and supported setup with the developer
before approved acquisition; reading this contract performs no network check.
