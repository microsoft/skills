# Azure Observability skill plugin

**Start with the problem. Let Copilot help assemble the troubleshooting path.**

An alert fires. Requests slow down. An agent's tool calls start failing.
You shouldn't have to know which observability tool or specialist to reach
for first.

Describe the symptom. Copilot follows the plugin's guidance to connect your
question to evidence, investigate the affected path, review fix options, and
check recovery. Start troubleshooting without self-assembling an entire
observability toolbox.

**Detect -> Investigate -> Remediate -> Validate**

## From a troubleshooting question to a useful next step

| Stage | What Copilot helps you do | What you get |
|---|---|---|
| **Detect health issues** | Assess existing signals or supplied evidence. | Ranked findings, coverage gaps and a choice of what to investigate. |
| **Investigate the affected path** | Follow relevant application, dependency, infrastructure or agent/tool evidence. | Findings, hypotheses and a bounded next step. |
| **Guide an approved fix** | Review correction, mitigation or recurrence-detection options. | A plan with risks and recovery criteria; execution needs applicable approval. |
| **Validate recovery** | Compare original and post-change evidence after an actual change. | A verdict against agreed symptom and guardrail thresholds, with explicit limitations. |

Start at the stage your question needs. A known failed request can go directly
to investigation; a completed assessment doesn't need another health sweep.
The instructions carry confirmed scope, evidence and approvals across handoffs.

These are guided troubleshooting stages, not continuous detection or automatic
remediation.

## Get Started: Install or Migrate

In Copilot CLI:

1. Add the marketplace: `/plugin marketplace add microsoft/azure-skills`
2. Install this plugin: `/plugin install azure-observability@azure-skills`
3. Update it later with `/plugin update azure-observability@azure-skills`

Start a fresh conversation and try a question below. Keep Azure Skills enabled
for canonical diagnostics/Foundry expertise. Installation grants no telemetry
access or permission to query Azure.
Disable or remove older draft copies through supported plugin management
before enabling `azure-observability`; renamed packages do not update them.

## Start with your question

Enable the plugin in a supported Copilot host and start a fresh chat.

**An alert just fired**

```text
Investigate this alert that just fired on my app.
```

**Requests are slow**

```text
My web API has slow requests. Help me investigate the affected path and review fix options.
```

**An agent needs attention**

```text
Review the health of my agent and its dependencies, and prioritize the top issues by impact.
```

**Infrastructure is affecting the workload**

```text
Why is this cluster throwing OOMKill errors? Help me fix it.
```

**A tool call needs a closer look**

```text
Show me performance and usage insights for this tool call.
```

Share missing scope details when asked; you don't need skill names or query recipes.

### Bring evidence without connecting to Azure

Provide evidence with sensitive details removed and say:

```text
Use only this evidence. Do not query Azure, run scripts, install anything,
edit files, or save data.
```

Initial evidence review doesn't require Python, Azure Developer CLI (`azd`),
saved mappings, write permissions, or a new connection.

## Relevant capabilities, discovered when needed

The instructions guide Copilot to:

1. **Confirm the question**, affected target and evidence.
2. **Reuse available tools and connections.**
3. **Discover relevant specialists** in supported skill locations.
4. **Explain benefits and prerequisites** before proposing additional capabilities.
5. **Retain scope and approval limits** across handoffs.

For service-specific diagnostics, Copilot looks for the canonical
`azure-diagnostics` skill. For applicable AI-specific investigation, it looks
for `microsoft-foundry`. **The plugin does not ship duplicate copies of either.**
Copilot checks skills exposed by the host, including other enabled plugins,
and loads a relevant enabled specialist before choosing a core fallback.
Direct Monitor tools do not establish that Foundry instructions are absent.
If the host does not expose a specialist or a discovery mechanism, Copilot
reports availability as unverified in that session rather than uninstalled.

Azure Monitor is the operational foundation. Foundry is an optional AI-specific
branch, not a requirement for web/API or infrastructure troubleshooting.
Trace Store, an existing connected SRE Agent, and Azure Managed Grafana may be
considered when they address the question and are available.

For missing specialists, Copilot offers a supported host setup path or the
[Azure Skills installation guidance](https://github.com/microsoft/azure-skills#install-in-60-seconds).
Specialists are not installed automatically. Discovery, loading, access and execution
are separate checks. Declined setup still permits sufficient evidence-only
analysis; missing expertise remains explicit.

## What's included

| Core skill | Role |
|---|---|
| `connect-observability` | Confirm deployment context, telemetry associations and task-specific readiness. |
| `assess-observability-health` | Assess existing evidence, rank findings and identify coverage gaps. |
| `troubleshoot-observability` | Coordinate the next useful stage and retain bounded affected-path investigation guidance. |
| `verify-observability-fix` | Compare supplied original and post-change evidence after an effective approved change. |

Core skills are independently usable, subject to host discovery and loading support.

## What you need

| Path | Prerequisites |
|---|---|
| **Review supplied evidence** | A supported host and evidence with sensitive details removed. No Azure access required. |
| **Investigate live telemetry** | A deployed target, confirmed sources, authorized tools, task-specific access and an approved read plan. |
| **Use optional capabilities** | Available specialists/tools, their prerequisites, and applicable setup and execution approvals. |

## You stay in control

Copilot selects instructions; tools execute operations; you approve applicable
actions. Instructions aren't a security sandbox: retain host approvals and least privilege.

- Agree the target, source, UTC window and read limits before live access.
- Approve installation, sign-in, sensitive content, persistence, jobs, edits,
  alert changes and deployment separately when applicable.
- Reviewing a fix, PR proposal or SRE option doesn't authorize execution,
  evidence transfer or publication.
- Missing, stale or noncomparable required evidence yields **INCONCLUSIVE**.
  A successful deployment alone doesn't prove recovery.
- Optional dashboard, alert or later-check guidance follows the recovery verdict;
  it doesn't create automatic monitoring.

## When something is unavailable

| Situation | Next step |
|---|---|
| Guidance isn't loading | Confirm the plugin is enabled, check for duplicate installations, and start a fresh chat. Inspect load events if available. |
| A specialist or tool is missing | Ask for the missing prerequisite and supported setup path. Setup needs applicable approval. |
| Access is denied | Use the normal access process; don't switch identities or broaden permissions to bypass a denial. |
| Evidence is empty, stale or partial | Keep that limitation visible. Missing telemetry is not healthy and doesn't by itself prove missing instrumentation. |

Never share tokens, connection strings, sensitive prompts or unredacted telemetry.
Report issues with the host/version, expected behavior and a safe error description.

## License

This plugin is licensed under the [MIT License](LICENSE).

## Telemetry

The `track-telemetry` hook installs a pinned native `ghcfa-telem` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
`AZURE_MCP_COLLECT_TELEMETRY=false` in the environment of the process running
the agent.
