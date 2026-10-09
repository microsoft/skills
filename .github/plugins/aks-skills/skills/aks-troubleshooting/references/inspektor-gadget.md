# Inspektor Gadget (IG) Reference

Use Inspektor Gadget for real-time, low-level node/pod diagnostics when `kubectl` is insufficient.

## Limits

Linux nodes only; kernel 5.10+ with BTF; not Kata-sandboxed pods. Admission policy can deny privileged pods. If eBPF fails to load or a pod is denied, record the evidence as unavailable and do not relax policy.

## Choose a path

1. **Discover (read-only):** `kubectl get ds gadget -n gadget -o jsonpath='{.spec.template.spec.containers[0].image}'`. The AKS extension `microsoft.inspektorgadget` also creates this DaemonSet.
2. **Deployed and `kubectl gadget` present (preferred; no privileged pod):** require `kubectl auth can-i create pods/portforward -n gadget`. Match the gadget tag to `kubectl gadget version`, because a mismatched version fails to load. Run `kubectl --context <kube-context> gadget run <gadget>:<server-version> -n <ns> [-p <pod>] --timeout <s> -o json > <raw-artifact>.json`. Never use `--detach`, which creates persistent instances.
3. **Otherwise:** use the debug-pod path below. Require `kubectl auth can-i create pods -n <debug-ns>` and explicit approval.
4. **Never install IG during an investigation** (`kubectl gadget deploy`, Helm, or `az k8s-extension create`). Propose installation to the owner as a separate change.

If a check fails, name the identity and the missing verb, then stop that path.

## Approved Image (debug-pod path)

`mcr.microsoft.com/oss/v2/inspektor-gadget/ig:v0.51.0@sha256:6610863f6d8cae28800f9331756434639bca44be065719cbcfe76e34c91dffa4`

Do not replace the digest with a tag-only reference. Re-review the upstream release and platform manifests before changing either the version or digest.

## Base Command Pattern (debug-pod path)

The incident owner must explicitly approve privileged debug-pod creation and choose a finite outer deadline before this command is run:

```bash
IG_IMAGE='mcr.microsoft.com/oss/v2/inspektor-gadget/ig:v0.51.0@sha256:6610863f6d8cae28800f9331756434639bca44be065719cbcfe76e34c91dffa4'
timeout <approved-deadline> \
  kubectl --context <kube-context> debug --profile=sysadmin \
  node/<node-name> --attach --quiet --image="$IG_IMAGE" -- \
  ig run <gadget>:v0.51.0 -o json --timeout <gadget-seconds> [filters...] \
  > <raw-artifact>.json
```

Use both bounds: the outer deadline caps the whole `kubectl debug` operation, and the inner IG timeout caps the gadget. Use `--timeout 5` for snapshot/top and `--timeout 30` for trace/profile. Record the generated debug-pod name and delete that exact pod within the same approved operation.

> **Note:** The gadget observes read-only state, but creating and deleting a `--profile=sysadmin` debug pod are privileged cluster mutations. Approval and appropriate RBAC are mandatory.

**Required:** Resolve the node name first:

```bash
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.spec.nodeName}'
```

## Common Filters (debug-pod `ig run`; `kubectl gadget` uses `-n`/`-p`/`-c`)

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

Keep raw pcap-ng outside model context:

```bash
IG_IMAGE='mcr.microsoft.com/oss/v2/inspektor-gadget/ig:v0.51.0@sha256:6610863f6d8cae28800f9331756434639bca44be065719cbcfe76e34c91dffa4'
timeout <approved-deadline> \
  kubectl --context <kube-context> debug --profile=sysadmin \
  node/<node-name> --attach --quiet --image="$IG_IMAGE" -- \
  ig run tcpdump:v0.51.0 -o pcap-ng \
  --k8s-namespace <ns> --k8s-podname <pod> \
  --timeout 30 --pf "port 80" \
  > <raw-artifact>.pcapng
```

Use `--pf "<expr>"` for a narrow tcpdump filter (for example, `port 80` or `host 10.0.0.1`). Output must be `-o pcap-ng` (not `-o json`). Inspect the artifact with an approved offline packet-analysis tool rather than pasting packet payloads into model context.

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

## Guardrails

- Prove the named AKS resource and kube context match before resolving the node or running IG.
- Discover an existing IG deployment and check permissions before choosing the debug-pod path.
- Require explicit approval for privileged debug-pod creation and deletion.
- Bound every run with the gadget timeout; on the debug-pod path also use only the digest-pinned image and an outer deadline.
- Scope every run to the symptom, namespace, pod, and supported filter set; do not use an unbounded catch-all trace.
- Keep raw JSON/pcap output outside model context and expose only a bounded, redacted finding summary.
- Confirm deletion of the exact generated debug pod on success, failure, interruption, or timeout.
