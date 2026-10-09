# Investigation Report

**Date:** YYYY-MM-DDTHH:MM:SSZ
**Cluster:** <cluster-name> / <resource-group> / <subscription>
**Reported symptom:** <one-line symptom>

## What Was Inspected

| Resource | Command | Finding |
|----------|---------|---------|
| | | |

## Failure Domain

<workload | node | Kubernetes network | Azure network | control plane/Azure platform | identity/RBAC | quota/capacity>

## Root Cause

<concise root cause — one or two sentences>

**Confidence:** <high | medium | low> — <what would raise it, or the ranked alternatives if unresolved>

## Evidence

```
<relevant log snippet or command output>
```

## Fix

```bash
# command(s) to resolve
```

**Impact / rollback:** <what changes and how to revert; note IaC/GitOps source to update>

## Unavailable Evidence

- <read that was denied or not possible, identity, missing permission>

## Escalation

<none | Azure support with this report attached, and why Microsoft-side evidence is needed>

## Additional Findings

- (any secondary issues discovered during investigation)

## Prevention

- (optional: what would prevent recurrence — alert, config change, policy)
