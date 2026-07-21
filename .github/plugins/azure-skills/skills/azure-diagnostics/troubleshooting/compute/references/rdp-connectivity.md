# Unable to RDP into the VM

Use for Windows VM RDP timeouts, refused connections, black screen, or RDP error dialogs.

## Symptoms -> Solutions

| Symptom | Action | Docs |
| --- | --- | --- |
| timeout/no response | Check power state, public IP, NSG allow for 3389 | [RDP NSG] |
| timeout with NSG OK | Check guest firewall | [Guest firewall] |
| credentials failed | Reset password or username format | [RDP errors] |
| internal/security/authentication error | Check TLS, NLA, CredSSP, certificate, clock skew | [Internal] / [General] |
| black screen after login | Check Explorer, GPU driver, GPO, session state | [Detailed] |
| license server unavailable | Fix or remove RDS licensing role | [RDP errors] |
| cannot find computer | Check public IP, DNS, and VM allocation | [RDP errors] |
| connects then disconnects | Check session limits, idle timeout, resources | [RDP overview] |
| works from some IPs | Check NSG source restriction | [RDP NSG] |
| Event IDs in logs | Match event ID to documented cause | [Event IDs] |
| guest NIC disabled | Enable NIC via safe command path | [RDP NIC] |

## Quick Commands

> Commands marked by reset/update use VM agent/extensions. Run [Pre-Flight Safety Checks](cannot-connect-to-vm.md#pre-flight-safety-checks) first.

```bash
az vm get-instance-view --name <vm> -g <rg> --query "instanceView.statuses" -o table
az network nsg rule list --nsg-name <nsg> -g <rg> -o table
az network watcher test-ip-flow --direction Inbound --protocol TCP \
  --local <vm-private-ip>:3389 --remote <your-public-ip>:* --vm <vm> -g <rg>
az vm user reset-remote-desktop --name <vm> -g <rg>
az vm user update --name <vm> -g <rg> -u <user> -p '<new-password>'
```

[RDP NSG]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-rdp-nsg-problem
[Guest firewall]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/guest-os-firewall-blocking-inbound-traffic
[RDP errors]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-specific-rdp-errors
[Internal]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-rdp-internal-error
[General]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-rdp-general-error
[Detailed]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/detailed-troubleshoot-rdp
[RDP overview]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-rdp-connection
[Event IDs]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/event-id-troubleshoot-vm-rdp-connecton
[RDP NIC]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-rdp-nic-disabled