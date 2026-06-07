---
name: azure-cli-patterns
description: >-
  Azure CLI best practices and common patterns for scripting, automation, and resource management.
  Use when writing az commands, building deployment scripts, automating Azure operations in CI/CD,
  or troubleshooting CLI issues. Triggers: "az command", "azure cli", "az group", "az vm",
  "az aks", "shell script azure", "az login", "az deployment", "az resource".
---

# Azure CLI Patterns

Best practices and reusable patterns for Azure CLI (`az`) scripting, automation, and resource management.

## Installation & Configuration

```bash
# Install (macOS)
brew install azure-cli

# Install (Linux)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Upgrade
az upgrade

# Set defaults to avoid repetitive flags
az configure --defaults group=myResourceGroup location=eastus
```

---

## Authentication Patterns

| Method | Use Case | Command |
|--------|----------|---------|
| **Interactive** | Local development, manual operations | `az login` |
| **Service Principal** | CI/CD pipelines, automation scripts | `az login --service-principal` |
| **Managed Identity** | Azure-hosted VMs, Container Apps, Functions | `az login --identity` |
| **Device Code** | Environments without browser | `az login --use-device-code` |

### Service Principal (CI/CD)

```bash
# Login with service principal (preferred for automation)
az login --service-principal \
  --username "$AZURE_CLIENT_ID" \
  --password "$AZURE_CLIENT_SECRET" \
  --tenant "$AZURE_TENANT_ID"

# Set subscription context
az account set --subscription "$AZURE_SUBSCRIPTION_ID"
```

### Managed Identity (Azure-hosted)

```bash
# System-assigned managed identity
az login --identity

# User-assigned managed identity
az login --identity --username "$MANAGED_IDENTITY_CLIENT_ID"
```

---

## Output & Query Patterns

### Output Formats

| Format | Use Case | Flag |
|--------|----------|------|
| `json` | Programmatic processing (default) | `--output json` |
| `table` | Human-readable display | `--output table` |
| `tsv` | Shell variable assignment, piping | `--output tsv` |
| `yaml` | Configuration files, readability | `--output yaml` |
| `none` | Suppress output (write operations) | `--output none` |

### JMESPath Queries (`--query`)

```bash
# Get single value
az vm show -g myRG -n myVM --query "powerState" --output tsv

# Get multiple fields
az vm list --query "[].{Name:name, Size:hardwareProfile.vmSize, State:powerState}" --output table

# Filter results
az vm list --query "[?powerState=='VM running'].name" --output tsv

# Nested access
az aks show -g myRG -n myAKS --query "agentPoolProfiles[0].count" --output tsv

# Array indexing
az account list --query "[0].id" --output tsv
```

---

## Resource Management Patterns

### Resource Group Lifecycle

```bash
# Create
az group create --name myRG --location eastus --tags env=dev team=platform

# List with filter
az group list --query "[?tags.env=='dev'].name" --output tsv

# Delete (with confirmation bypass for scripts)
az group delete --name myRG --yes --no-wait
```

### Common Resource Operations

```bash
# Create a Storage Account
az storage account create \
  --name mystorageacct \
  --resource-group myRG \
  --sku Standard_LRS \
  --kind StorageV2

# Create an AKS cluster
az aks create \
  --resource-group myRG \
  --name myAKS \
  --node-count 3 \
  --enable-managed-identity \
  --generate-ssh-keys

# Deploy a Web App
az webapp create \
  --resource-group myRG \
  --plan myPlan \
  --name myApp \
  --runtime "NODE:20-lts"

# Create Azure SQL
az sql server create \
  --resource-group myRG \
  --name mysqlserver \
  --admin-user azureuser \
  --admin-password "$SQL_ADMIN_PASSWORD"
```

### Batch Operations

```bash
# Delete all VMs in a resource group
az vm list -g myRG --query "[].id" --output tsv | xargs -I {} az vm delete --ids {} --yes --no-wait

# Tag all resources in a group
az resource list -g myRG --query "[].id" --output tsv | \
  xargs -I {} az resource tag --ids {} --tags env=production

# Stop all running VMs
az vm list -g myRG --query "[?powerState=='VM running'].id" --output tsv | \
  xargs -I {} az vm stop --ids {} --no-wait
```

---

## Scripting Best Practices

### Error Handling

