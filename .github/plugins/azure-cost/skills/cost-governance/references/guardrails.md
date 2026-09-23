# Cost Guardrails

## Resolve Effective Scope

1. Resolve the hierarchy from management group through subscription and
   resource group. Include inherited policy assignments and identify the
   assignment scope, excluded scopes, exemptions, initiative, definition,
   parameters, and `enforcementMode`.
2. Use `generate_query`, `validate_query`, then `execute_query` for assignments
   and resource inventory. Use the Azure Policy API fallback when Resource Graph
   does not expose exemptions, compliance state, or definition details.
3. Report `Default` assignments as enforced only when the resource is in scope
   and not exempt. Report `DoNotEnforce` as audit-only. Distinguish deny, audit,
   modify, append, and deploy effects rather than claiming every assignment
   blocks deployment.

## Evaluate Coverage

4. For SKU and location controls, resolve the effective allowed or denied values
   after assignment parameters and exemptions. Mark a proposed resource as
   allowed, denied, audit-only, or unknown.
5. Query inventory for the organization's exact cost-allocation tag keys.
   Confirm casing and accepted values. Separate a missing tag, invalid value,
   inherited tag, and policy remediation that has not completed.
6. Call `list_budgets` at supported scopes. Build a coverage matrix showing
   which subscriptions or resource groups have enforced policy, compliant tags,
   and a budget. Do not treat a parent budget as a child budget unless its scope
   and filters actually cover that child.

## Report

Present the effective assignment, source scope, inheritance, exclusions,
exemptions, effect, parameters, compliance evidence, tag gaps, budget coverage,
affected resources, confidence, and owner action.

An empty Resource Graph result may reflect permissions or scope visibility.
State that uncertainty instead of claiming no guardrails exist.
