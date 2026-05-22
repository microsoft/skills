# Inspektor Gadget (IG) Reference

Use Inspektor Gadget for real-time, low-level node/pod diagnostics when `kubectl` is insufficient.

## IG Version

`<ig-version>` = `v0.51.0` — substitute this exact tag (with `v` prefix) wherever `<ig-version>` appears. Bump this line only.

## Base Command Pattern

```bash
kubectl debug --profile=sysadmin node/<node-name> --attach --quiet \
  --image=mcr.microsoft.com/oss/v2/inspektor-gadget/ig:<ig-version> \
  -- ig run <gadget>:<ig-version> -o json --timeout <seconds> [filters...]
```

Always set `--timeout` after `--` to cap runtime. Use `--timeout 5` for snapshot/top, `--timeout 30` for trace/profile.

> **Note:** IG uses `kubectl debug --profile=sysadmin` (privileged debug pod). Only run with explicit user approval and appropriate RBAC.

**Required:** Resolve the node name first:

```bash
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.spec.nodeName}'
```

## Common Filters

| Filter | Description |
|---|---|
| `--k8s-namespace <ns>` | Scope to a Kubernetes namespace |
| `--k8s-podname <pod>` | Scope to a specific pod |
| `--k8s-containername <ctr>` | Scope to a specific container |
| `--timeout <seconds>` | Cap streaming duration for trace/profile gadgets |
| `--max-entries <n>` | Max entries per batch for top/profile gadgets |
| `--map-fetch-interval <dur>` | Map fetch interval for top (except `top_process`) and profile gadgets (default `1000ms`) |
| `--interval <dur>` | Reporting interval for `top_process` only (e.g. `5s`) |
| `--syscall-filters <list>` | Comma-separated syscalls for `traceloop` (e.g. `open,connect,accept`). **Always specify** to limit data volume |

> **Tip:** For top/profile, set `--map-fetch-interval` ≤ half of `--timeout` to collect at least one batch. E.g. `--timeout 2 --map-fetch-interval 1000ms --max-entries 20`.
>
> **Note:** `top_process` uses `--interval` instead of `--map-fetch-interval`. E.g. `--timeout 10 --interval 5s --max-entries 20`.

## Gadget Catalog

### Networking

| Gadget | Type | What It Does | When To Use |
|---|---|---|---|
| `trace_dns` | trace | Trace DNS queries and responses with latency | DNS failures, NXDOMAIN, SERVFAIL, slow resolution, intermittent DNS |
| `trace_tcp` | trace | Trace TCP connect/accept/close events | Connection refused, timeouts, unexpected drops, mapping pod connectivity |
| `trace_tcpretrans` | trace | Trace TCP retransmissions | Network congestion, lossy links, high latency between pods/services |
| `trace_bind` | trace | Trace socket bind calls | Port conflicts, address-already-in-use errors |
| `trace_sni` | trace | Trace TLS SNI (Server Name Indication) values | HTTPS routing issues, ingress TLS debugging, mTLS problems |
| `snapshot_socket` | snapshot | List open sockets (TCP/UDP/Unix) | Port conflicts, listening ports, connection leaks, ECONNREFUSED |
| `tcpdump` | special | Capture raw packets in pcap-ng format | Deep packet inspection, protocol-level debugging, reproducing network issues |

#### tcpdump gadget

Outputs raw pcap-ng data. Pipe to `tcpdump` for readable output:

```bash
kubectl debug --profile=sysadmin node/<node-name> --attach --quiet \
  --image=mcr.microsoft.com/oss/v2/inspektor-gadget/ig:<ig-version> \
  -- ig run tcpdump:<ig-version> -o pcap-ng --k8s-namespace <ns> --k8s-podname <pod> \
     --timeout 30 --pf "port 80" \
  | tcpdump -nvr -
```

Use `--pf "<expr>"` for tcpdump filters (e.g., `port 80`, `host 10.0.0.1`). Output must be `-o pcap-ng` (not `-o json`).

