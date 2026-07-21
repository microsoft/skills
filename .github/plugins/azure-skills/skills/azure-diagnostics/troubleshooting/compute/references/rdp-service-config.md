# RDP Service and Configuration Issues

VM is reachable but the RDP service itself is broken or misconfigured.

## Symptoms → Solutions

| Symptom                                | Solution                                                               | Documentation                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| TermService not running                | Start the service and set to Automatic                                 | [Reset RDP service](https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/reset-rdp)                                     |
| RDP port changed from 3389             | Reset port or update NSG to allow the custom port                      | [Detailed RDP troubleshooting](https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/detailed-troubleshoot-rdp)          |
| RDP disabled (fDenyTSConnections = 1)  | Reset RDP config via CLI or Portal                                     | [Reset RDP service](https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/reset-rdp)                                     |
| TLS/SSL certificate expired or corrupt | Delete cert and restart TermService to regenerate                      | [RDP internal error](https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-rdp-internal-error)              |
| NLA/Security Layer mismatch            | Temporarily disable NLA for recovery                                   | [RDP general error](https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-rdp-general-error)                |
| GPO overriding local RDP settings      | Check `HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services` | [Detailed RDP troubleshooting](https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/detailed-troubleshoot-rdp)          |
| RDS licensing expired                  | Remove RDSH role or configure license server                           | [Specific RDP errors](https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-specific-rdp-errors#rdplicense) |

## Quick Commands

> ⚠️ **Warning:** Commands marked with ⚡ use the VM agent/extensions. Run [Pre-Flight Safety Checks](cannot-connect-to-vm.md#pre-flight-safety-checks) before using them.

```bash
# ⚡ Reset all RDP configuration to defaults
az vm user reset-remote-desktop --name <vm-name> -g <resource-group>

# ⚡ Check TermService status via Run Command
az vm run-command invoke --name <vm-name> -g <resource-group> \
  --command-id RunPowerShellScript --scripts "Get-Service TermService | Select-Object Status, StartType"

# Restart VM (if RDP service is unrecoverable — requires user approval)
az vm restart --name <vm-name> -g <resource-group>

# Redeploy VM (moves to new host — last resort, requires user approval)
az vm redeploy --name <vm-name> -g <resource-group>
```