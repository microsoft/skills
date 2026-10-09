# API server, admission webhook, and tunnel evidence

Bind every read to the named AKS cluster, affected object, nodes, and incident
window. Use supplied evidence and approved host capabilities; unavailable
telemetry is unknown, not absent.

## API server pressure

For API latency, timeouts, HTTP 429, or "unable to handle the request," inspect
Resource Health and AKS control-plane diagnostics when available, then correlate
the affected command, recent bulk operations, and high-volume list/watch
clients. Distinguish customer-driven request load from a platform condition. If
the remaining evidence requires service-side control-plane access, stop and
escalate with the cluster, timestamps, symptoms, correlation IDs, and completed
read-only checks.

### HTTP 429: managed API server guard versus client load

```bash
kubectl get flowschemas
kubectl get prioritylevelconfigurations
kubectl get flowschema aks-managed-apiserver-guard -o yaml
kubectl get events -n kube-system --field-selector type=Warning --sort-by=.lastTimestamp
```

- A `FlowSchema` and `PriorityLevelConfiguration` named
  `aks-managed-apiserver-guard` mean AKS is throttling non-system client
  requests as a last-resort protection after repeated API-server OOM events. Its
  presence explains *that* requests are being throttled; it does not by itself
  identify the root cause, which is still excessive client load, oversized
  list/watch patterns, or etcd object growth. Report it as the throttling
  mechanism, keep reading evidence, and never delete or relabel the guard
  objects: that is a mutation the owner must approve after the load source is
  fixed.
- Absence of the guard does not prove the client is at fault. Treat 429s without
  the guard as ordinary API Priority and Fairness throttling and identify the
  client from the request-volume evidence available to the customer (AKS
  control-plane diagnostics when configured, client-side logs, recent
  controller or CI rollouts).

### etcd size and object count

```bash
# Metric name varies by Kubernetes version; the grep matches all three
kubectl get --raw /metrics | grep -E "etcd_db_total_size_in_bytes|apiserver_storage_size_bytes|apiserver_storage_db_total_size_in_bytes"
kubectl get --raw /metrics | grep -E '^apiserver_storage_objects' | sort -t' ' -k2 -nr | head -20
kubectl get events -A --sort-by=.lastTimestamp | tail -50
```

- Learn describes an etcd database above 2 GB as large and 8 GB as the default
  size limit; more than roughly 10,000 objects of one type can slow etcd. Use the
  Azure portal's Diagnose and Solve Problems etcd capacity/performance tools for
  the breakdown when portal access is available.
- A rising object count for one kind is *correlation* until the owning
  controller is evidenced (for example the resource's `ownerReferences`,
  `managedFields` manager, or a creating controller's logs). Name the kind and
  the suspected owner, quantify the growth, and stop. Do not delete objects;
  cleanup, retention, and `ResourceQuota` object quotas are owner decisions.
- Free tier clusters have limited API-server and etcd resources and no HA;
  record the tier as evidence before attributing pressure to a client.

## Admission webhooks

```bash
kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations -o yaml
kubectl get service,endpoints,endpointslice -n <webhook-namespace>
kubectl get pods -n <webhook-namespace> -o wide
```

For the named webhook, inspect `failurePolicy`, `timeoutSeconds`,
`namespaceSelector`, backing Service, endpoints, and ready pods. A failing
webhook with `failurePolicy: Fail` can block matching operations, but an error
string alone does not prove the backend cause or blast radius. Never delete,
patch, or weaken a webhook until the backend state is proven and the owner
approves the remediation.

### Deployment Safeguards as an admission actor

If an admission denial or an unexpected pod mutation (CPU/memory requests or
limits set or raised, pod anti-affinity or topology spread constraints added)
does not match any customer `ValidatingWebhookConfiguration` or
`MutatingWebhookConfiguration`, check whether AKS Deployment Safeguards is
enabled at the **Enforce** level before attributing it to a customer webhook.
Safeguards is enabled and set to Enforce by default on AKS Automatic clusters
(namespaces can be excluded, but the level cannot be changed to Warn) and is
optional Warn or Enforce on AKS Standard, so require the cluster's actual
Safeguards state rather than partitioning on Automatic versus Standard:

```bash
az aks safeguards show -g <rg> -n <cluster>   # aks-preview extension: level, excluded namespaces, PSS level
kubectl get constraints                       # Gatekeeper constraints active on the cluster
```

Report the matching Safeguards policy or mutator by name and leave the
enablement level, excluded namespaces, and workload manifest changes to the
owner. Policy-by-policy manifest compatibility for AKS Automatic belongs to the
nested `azure-kubernetes` Automatic readiness reference; hand off there when the
question becomes "will this manifest be admitted."

## Node-dependent logs, exec, and port-forward failures

If `kubectl logs`, `exec`, `port-forward`, or webhook calls fail only for pods
on some nodes while ordinary API reads work, test the node-placement pattern
and inspect the `konnectivity-agent` pods in `kube-system`. Port 10250 errors
can indicate the API-server-to-kubelet tunnel path rather than pod networking.
Inspect the affected nodes' NSG, firewall, UDR, and tunnel-component evidence
read-only. Do not change node firewall or iptables state; escalate service-side
or unsupported node conditions with the collected evidence.

Exact nested `VMExtensionError_K8SAPIServerConnFail` / CSE exit 51 belongs to
`aks-known-issues`. Explicit packet capture belongs to `aks-network-capture`.

Sources: [API server and etcd troubleshooting](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/create-upgrade-delete/troubleshoot-apiserver-etcd),
[tunnel connectivity](https://learn.microsoft.com/troubleshoot/azure/azure-kubernetes/connectivity/tunnel-connectivity-issues),
[admission-controller triage](https://learn.microsoft.com/azure/architecture/operator-guides/aks/aks-triage-controllers),
[Deployment Safeguards](https://learn.microsoft.com/azure/aks/deployment-safeguards),
and [AKS support policies](https://learn.microsoft.com/azure/aks/support-policies).