### Process & Workload

| Gadget | Type | What It Does | When To Use |
|---|---|---|---|
| `snapshot_process` | snapshot | List running processes in pod/node | PID pressure, unknown processes, verifying entrypoint, CrashLoopBackOff |
| `trace_exec` | trace | Trace process execution (execve calls) | CrashLoopBackOff (what actually runs), unexpected child processes, security audit |
| `trace_oomkill` | trace | Trace OOM kill events with victim details | OOMKilled pods — see which process was killed, memory usage at kill time |
| `trace_signal` | trace | Trace signals delivered to processes | Unexpected SIGKILL/SIGTERM, liveness probe kills, graceful shutdown issues |
| `top_process` | top | Rank processes by CPU/memory usage | Identifying resource-hungry processes inside a pod or across a node |
| `profile_cpu` | profile | CPU profiling via stack sampling | High CPU usage investigation, finding hot code paths |
| `traceloop` | trace | Record syscalls as a flight recorder | Catch-all for intermittent issues. **Always use `--syscall-filters`** (e.g., `open,connect,accept`) to limit data volume |

### File & Storage

| Gadget | Type | What It Does | When To Use |
|---|---|---|---|
| `trace_open` | trace | Trace openat syscall | Missing config/secret files (ENOENT), permission denied (EACCES), startup failures |
| `trace_fsslower` | trace | Trace slow filesystem operations | Slow disk I/O, PVC performance issues, NFS/Azure Disk latency |
| `top_file` | top | Rank files by read/write activity | Identifying I/O-heavy files, noisy log writers, disk pressure diagnosis |

### Security & Audit

| Gadget | Type | What It Does | When To Use |
|---|---|---|---|
| `trace_capabilities` | trace | Trace Linux capability checks | Permission denied from dropped capabilities, SecurityContext debugging |

## Symptom-to-Gadget Map

| Symptom | Gadget(s) |
|---|---|
| DNS resolution failures | `trace_dns` |
| Connection refused / timeout | `trace_tcp` + `snapshot_socket` |
| Silent connection drops | `trace_tcpretrans` |
| High network latency | `trace_tcpretrans` |
| TLS / HTTPS routing issues | `trace_sni` |
| Port already in use | `trace_bind` + `snapshot_socket` |
| CrashLoopBackOff (unknown cause) | `trace_exec` + `trace_open` |
| OOMKilled pods | `trace_oomkill` + `top_process` |
| Pod killed unexpectedly | `trace_signal` |
| PID pressure on node | `snapshot_process` + `top_process` |
| "Too many open files" | `top_file` |
| Missing config / secret mount | `trace_open` |
| Slow disk / PVC performance | `trace_fsslower` + `top_file` |
| Permission denied (capabilities) | `trace_capabilities` |
| High CPU (unknown cause) | `profile_cpu` + `top_process` |
| Deep packet inspection | `tcpdump` |
| Catch-all / intermittent issues | `traceloop` (use `--syscall-filters`) |

## Gadget Type Reference

| Type | Behavior | IG --timeout |
|---|---|---|
| `snapshot` | Point-in-time data, returns immediately | `--timeout 5` |
| `top` | Aggregated view, returns quickly | `--timeout 5` |
| `trace` | Streams events in real-time | `--timeout 30` |
| `profile` | Samples over a duration | `--timeout 30` |
| `tcpdump` | Streams pcap-ng data, pipe to `tcpdump -nvr -` | `--timeout 30` |

## Guardrails

- IG gadgets are **read-only** — they do not modify cluster or application state.
- Resolve the correct node name before running any IG command.
- Always set `--timeout` to cap runtime. Prefer snapshot/top for quick checks; trace/profile for behavior over time.
- For reproduction: launch a trace gadget first, then reproduce the problem. The debug pod persists after the gadget exits, so run `kubectl logs <debug-pod>` to retrieve the captured output afterward.
