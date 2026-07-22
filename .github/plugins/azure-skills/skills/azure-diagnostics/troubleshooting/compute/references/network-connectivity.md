# Network Connectivity Problems

Use when the VM is running but unreachable due to Azure network configuration: NSG, routing, NIC, public IP, or DNS.

## Symptoms -> Solutions

| Symptom | OS | Action | Docs |
| --- | --- | --- | --- |
| no NSG allow for RDP/SSH | Any | Add inbound TCP 3389/22 from approved source | [RDP NSG] |
| NIC and subnet NSGs conflict | Any | Traffic must pass both; inspect effective rules | [Traffic filter] |
| UDR sends traffic to NVA | Any | Check effective routes and NVA forwarding | [Routing] |
| no public IP | Any | Add public IP or use Bastion/private path | [Public IP] |
| guest NIC disabled/down | Windows/Linux | Enable NIC via Run Command or Serial Console | [RDP NIC] / [SSH overview] |
| static guest IP misconfig | Windows/Linux | Restore DHCP guest config | [Reset NIC] / [SSH overview] |
| ghost NIC after disk swap/resize | Windows | Reset network interface | [Reset NIC] |
| DNS failure | Any | Check DNS; Azure default is `168.63.129.16` | [DHCP] |

## Quick Commands

```bash
az network nic list-effective-nsg --name <nic> -g <rg>
az network nic show-effective-route-table --name <nic> -g <rg> -o table
az vm list-ip-addresses --name <vm> -g <rg> -o table
az network watcher test-connectivity --source-resource <vm-resource-id> \
  --dest-address <ip> --dest-port <port> -g <rg>
```

> Linux guest NIC commands use VM agent/extensions. Run [Pre-Flight Safety Checks](cannot-connect-to-vm.md#pre-flight-safety-checks) first.

```bash
az vm repair reset-nic --name <vm> -g <rg> --yes
az vm run-command invoke --name <vm> -g <rg> --command-id RunShellScript \
  --scripts "ip link show; ip addr show; ip link set eth0 up && dhclient eth0"
```

[RDP NSG]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-rdp-nsg-problem
[Traffic filter]: https://learn.microsoft.com/en-us/azure/network-watcher/diagnose-vm-network-traffic-filtering-problem
[Routing]: https://learn.microsoft.com/en-us/azure/network-watcher/diagnose-vm-network-routing-problem
[Public IP]: https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/public-ip-addresses
[RDP NIC]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-rdp-nic-disabled
[Reset NIC]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/reset-network-interface
[DHCP]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-rdp-dhcp-disabled
[SSH overview]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/troubleshoot-ssh-connection