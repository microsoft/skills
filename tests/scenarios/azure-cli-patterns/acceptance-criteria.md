# Acceptance Criteria: azure-cli-patterns

**Skill**: `azure-cli-patterns`
**Purpose**: Produce correct, secure, and idempotent Azure CLI scripts following best practices
**Focus**: Authentication patterns, JMESPath queries, scripting idioms, error handling, CI/CD integration

---

## 1. Authentication Patterns

### 1.1 ✅ CORRECT: Service Principal for Automation

```bash
az login --service-principal \
  --username "$AZURE_CLIENT_ID" \
  --password "$AZURE_CLIENT_SECRET" \
  --tenant "$AZURE_TENANT_ID"

az account set --subscription "$AZURE_SUBSCRIPTION_ID"
```

### 1.2 ✅ CORRECT: Managed Identity for Azure-hosted Workloads

```bash
az login --identity
```

### 1.3 ❌ INCORRECT: Interactive Login in Automation Scripts

```bash
#!/bin/bash
# BAD: requires human interaction, fails in CI
az login
az group create --name myRG --location eastus
```

### 1.4 ❌ INCORRECT: Hardcoded Credentials

```bash
# BAD: credentials exposed in script
az login --service-principal \
  --username "a1b2c3d4-1234-5678-abcd-ef1234567890" \
  --password "MyS3cr3tP@ssw0rd!" \
  --tenant "my-tenant-id"
```

---

## 2. Output and Query Patterns

### 2.1 ✅ CORRECT: Using --query with --output tsv for Variable Assignment

```bash
STORAGE_KEY=$(az storage account keys list \
  --account-name mystorageacct \
  --query "[0].value" --output tsv)
```

### 2.2 ✅ CORRECT: Filtering with JMESPath

```bash
az vm list --query "[?powerState=='VM running'].{Name:name, RG:resourceGroup}" --output table
```

### 2.3 ❌ INCORRECT: Parsing Full JSON Output with External Tools

```bash
# BAD: fetches entire JSON, pipes through jq unnecessarily
STORAGE_KEY=$(az storage account keys list --account-name mystorageacct | jq -r '.[0].value')
```

### 2.4 ❌ INCORRECT: No Output Format for Variable Assignment

```bash
# BAD: captures JSON-wrapped string with quotes
VM_NAME=$(az vm show -g myRG -n myVM --query "name")
# Result: "myVM" (with quotes) instead of: myVM
```

---

## 3. Scripting Best Practices

### 3.1 ✅ CORRECT: Strict Error Handling

```bash
#!/bin/bash
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-myapp-rg}"
LOCATION="${LOCATION:-eastus}"

az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
```

### 3.2 ✅ CORRECT: Idempotent Resource Creation

```bash
if ! az storage account show --name mystorageacct --resource-group myRG &>/dev/null; then
  az storage account create \
    --name mystorageacct \
    --resource-group myRG \
    --sku Standard_LRS \
    --output none
fi
```

### 3.3 ❌ INCORRECT: No Error Handling

```bash
#!/bin/bash
# BAD: no set -e, failures ignored silently
az group create --name myRG --location eastus
az storage account create --name mystorageacct --resource-group myRG --sku Standard_LRS
az vm create --resource-group myRG --name myVM --image Ubuntu2204
```

### 3.4 ❌ INCORRECT: Hardcoded Subscription/Resource IDs

```bash
# BAD: breaks across environments
az account set --subscription "a1b2c3d4-1234-5678-abcd-ef1234567890"
az vm show --ids "/subscriptions/a1b2c3d4-1234-5678-abcd-ef1234567890/resourceGroups/myRG/providers/Microsoft.Compute/virtualMachines/myVM"
```

---

## 4. Resource Management

### 4.1 ✅ CORRECT: Parameterized Resource Creation with Tags

```bash
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --tags env="$ENVIRONMENT" team="$TEAM" managed-by=cli

az storage account create \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --output none
```

### 4.2 ✅ CORRECT: Batch Operations with --no-wait

```bash
az vm list -g myRG --query "[].id" --output tsv | \
  xargs -I {} az vm stop --ids {} --no-wait
```

### 4.3 ❌ INCORRECT: Sequential Blocking Operations on Independent Resources

```bash
# BAD: waits for each VM to stop before starting the next
for vm in vm1 vm2 vm3 vm4 vm5; do
  az vm stop --resource-group myRG --name "$vm"
done
```

---

## 5. Deployment Patterns

### 5.1 ✅ CORRECT: Bicep Deployment with What-If

```bash
az deployment group what-if \
  --resource-group myRG \
  --template-file main.bicep \
  --parameters environment=prod

az deployment group create \
  --resource-group myRG \
  --template-file main.bicep \
  --parameters environment=prod \
  --name "deploy-$(date +%Y%m%d-%H%M%S)"
```

### 5.2 ❌ INCORRECT: Deployment Without Naming

```bash
# BAD: no deployment name makes tracking/rollback impossible
az deployment group create --resource-group myRG --template-file main.bicep
```

---

## 6. Anti-Patterns Summary

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Interactive `az login` in scripts | CI failure | Service principal or managed identity |
| Hardcoded subscription ID | Env-specific breakage | Environment variables |
| No `--output tsv` for vars | Quoted JSON in shell vars | Always `--output tsv` |
| No `--query` filtering | Wasted bandwidth, secret exposure | JMESPath to select fields |
| Missing `set -euo pipefail` | Silent failures | Always set at script top |
| Plain-text credentials | Security breach | Env vars or Key Vault refs |
| Sequential blocking without `--no-wait` | Slow execution | `--no-wait` + `az wait` |
| Unnamed deployments | No audit trail | Always `--name` with timestamp |
