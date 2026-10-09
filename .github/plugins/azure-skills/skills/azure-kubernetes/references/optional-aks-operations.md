# Optional AKS Operations Add-on

The base Azure plugin owns AKS recommendation, Day-0 planning, cluster setup,
application deployment, readiness, and basic operations. The sibling
`aks-skills` plugin is optional and contains focused, deeper operational
workflows.

## Capability and consent flow

1. Check the host-provided available-skill inventory. An approved read-only
   native capability query, including a host-supported CLI query where
   available, may be used instead. Do not require a CLI on skill-only remote
   hosts and do not guess availability from an `aks-` name prefix.
2. If the focused skill is available, invoke it through the host's native skill
   capability. Do not install or load every AKS operational skill.
3. If it is missing and useful, explain the task-specific benefit and ask for
   consent before installation. After approval, use the host-supported plugin
   manager or installation path. Do not invent a host-specific command or
   bypass host policy. After installation, confirm the selected skill appears
   in the host's available-skill inventory before invoking it. If the host
   activates newly installed components only in a new session or after a
   restart, say so, continue the base workflow now, and report the focused
   skill as installed but not yet active rather than used.
4. If the customer declines, or the host cannot install or execute the add-on,
   continue the base workflow with available Azure/Kubernetes reads or supplied
   evidence. Do not dead-end or imply that optional execution occurred.

Installation consent does not approve resource mutation, packet capture, or
other execution. Apply each focused skill's own approval gates separately.

## Focused routing

| Skill | Use only when |
|-------|---------------|
| `aks-troubleshooting` | The customer has a live AKS incident in any scope, including workload crashes, node, networking, ingress, upgrade, or scaling problems, that benefits from deeper target-bound investigation. An application-level cause does not exclude an AKS workload incident. |
| `aks-known-issues` | The supplied or retrieved failure includes an exact, fully qualified catalog signature. A quota error, unqualified capacity symptom, or incomplete wrapper is not enough; an exact fully qualified catalog capacity signature remains eligible. |
| `aks-network-capture` | The customer explicitly requests and separately approves a packet capture (`pcap`) workflow. Generic connectivity troubleshooting stays in baseline diagnostics. |
| `aks-gpu-inference` | An existing AKS GPU or inference deployment has a Day-2 incident. Initial GPU cluster, provider, or model setup stays with the base setup workflow. |
