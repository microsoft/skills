# Foundry Tools access and network checks without Node.js

Use when Node.js 22+ is unavailable and the user declines installing it. These
read-only commands print role names, booleans, counts and labels, never keys,
tokens, IP addresses, IDs or document content. Replace `<...>` placeholders.
PowerShell lines work in Windows PowerShell 5.1 and PowerShell 7 with the Az
modules; `az` lines need Azure CLI and `az login`.

## Roles of the caller

1. Role names and where they apply (project scope does not authorize DI or CU):

   ```bash
   az role assignment list --all --include-inherited --include-groups --assignee "<caller>" --query "[].{role:roleDefinitionName, projectScope:contains(scope, '/projects/')}" -o table
   ```

   ```powershell
   Get-AzRoleAssignment -ObjectId "<caller-object-id>" -ExpandPrincipalGroups | Select-Object RoleDefinitionName, @{n='ProjectScope';e={$_.Scope -match '/projects/'}}
   ```

   `projectScope: True` rows do not authorize DI or CU. For the other rows,
   confirm the scope is this resource, its resource group or its subscription
   (`az role assignment list ... --query "[].scope"` shows it; do not paste it).

2. Data actions of a role (empty means it cannot call DI or CU with Entra ID):

   ```bash
   az role definition list --name "<role name>" --query "[].permissions[].dataActions" -o json
   ```

   ```powershell
   (Get-AzRoleDefinition -Name "<role name>").DataActions
   ```

## Account auth and network settings

```bash
az cognitiveservices account show -n "<name>" -g "<rg>" --query "{kind:kind, customSubdomain:properties.customSubDomainName != \`null\`, disableLocalAuth:properties.disableLocalAuth, publicNetworkAccess:properties.publicNetworkAccess, defaultAction:properties.networkAcls.defaultAction, ipRules:length(properties.networkAcls.ipRules || \`[]\`), vnetRules:length(properties.networkAcls.virtualNetworkRules || \`[]\`), privateEndpoints:properties.privateEndpointConnections[].properties.privateLinkServiceConnectionState.status}" -o json
```

```powershell
$account = az cognitiveservices account show -n "<name>" -g "<rg>" -o json | ConvertFrom-Json
[pscustomobject]@{
  kind = $account.kind
  customSubdomain = -not [string]::IsNullOrWhiteSpace($account.properties.customSubDomainName)
  disableLocalAuth = $account.properties.disableLocalAuth
  publicNetworkAccess = $account.properties.publicNetworkAccess
  defaultAction = $account.properties.networkAcls.defaultAction
  ipRules = @($account.properties.networkAcls.ipRules).Count
  vnetRules = @($account.properties.networkAcls.virtualNetworkRules).Count
  privateEndpoints = @($account.properties.privateEndpointConnections | ForEach-Object { $_.properties.privateLinkServiceConnectionState.status })
}
```

`disableLocalAuth: true` means keys are rejected. `publicNetworkAccess: Disabled`
with no `Approved` private endpoint means no client can reach the data plane.

## DNS from the affected client

Run on the machine or subnet that makes the failing call. Each line prints
`private` or `public` per resolved address:

```bash
for s in cognitiveservices.azure.com openai.azure.com services.ai.azure.com; do echo "$s:"; nslookup "<subdomain>.$s" 2>/dev/null | awk '/^Name:/{seen=1} seen && /^Address: /{print $2}' | while read -r ip; do case "$ip" in 10.*|192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*) echo private;; *) echo public;; esac; done; done
```

```powershell
foreach ($s in 'cognitiveservices.azure.com','openai.azure.com','services.ai.azure.com') { "${s}:"; try { Resolve-DnsName "<subdomain>.$s" -Type A -ErrorAction Stop | Where-Object { $_.IPAddress } | ForEach-Object { if ($_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)') { 'private' } else { 'public' } } } catch { 'not_resolved' } }
```

`public` for a host while the account has an approved private endpoint points
to a missing `privatelink` zone, VNet link or DNS forwarder for that host.

## Browser traces

There is no safe manual HAR redaction. Do not share the raw HAR. In the
developer tools Network tab, copy only status, `x-ms-error-code`, request-ID
response headers and the API version of the failing requests.
