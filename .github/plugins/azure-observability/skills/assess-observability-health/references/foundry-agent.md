# Foundry-agent lens

Resolve the exact project and intended agent/version with available supported
public metadata operations or user-confirmed identifiers. Establish its actual
telemetry association. Repository names, shared tags, or an Application Insights
role name alone do not prove a specific Foundry agent linkage.

Use current tool schemas, not assumed command names. Do not retrieve secret
connection objects or full agent configurations. If an operation cannot safely
return needed metadata without sensitive fields, stop and request a safer source
or user confirmation.

Apply the entry point's one bounded pass using
[Foundry health procedures](foundry-agent-health.md). This reference supplies
attribution/correlation safeguards, not a second assessment or additional reads.

Do not invent semantic attribute names or assume every agent uses the same
instrumentation. Inspect schema and bounded allowed-key projections first if
necessary. Preserve unsupported or unavailable fields as gaps.

For hosted-agent tool coverage, establish the target on request records first,
then correlate dependencies using the actual observed trace/operation IDs.
Do not require every child span to repeat the top-level agent name or version:
that filter can exclude the tool path while leaving successful wrappers.
De-duplicate request trace IDs before joining dependencies; propagate a version
only when its request mapping is unambiguous. Keep missing/conflicting mappings
separate. Same-trace membership identifies candidates, not direct parentage:
use span/parent IDs to establish tree edges. Schema fields alone do not prove
these joins or identities. If correlation is unavailable, report tool coverage
as unverified rather than treating agent-name-matched dependencies as complete.
Do not retrieve arguments, results or broad property bags to fill that gap.

Avoid counting gateway/runtime/model wrapper spans as distinct logical model
calls, or summing duplicated token usage across layers. If the canonical layer
cannot be established, report per-layer stored records rather than logical calls.

A completed run/HTTP success does not establish correct answers, safe behavior,
successful tools, or business outcomes. These require their own evidence.
Distinguish evaluation execution failures from negative evaluated outcomes.
An unsupported evaluator is a coverage limitation, not a proven quality failure.

If only request/dependency telemetry is available, assess that operational scope
explicitly. Do not label it full agent health. Missing evaluation evidence is
not proof that evaluations are unconfigured or that the agent is unsafe.
