# Networking

Never enable public access to bypass a private-path failure. Validate DNS and connectivity from the actual execution environment. Inbound private endpoint and outbound shared private link states must reach `Approved`/`Succeeded`; pending customer approval is not success.

## Inbound private endpoint and DNS creation surface

The network provider creates `Microsoft.Network/privateEndpoints`, not Search.
Verify Network Contributor or equivalent on the endpoint resource group,
subnet join, DNS-zone write and runtime-VNet link authority independently;
Search roles do not grant them. Use the approved region/subnet, existing
compatible zone/link first, and confirm subnet policies before any approved
change. Never alter a shared subnet implicitly. Network API scope is independent
of Search's resolved versions.

These complete CLI invocations create only missing, approved resources:

```text
az network private-endpoint create --resource-group "<endpoint-rg>" --name "<endpoint-name>" --location "<region>" --subnet "<subnet-resource-id>" --connection-name "<connection-name>" --private-connection-resource-id "<search-resource-id>" --group-ids searchService
az network private-dns zone create --resource-group "<dns-rg>" --name privatelink.search.windows.net
az network private-dns link vnet create --resource-group "<dns-rg>" --name "<link-name>" --zone-name privatelink.search.windows.net --virtual-network "<actual-runtime-vnet-id>" --registration-enabled false
az network private-endpoint dns-zone-group create --resource-group "<endpoint-rg>" --endpoint-name "<endpoint-name>" --name "<zone-group-name>" --private-dns-zone "<private-dns-zone-resource-id>" --zone-name privatelink.search.windows.net
```

The Search connection targets `groupIds: ["searchService"]`. Search only
approves it through `PrivateEndpointConnections_Update`. Retain IDs/ownership,
read back the endpoint/zone/group/link, and prove the Search hostname resolves
to its private IP from the actual runtime, including custom-DNS forwarding.
Missing network authority means an exact scoped owner handoff and pending state,
not success. Restore only approved owned changes; shared links may have consumers.

## Search roles-only cutover

After the private managed-identity canary, `Services_Update` PATCHes
`{"properties":{"publicNetworkAccess":"disabled"}}`; read back and replay.
Then PATCH `{"properties":{"disableLocalAuth":true}}` **without** `authOptions`:
the documented roles-only request clears it. Never send `aadOrApiKey` together
with `disableLocalAuth:true`. Require readback `disableLocalAuth:true`,
`authOptions:null`, and a new actual-runtime managed-identity canary.
Preserve prior settings for separately approved rollback, never automatic
public/key fallback.

Sources: [Private endpoints](https://learn.microsoft.com/azure/search/service-create-private-endpoint),
[roles-only REST requests](https://learn.microsoft.com/azure/search/search-security-enable-roles).
