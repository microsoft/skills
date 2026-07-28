---
name: azure-validate
description: "Pre-deployment validation for Azure readiness. Run deep checks on configuration, infrastructure (Bicep or Terraform), RBAC role assignments, managed identity permissions, and prerequisites before deploying. WHEN: validate my app, check deployment readiness, run preflight checks, verify configuration, check if ready to deploy, validate azure.yaml, validate Bicep, test before deploying, troubleshoot deployment errors, validate Azure Functions, validate function app, validate serverless deployment, verify RBAC roles, check role assignments, review managed identity permissions, what-if analysis, validate Container Apps deployment."
license: MIT
metadata:
  author: Microsoft
  version: "1.1.1"
---

# Azure Validate

> **AUTHORITATIVE GUIDANCE** — Follow these instructions exactly unless they contradict security policies given to you.

> **⛔ STOP — PREREQUISITE CHECK REQUIRED**
>
> Before proceeding, verify this prerequisite is met:
>
> **azure-prepare** was invoked and completed → `.azure/deployment-plan.md` exists with status `Approved` or later
>
> If the plan is missing, **STOP IMMEDIATELY** and invoke **azure-prepare** first.
>
> The complete workflow ensures success:
>
> `azure-prepare` → `azure-validate` → `azure-deploy`

## Triggers

- Check if app is ready to deploy
- Validate azure.yaml or Bicep
- Run preflight checks
- Troubleshoot deployment errors

## Rules

1. Run after azure-prepare, before azure-deploy
2. All checks must pass—do not deploy with failures
3. ⛔ **Destructive actions require `ask_user`** — [global-rules](references/global-rules.md)

## Steps

| # | Action | Reference |
|---|--------|-----------|
| 1 | **Load Plan** — Read `.azure/deployment-plan.md` for recipe and configuration. If missing → run azure-prepare first | `.azure/deployment-plan.md` |
| 2 | **Add Validation Steps** — Copy recipe "Validation Steps" to `.azure/deployment-plan.md` as children of "All validation checks pass" | [recipes/README.md](references/recipes/README.md), `.azure/deployment-plan.md` |
| 3 | **Run Validation** — Execute recipe-specific validation commands | [recipes/README.md](references/recipes/README.md) |
| 4 | **Build Verification** — Build the project and fix any errors before proceeding | See recipe |
| 5 | **Static Role Verification** — Review Bicep/Terraform for correct RBAC role assignments in code | [role-verification.md](references/role-verification.md) |
| 6 | **Record Proof** — Populate **Section 7: Validation Proof** with commands run and results | `.azure/deployment-plan.md` |
| 7 | **Resolve Errors** — Fix failures before proceeding | See recipe's `errors.md` |
| 8 | **Update Status** — Only after ALL checks pass, set status to `Validated` | `.azure/deployment-plan.md` |
| 9 | **Deploy (only if the user asked to deploy)** — If the user explicitly requested deployment, invoke **azure-deploy**. Otherwise STOP and report validation results | — |
> **⛔ VALIDATION AUTHORITY**
>
> This skill is the officially verified way to set plan status to `Validated`. You MUST follow these steps to make sure every prerequisite is fulfilled before setting status to `Validated`:
> 1. Run actual validation commands (azd provision --preview, bicep build, terraform validate, etc.)
> 2. Populate **Section 7: Validation Proof** with the commands you ran and their results
> 3. Only then set status to `Validated`
>
> Do NOT set status to `Validated` without running checks and recording proof.

---

> **⚠️ NEXT STEP — DEPENDS ON USER INTENT**
>
> After ALL validations pass, check whether the user asked to deploy:
> - **If the user explicitly requested deployment**, you **MUST** invoke **azure-deploy** to execute it. Do NOT run `azd up`, `azd deploy`, or any deployment commands directly — let azure-deploy handle execution.
> - **If the user only asked to validate or prepare** (not deploy), STOP after recording proof and setting status to `Validated`. Report the validation results and do NOT invoke azure-deploy.
>
> If any validation failed, fix the issues and re-run azure-validate before proceeding.