```bash
#!/bin/bash
set -euo pipefail

# Trap errors for cleanup
cleanup() { echo "Cleaning up..."; }
trap cleanup EXIT

# Check command success explicitly
if ! az group show --name myRG &>/dev/null; then
  echo "Resource group does not exist, creating..."
  az group create --name myRG --location eastus --output none
fi
```

### Idempotent Scripts

```bash
# Pattern: create-if-not-exists
az group create --name myRG --location eastus --output none 2>/dev/null || true

# Pattern: check-then-create
if ! az storage account show --name mystorageacct --resource-group myRG &>/dev/null; then
  az storage account create \
    --name mystorageacct \
    --resource-group myRG \
    --sku Standard_LRS \
    --output none
fi

# Pattern: use --only-show-errors to suppress warnings on re-runs
az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role "Contributor" \
  --scope "/subscriptions/$SUB_ID" \
  --only-show-errors 2>/dev/null || true
```

### Variables & Parameterization

```bash
#!/bin/bash
set -euo pipefail

# Parameters at the top
RESOURCE_GROUP="${RESOURCE_GROUP:-myapp-rg}"
LOCATION="${LOCATION:-eastus}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
APP_NAME="myapp-${ENVIRONMENT}"

# Capture outputs for later use
STORAGE_KEY=$(az storage account keys list \
  --account-name "$STORAGE_ACCOUNT" \
  --query "[0].value" --output tsv)

PRINCIPAL_ID=$(az identity show \
  --name "$IDENTITY_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "principalId" --output tsv)
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Azure Login
  uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

- name: Deploy
  run: |
    az webapp deploy \
      --resource-group myRG \
      --name myApp \
      --src-path ./app.zip \
      --type zip
```

---

## Deployment Patterns

### ARM/Bicep Deployment via CLI

```bash
# Deploy Bicep template
az deployment group create \
  --resource-group myRG \
  --template-file main.bicep \
  --parameters environment=prod \
  --name "deploy-$(date +%Y%m%d-%H%M%S)"

# What-if (dry run)
az deployment group what-if \
  --resource-group myRG \
  --template-file main.bicep \
  --parameters environment=prod

# Subscription-level deployment
az deployment sub create \
  --location eastus \
  --template-file infra.bicep
```

### Wait for Long-Running Operations

```bash
# Create with --no-wait, then poll
az aks create --resource-group myRG --name myAKS --no-wait
az aks wait --resource-group myRG --name myAKS --created --timeout 600

# Wait for a specific state
az vm wait --resource-group myRG --name myVM --custom "powerState=='VM running'"
```

---

## Common Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Hardcoded subscription ID | Breaks across environments | Use `az account show --query id -o tsv` or env vars |
| `az login` in automated scripts | Requires interactive input, fails in CI | Use service principal or managed identity |
| No `--output tsv` when assigning vars | JSON wrapping breaks variable assignment | Always use `--output tsv` for shell vars |
| Full JSON output without `--query` | Wasteful, hard to parse, exposes secrets | Use `--query` to select only needed fields |
| Missing `set -euo pipefail` | Script continues after failures silently | Always set at script top |
| Using `--password` in plain text | Credential exposure in logs/history | Use env vars: `--password "$VAR"` |
| No `--no-wait` for batch operations | Sequential waits on independent resources | Add `--no-wait`, poll later if needed |
| Skipping `--yes` in delete commands | Script hangs waiting for confirmation | Use `--yes` for non-interactive deletes |

---

## Quick Reference

| Task | Command |
|------|---------|
| Login (interactive) | `az login` |
| Login (service principal) | `az login --service-principal -u $ID -p $SECRET --tenant $TENANT` |
| Set subscription | `az account set --subscription $SUB` |
| List resources | `az resource list -g myRG --output table` |
| Create resource group | `az group create -n myRG -l eastus` |
| Deploy template | `az deployment group create -g myRG --template-file main.bicep` |
| Get credentials (AKS) | `az aks get-credentials -g myRG -n myAKS` |
| Stream logs (App Service) | `az webapp log tail -g myRG -n myApp` |
| Open SSH (VM) | `az ssh vm -g myRG -n myVM` |
| Find command | `az find "create web app"` |
| Interactive mode | `az interactive` |

---

## Source

Content derived from [Azure CLI documentation](https://learn.microsoft.com/en-us/cli/azure/) — Microsoft's official command-line tool for managing Azure resources.
