# Unable to SSH into the VM

Use for Linux VM SSH failures.

## Symptoms -> Solutions

| Symptom | Action | Docs |
| --- | --- | --- |
| connection refused on 22 | Check sshd running/listening and port config | [SSH overview] |
| connection timed out | Check power state, public IP, NSG, routes | [SSH overview] |
| permission denied publickey/password | Verify user, key, password auth; reset key/password | [SSH detail] |
| host key verification failed | Remove stale `known_hosts` entry | [SSH detail] |
| server closed connection | Check disk, PAM, sshd config | [SSH detail] |
| hangs with no response | Check firewall, routes, NIC | [SSH overview] |
| Debian-specific failure | Check Debian networking/sshd doc | [Debian] |
| Ubuntu: `sshd` unit not found, or `ssh.service` inactive | Expected on Ubuntu 24.04+ (socket-activated). Healthy = `ssh.socket` active and port 22 listening | [Ubuntu SSH] |
| SELinux blocks sshd (RHEL family) | Fix SELinux policy or temporarily permissive | [SELinux] |
| Entra ID SSH denied | Assign VM Admin/User Login role | [SSH overview] |
| VM not booting/UEFI failure | Use boot diagnostics and repair VM | [UEFI] |

## Quick Commands

> Commands use VM agent/extensions. Run [Pre-Flight Safety Checks](cannot-connect-to-vm.md#pre-flight-safety-checks) first.

```bash
az vm user reset-ssh --name <vm> -g <rg>
az vm user update --name <vm> -g <rg> -u <user> --ssh-key-value "<ssh-public-key>"
az vm user update --name <vm> -g <rg> -u <user> -p '<new-password>'
# Listener + service state. Unit is `sshd` on RHEL/SLES/Azure Linux, `ssh` on Debian/Ubuntu.
az vm run-command invoke --name <vm> -g <rg> --command-id RunShellScript \
  --scripts 'ss -tlnp | grep ":22 "; for u in sshd ssh ssh.socket; do echo "$u: $(systemctl is-active $u)"; done'
# SELinux distros only. Ubuntu/Debian use AppArmor and have no getenforce/setenforce.
az vm run-command invoke --name <vm> -g <rg> --command-id RunShellScript \
  --scripts 'if command -v getenforce >/dev/null; then getenforce; else echo "SELinux not installed"; fi'
# Temporary permissive mode, SELinux distros only (reverts on reboot)
az vm run-command invoke --name <vm> -g <rg> --command-id RunShellScript \
  --scripts 'if command -v setenforce >/dev/null; then setenforce 0; else echo "SELinux not installed"; fi'
```

[SSH overview]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/troubleshoot-ssh-connection
[SSH detail]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/detailed-troubleshoot-ssh-connection
[Debian]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/cannot-connect-debian-linux
[Ubuntu SSH]: https://documentation.ubuntu.com/release-notes/24.04/#openssh
[SELinux]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/linux-selinux-troubleshooting
[UEFI]: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/linux/azure-linux-vm-uefi-boot-failures