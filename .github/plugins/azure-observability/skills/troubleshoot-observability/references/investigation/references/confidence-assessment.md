# Investigation confidence assessment

## Source precedence

1. Assess direct telemetry confidence as the coding agent and label it
   `caller-assessed`.
2. Preserve any external service's explicit confidence statement separately,
   naming its source and any caller disagreement.
3. Never present caller-assessed confidence as an external service claim.

## Caller rubric

- **High**: Direct telemetry proves the causal mechanism across every material
  boundary, the timing matches, and no material contrary evidence remains.
- **Medium**: The immediate failure mechanism is directly proven, but one
  downstream boundary or causal precursor remains inferred or unobserved.
- **Low**: Multiple plausible boundaries remain, required telemetry is missing,
  or the conclusion depends mainly on correlation rather than causal evidence.

Every caller assessment must include a short basis naming the strongest evidence
and the gaps that cap confidence. Intentional fixtures or design notes can
explain reproducibility but cannot raise confidence without matching runtime
evidence.
