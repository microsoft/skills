# Optional Azure checks and controlled tests

Use only when a missing fact needs live evidence; offline log analysis does not
need Azure access. Discover advertised tool capabilities and schemas first and
query only the user-confirmed resource and bounded UTC window.

The plugin configures Azure MCP, not a Speech log-analysis MCP. The local
analyzer provides that function. Candidate command families below were checked
in [Azure MCP source](https://github.com/microsoft/mcp/tree/bc89c9e5e2f774db19d9bc391b16f2920384ddfd/tools);
installed versions and host names can differ. Do not hardcode these as tool
signatures.

| Capability | Use and boundary |
|---|---|
| Foundry extensions resource get | Cognitive Services account endpoint, location, kind, SKU; not complete network/auth configuration |
| Monitor metric definitions/query | Discover metrics/dimensions first; then a bounded UTC symptom window |
| Monitor resource/workspace log query | Customer-collected logs only; absent diagnostics are not proof of no requests |
| Monitor activity log | Management changes; current settings do not establish historical state |
| Authorization role assignments | Inspect relevant scopes/principal; checked tool excludes parent-inherited assignments |
| Resource/Service Health | Supporting context when the resource/provider is supported; no event is not proof of no outage |
| Speech STT recognize / TTS synthesize | Optional baseline test, with conditions below |
| Extension CLI generate | Generates commands, does not execute them; inspect generated read-only commands before any shell execution |

For ACL, private endpoint or local-auth questions, use an advertised management
read that exposes the fields, or a scoped Azure CLI read if shell/CLI are
available. Never request `listKeys` or put credentials into prompts. A generic
ARM resource/provisioning read is not a Resource Health check. Configured state
does not prove effective DNS/routes from the affected application.

## Speech test equivalence

Before any live Speech test that sends data or may incur charges, obtain
agreement on content, destination/endpoint, execution host, identity/auth,
possible costs and local writes. Compare the customer's request with the test:

| Dimension | Record |
|---|---|
| Environment | MCP server host versus app host, network/proxy/DNS |
| Authentication | Key/token/Entra and principal; never credentials |
| Path | Endpoint and Fast/Realtime; fallback or unknown actual path |
| SDK | Version/language if known; unknown if not exposed |
| Input/features | Audio/text, locale/voice, custom endpoint and features |

The checked STT MCP selects Fast or Realtime and can fall back; it is not an
exact reproduction of a realtime SDK failure. Checked Speech implementations
use Entra credentials/tokens, which may differ from the customer's key. A
successful MCP call does not validate the customer's credential, microphone,
proxy, original request settings or SDK version.

If the tool does not expose actual path/IDs, report those as unknown. Do not
infer them from success. Check the Speech result, not just the MCP envelope
status. For a path-equivalent reproduction, use a reviewed SDK sample in the
affected environment with user approval; do not quietly substitute a different
API. Store a small result receipt: time, conditions, observed outcome and what
remains untested.

On disabled MCP, denied access or unavailable tools, continue offline under
the shared workflow. Do not enable logging on the MCP process as a fallback.
