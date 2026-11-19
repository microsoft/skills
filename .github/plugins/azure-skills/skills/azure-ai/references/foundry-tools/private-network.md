# Private networking for Document Intelligence and Content Understanding

For `403` network denials, timeouts, public DNS answers despite a private
endpoint, Studio pages that load but cannot call the resource, and
service-to-storage fetch failures. Building the network belongs to
`microsoft-foundry`.

## First decide the direction

| Direction | Typical symptom | Owner of the fix |
|---|---|---|
| Your client/app → DI or CU endpoint | `403`, timeout, public IP from `nslookup` | Resource network rules, private endpoint, DNS |
| Browser → Studio / Foundry portal → resource and Blob | Page loads, calls fail; status `0` or `403` in the browser Network tab | Network path of the browser machine; Blob CORS and firewall ([Studio and storage](storage-and-studio.md)) |
| DI or CU service → your Blob URL | `ContentSourceNotAccessible`, training cannot read data | Storage firewall, managed identity role, SAS; or send bytes instead of a URL |

## Facts to check against

- One private endpoint (subresource `account`) serves every host name of the
  resource. Create and link a private DNS zone for each host your workload uses:
  `privatelink.cognitiveservices.azure.com`, `privatelink.openai.azure.com`,
  `privatelink.services.ai.azure.com`. Learn samples call DI and CU through both
  `<name>.cognitiveservices.azure.com` and `<name>.services.ai.azure.com`, so a
  missing zone breaks only the host that depends on it.
- Private endpoint calls need the custom subdomain endpoint; custom DNS
  servers must forward the `privatelink` zones to `168.63.129.16`.
- `publicNetworkAccess: Disabled` accepts private endpoint traffic only.
  `Enabled` with `networkAcls.defaultAction: Deny` allows only listed IP and
  virtual network rules; enabling rules also blocks Azure services and portal
  calls that are not listed.
- IP rules: public IPv4 only, up to 100, no `/31` or `/32` prefixes (add single
  addresses), no private ranges. The address that counts is the public egress
  (NAT, proxy, firewall), not the client's private IP.
- Virtual network rules need the custom subdomain and the
  `Microsoft.CognitiveServices` service endpoint on the subnet; traffic from that
  subnet then arrives with a private source, so existing IP rules stop matching it.
- Learn documents the trusted-services bypass for Azure OpenAI only; do not
  promise it for DI or CU calls.
- Data loss prevention (`restrictOutboundNetworkAccess: true` plus
  `allowedFqdnList`, up to 15 minutes to apply) limits which hosts the service
  may fetch URL sources from; Learn lists DI, not CU.
- Studio from a private network: DI Studio needs the browser to reach the DI
  resource and the storage account (or the documented Studio IP for auto
  label). For CU Studio and the Foundry portal allow outbound service tags
  `AzureActiveDirectory`, `AzureFrontDoor.Frontend`, `AzureResourceManager`,
  `CognitiveServicesManagement` and `CognitiveServicesFrontEnd` (Learn lists
  them for the Foundry portal only). With public access disabled, use VPN,
  ExpressRoute or Bastion.

## Workflow

1. Export the account (Azure MCP has no network tools; `foundryextensions_resource_get`
   lacks network fields): `az cognitiveservices account show -n <name> -g <rg> -o json > account.json`.
2. On the affected client (not your workstation, unless that is the client),
   run the [network checker](../../scripts/check-foundry-tools-network.mjs)
   ([Bash](../../scripts/check-foundry-tools-network.sh) / [PowerShell](../../scripts/check-foundry-tools-network.ps1);
   without Node see [manual checks](without-node.md)):

   ```bash
   node "<skill-directory>/scripts/check-foundry-tools-network.mjs" --account account.json --resolve --connect --client-ip <public-egress-ip>
   ```

   ```powershell
   & node "<skill-directory>\scripts\check-foundry-tools-network.mjs" --account account.json --resolve --connect --client-ip <public-egress-ip>
   ```

   Launcher exit codes are `0` report/help, `1` file/read/JSON error, `2`
   usage error and `3` Node.js 22+ unavailable. The checker reads UTF-8,
   UTF-8-with-BOM and UTF-16 PowerShell 5.1 exports.

   `--resolve` labels each host `private`, `public` or `not_found`; `--connect`
   stops at a TLS handshake (no HTTP, no credentials). No IPs or host names
   are printed.
   `--client-ip` only compares a public egress rule; it does not prove which
   route the failing request used. With public access disabled, trust the
   private DNS and TLS results for the affected client.
3. Read-only follow-ups: `az network private-endpoint-connection list --id <resource-id>`,
   `az network private-dns zone list`, `az network private-dns link vnet list -g <rg> -z <zone>`,
   `az network private-endpoint dns-zone-group list --endpoint-name <pe> -g <rg>`.
4. Propose rule, DNS or endpoint changes as a plan; apply only after the user
   confirms. Do not open storage or the resource to the internet as a test.

## Evidence boundary

Configured state does not prove the path a request took. A host that resolves
privately on one machine can resolve publicly from the app's subnet, a proxy
or a browser with secure DNS. `allowed` RBAC plus `403` points to the network;
`401` points to authentication ([access and roles](access-and-roles.md)).

Sources (retrieved 2026-11-18): [Private endpoint DNS values](https://learn.microsoft.com/azure/private-link/private-endpoint-dns) ·
[Configure virtual networks for Foundry Tools](https://learn.microsoft.com/azure/ai-services/cognitive-services-virtual-networks) ·
[Foundry private link](https://learn.microsoft.com/azure/foundry/how-to/configure-private-link) ·
[CU security](https://learn.microsoft.com/azure/ai-services/content-understanding/concepts/secure-communications) ·
[DI secured access](https://learn.microsoft.com/azure/ai-services/document-intelligence/authentication/managed-identities-secured-access?view=doc-intel-4.0.0) ·
[Data loss prevention](https://learn.microsoft.com/azure/ai-services/cognitive-services-data-loss-prevention) ·
[VNet service endpoints](https://learn.microsoft.com/azure/virtual-network/virtual-network-service-endpoints-overview)
