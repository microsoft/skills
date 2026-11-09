# Recipes

Validation recipes for different infrastructure approaches.

| Recipe | When to Use |
|--------|-------------|
| [AZD](azd/README.md) | Projects using Azure Developer CLI |
| [AZCLI](azcli/README.md) | Projects using Azure CLI scripts |
| [Bicep](bicep/README.md) | Projects using Bicep templates |
| [Terraform](terraform/README.md) | Projects using Terraform |

## Node.js Runtime Check (All Recipes)

Before provisioning or deployment, inspect the actual app configuration, including existing projects and downloaded templates. Every Node.js app must use a **supported GA LTS major >=22** for its target service, OS, and plan. Prefer **24** where supported; Azure Functions **Linux Consumption requires 22**, not 24.

Check all Docker build/runtime stages, Bicep `linuxFxVersion` and `functionAppConfig.runtime`, Terraform `node_version` and runtime blocks, `WEBSITE_NODE_DEFAULT_VERSION`, and production/staging slots. Resolve image tags and runtime parameters through their defaults, parameter files, and environment overrides; align `package.json` engines with the chosen major. Floating `node:lts` tags and the CI runner's Node version are not runtime evidence.

**Fail validation** for a major below 22, unsupported target/runtime combinations, mismatched build/runtime majors, or unresolved versions. Report each affected file/resource and remediation; obtain approval for existing-app major upgrades rather than silently changing them. Do not provision, deploy, or mark the plan `Validated` until resolved. Record the resolved versions, target support evidence, and compatibility/build results in **Section 7: Validation Proof**.
