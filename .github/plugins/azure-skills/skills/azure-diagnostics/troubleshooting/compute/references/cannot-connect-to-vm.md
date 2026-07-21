# Cannot Connect to VM

Router for Azure VM connectivity issues. Determine OS first: Windows usually means RDP/3389 and TermService; Linux means SSH/22 and sshd; other images usually use SSH but may need current docs.

## Routing

| Signal | Category | Reference |
| --- | --- | --- |
| can't RDP, timeout, black screen, internal error | RDP | [rdp-connectivity.md](rdp-connectivity.md) |
| can't SSH, refused, permission denied, publickey | SSH | [ssh-connectivity.md](ssh-connectivity.md) |
| NSG, public IP, NIC, routes, effective rules | Network | [network-connectivity.md](network-connectivity.md) |
| Windows Firewall, iptables, firewalld, UFW | Guest firewall | [firewall-blocking.md](firewall-blocking.md) |
| VM agent, Run Command timeout, Serial Console, boot diagnostics | VM agent/tools | [vm-agent-not-responding.md](vm-agent-not-responding.md) |
| password, credentials, access denied, CredSSP, account expired | Credential/auth | [credential-auth-errors.md](credential-auth-errors.md) |
| TermService, RDP disabled, changed port, TLS cert, NLA, licensing | RDP service/config | [rdp-service-config.md](rdp-service-config.md) |

## Workflow

1. Pick the symptom category and open the linked reference.
2. Match the user's symptom to a solution row and fetch current docs for that row.
3. Before extension-backed operations, run pre-flight checks.
4. Return evidence, likely cause, safe next command, remediation, and escalation.

## Pre-Flight Safety Checks

Run before `az vm user update`, `az vm user reset-ssh`, `az vm user reset-remote-desktop`, `az vm run-command invoke`, or any extension-backed operation.

```bash
az vm get-instance-view --name <vm> -g <rg> \
  --query "instanceView.{power:[statuses[?starts_with(code,'PowerState/')]][0][0].code,prov:[statuses[?starts_with(code,'ProvisioningState/')]][0][0].code,agent:vmAgent.statuses[0].displayStatus}" -o json
az vm extension list --vm-name <vm> -g <rg> \
  --query "[].{name:name,state:provisioningState}" -o table
```

| Check | Safe | Unsafe |
| --- | --- | --- |
| Power | `PowerState/running` | other, missing, or query error |
| Provisioning | `ProvisioningState/succeeded` | creating/updating/deleting/failed, missing, or query error |
| VM agent | `Ready` | not ready, null, missing, or query error |
| Extensions | all `Succeeded` or none | creating/updating/deleting/failed |

If unsafe: stop, name the failed check, and use non-agent options such as Serial Console, offline repair VM, or Portal actions. If transient, wait and rerun checks only.

## Escalation

Check Resource Health, then offer restart or redeploy only with user approval. For broad docs, use [Windows RDP], [Linux SSH], [Windows VM hub], or [Linux VM hub].

[Windows RDP]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-rdp-connection
[Linux SSH]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/troubleshoot-ssh-connection
[Windows VM hub]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/welcome-virtual-machines-windows
[Linux VM hub]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/welcome-virtual-machines-linux