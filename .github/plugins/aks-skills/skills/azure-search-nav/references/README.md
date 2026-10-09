# Invoke-PortalSearchNav.ps1 — Reference

## Authentication and Data Flow

The `azurefd.net` endpoint this script calls fronts the **PCNX Copilot
Infrastructure** service, owned by the **Azure Kubernetes Service (AKS) team**.
It receives the signed-in user's ARM-audience (`https://management.azure.com/`)
bearer token as the `Authorization` header, along with an `App-Tenant-Id`
header derived from that token. This is the same authentication pattern Azure
Copilot's in-portal search-and-navigation experience already uses against this
service.

## Prerequisites

```powershell
Install-Module Az.Accounts -Scope CurrentUser
```

## Usage

```powershell
./references/Invoke-PortalSearchNav.ps1 `
  -ResourceUrl 'https://portal.azure.com/#@<tenant>/resource/subscriptions/<subscription-id>/resourceGroups/<rg>/providers/Microsoft.ContainerService/managedClusters/<cluster>/overview' `
  -Query 'image cleaner'
```

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `-ResourceUrl` | Yes | — | Portal URL or bare ARM resource ID |
| `-Query` | Yes | — | Natural-language search query |
| `-ArmProvider` | No | auto-derived | Override the `armProvider` filter value |
| `-AppTenantId` | No | auto-derived | Override the `App-Tenant-Id` header; also used to build the `#@<tenant>` portal link fragment |
| `-Locale` | No | `en.en-us` | Locale for the search filter |
| `-UseDeviceAuthentication` | No | `$false` | Use device-code authentication when a browser window cannot be opened |
| `-Raw` | No | `$false` | Print raw JSON response only |

## How It Works

1. **Parse** — Extracts the ARM resource ID, subscription, provider, and tenant from `-ResourceUrl`.
2. **Validate** — Looks up the resource type in `resource-types.json` to normalise `armProvider` casing and confirm the type is supported.
3. **Authenticate** — Calls `Connect-AzAccount` (browser sign-in, or device-code with `-UseDeviceAuthentication`), scoped to the resource's subscription, then `Get-AzAccessToken`. The token's `tid` claim is used as the `App-Tenant-Id` header.
4. **Search** — POSTs to the `aks-search-direct-mid` endpoint:
   ```json
   {
     "search": "<query>",
     "count": "true",
     "filter": "armProvider eq '<armProvider>' and locale eq '<locale>'",
     "queryType": "semantic",
     "semanticConfiguration": "semantic"
   }
   ```
   Headers: `Accept`, `User-Data-Boundary: Global`, `Authorization`, `App-Tenant-Id`.
5. **Extract** — Recursively scans the response for `menuId` / `bladeName` / `blade` properties.
6. **Build link** — Rebuilds the link against `https://portal.azure.com`, appending each discovered `menuId` as the trailing blade segment.

## Enabled Resource Types

The search service is enabled for these ARM resource types:

### Microsoft.ContainerService

- `aiManagers`
- `containerServices`
- `deploymentSafeguards`
- `fleets`
- `maintenanceWindows`
- `managedClusters`
- `managedclustersnapshots`
- `nodeCustomizations`
- `openShiftManagedClusters`
- `preparedImageSpecifications`
- `snapshots`

### Microsoft.Kubernetes

- `connectedClusters`

### Microsoft.Compute

- `availabilitySets`
- `capacityReservationGroups`
- `cloudServices`
- `diskAccesses`
- `diskEncryptionSets`
- `disks`
- `galleries`
- `hostGroups`
- `images`
- `interconnectBlocks`
- `proximityPlacementGroups`
- `restorePointCollections`
- `snapshots`
- `sshPublicKeys`
- `virtualMachines`
- `virtualMachineScaleSets`

## Enabling a New Resource Type

Add an entry to `resource-types.json`:

```json
{
  "microsoft.network/virtualnetworks": {
    "armProvider": "Microsoft.Network/virtualNetworks",
    "extension": "Microsoft_Azure_Network"
  }
}
```

The key must be all-lowercase. `armProvider` must use the exact casing expected by the search index.
Only add types enabled by the search service.
