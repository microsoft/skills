# Optional GPU Day-2 Handoff

Use `airunway-aks-setup` for initial GPU node-pool, controller, provider, and
model setup. Consider the optional `aks-gpu-inference` skill only for a Day-2
incident affecting an existing AKS GPU or inference deployment.

1. Read the host-provided available-skill inventory, or use an approved
   read-only host capability query. Do not require a CLI on a skill-only remote
   host and do not infer availability from an `aks-` prefix.
2. If `aks-gpu-inference` is available, invoke it through the host-native skill
   mechanism.
3. If it is absent and would help, explain the focused GPU/inference diagnostic
   benefit and ask before installation. Use only the installation path
   supported by the current host after approval.
4. If installation is declined or unsupported, continue the base setup/error
   workflow and reason from supplied evidence. Do not claim that the optional
   skill ran.

Installation or invocation is not approval to mutate the cluster. Preserve the
separate confirmation gates for install, deployment, and remediation actions.
