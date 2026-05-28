# Post-Deployment Validation

Run after deployment succeeds. Steps 1-3 can run from anywhere (management plane). Steps 4-5 require VNet access.

## 1. Infrastructure Verification

### 1.1 Resource State

Verify all resources are in `Succeeded` state:

```bash
az deployment operation group list \
  --resource-group <rg> --name <deployment-name> \
  --query "[].{resource:properties.targetResource.resourceType,state:properties.provisioningState}" -o table
```

### 1.2 Private Endpoint Connections

Verify all PE connections are `Approved`:

```bash
az network private-endpoint list \
  --resource-group <rg> \
  --query "[].{name:name,status:privateLinkServiceConnections[0].privateLinkServiceConnectionState.status,resource:privateLinkServiceConnections[0].groupIds[0]}" -o table
```

### 1.3 Public Network Access Audit

Verify all resources have public access disabled:

```bash
az cognitiveservices account show --name <ai-account> --resource-group <rg> \
  --query "properties.publicNetworkAccess" -o tsv

az cosmosdb show --name <cosmos-account> --resource-group <rg> \
  --query "publicNetworkAccess" -o tsv

az storage account show --name <storage-account> --resource-group <rg> \
  --query "publicNetworkAccess" -o tsv

az search service show --name <search-service> --resource-group <rg> \
  --query "publicNetworkAccess" -o tsv
```

All should return `Disabled`.

> **T10 (Private Basic):** Steps 2-5 below do not apply — T10 has no agents, no capability host, and no BYO resources. Setup is complete after Step 1.

## 2. RBAC Role Assignment (no VNet required)

The template does not assign data-plane roles automatically.

Assign `Azure AI Developer` at the **account** scope (management-plane):

```bash
az role assignment create \
  --role "Azure AI Developer" \
  --assignee <your-object-id-or-email> \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<ai-account-name>
```

Assign `Foundry User` at the **project** scope (data-plane — required for `agents/read`, `agents/write`):

```bash
az role assignment create \
  --role "53ca6127-db72-4b80-b1b0-d745d6d5456d" \ # Foundry User
  --assignee <your-object-id-or-email> \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<ai-account-name>/projects/<project-name>
```

> ⚠️ RBAC propagation can take 1–5 minutes.

## 3. Deploy a Model (no VNet required)

```bash
az cognitiveservices account deployment create \
  --resource-group <rg> \
  --name <ai-account-name> \
  --deployment-name <deployment-name> \
  --model-name <modelName> \
  --model-version <modelVersion> \
  --model-format <format> \
  --sku-name GlobalStandard \
  --sku-capacity 50
```

Fall back to `Standard` SKU if `GlobalStandard` quota is exhausted.

---

## 4. VNet Access & End-to-End Test

For the remaining steps (VNet access setup, DNS resolution, agent lifecycle test, isolation proof, cleanup), read [end-to-end-test.md](end-to-end-test.md).
