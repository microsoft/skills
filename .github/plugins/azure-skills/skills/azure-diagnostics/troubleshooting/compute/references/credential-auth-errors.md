# Credential and Authentication Errors

Use when the VM is reachable but sign-in fails.

## Symptoms -> Solutions

| Symptom | OS | Action | Docs |
| --- | --- | --- | --- |
| credentials failed, must change password, account expired | Windows | Reset password; extend account if needed | [Reset RDP] |
| trust relationship failed | Windows | Reset machine account or rejoin domain | [RDP overview] |
| access denied, connection denied, wrong local/domain format | Windows | Add Remote Desktop Users; use `VMNAME\user` or `DOMAIN\user` | [RDP errors] |
| CredSSP encryption oracle | Windows | Temporary client workaround; patch both sides | [CredSSP] |
| permission denied publickey/password | Linux | Verify user/key/password auth; reset key/password if needed | [SSH detail] |
| locked account | Linux | Unlock via Run Command or Serial Console | [SSH overview] |
| Entra ID SSH denied | Linux | Assign VM Admin/User Login role | [SSH overview] |
| sudo prompt fails | Linux | Fix sudoers via Run Command or Serial Console | [SSH overview] |

## Quick Commands

> Commands use VM agent/extensions. Run [Pre-Flight Safety Checks](cannot-connect-to-vm.md#pre-flight-safety-checks) first.

```bash
# Windows password / RDP reset
az vm user update --name <vm> -g <rg> -u <user> -p '<new-password>'
az vm user reset-remote-desktop --name <vm> -g <rg>

# Linux key/password reset or unlock
az vm user update --name <vm> -g <rg> -u <user> --ssh-key-value "<ssh-public-key>"
az vm user update --name <vm> -g <rg> -u <user> -p '<new-password>'
az vm run-command invoke --name <vm> -g <rg> --command-id RunShellScript --scripts "passwd -u <user>"
```

[Reset RDP]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/reset-rdp
[RDP overview]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-rdp-connection
[RDP errors]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/troubleshoot-specific-rdp-errors
[CredSSP]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/credssp-encryption-oracle-remediation
[SSH detail]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/detailed-troubleshoot-ssh-connection
[SSH overview]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/troubleshoot-ssh-connection