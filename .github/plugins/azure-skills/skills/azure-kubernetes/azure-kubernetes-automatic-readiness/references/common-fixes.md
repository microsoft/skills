# Common Fix Patterns for AKS Automatic Compatibility

Loaded on demand when generating YAML fixes during assessment.
Maps to constraint IDs in `constraint-spec-v1.yaml`.

---

## `safeguard-container-resource-requests` — Add resource requests/limits

**Before:**
```yaml
containers:
  - name: web
    image: myapp:v1.0.0
```

**After:**
```yaml
containers:
  - name: web
    image: myapp:v1.0.0
    resources:
      requests:
        cpu: "250m"
        memory: "256Mi"
      limits:
        cpu: "500m"
        memory: "512Mi"
```

> 💡 **Tip:** Use safe minimums as starting values. VPA (auto-enabled on AKS Automatic) will tune these after deployment based on actual usage.

---

## `safeguard-container-capabilities` — Drop all capabilities

**Before:**
```yaml
securityContext:
  capabilities:
    add: ["NET_ADMIN"]
```

**After:**
```yaml
securityContext:
  capabilities:
    drop: ["ALL"]
```

> ⚠️ **Warning:** If the app genuinely requires `NET_ADMIN` or similar, it is **incompatible** with AKS Automatic. Do not silently drop — explain the incompatibility and suggest redesign.

---

## `safeguard-allowed-seccomp-profiles` — Add seccomp profile

**Before:**
```yaml
spec:
  containers:
    - name: web
```

**After:**
```yaml
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: web
```

---

## `safeguard-allowed-seccomp-profiles` — Remove 'Unconfined' seccomp profile

**Before:**
```yaml
spec:
  securityContext:
    seccompProfile:
      type: Unconfined
  containers:
    - name: web
```

**After:**
```yaml
spec:
  containers:
    - name: web
```

---

## `safeguard-enforce-apparmor` — Add AppArmor annotation

**Before:**
```yaml
metadata:
  name: my-deployment
```

**After:**
```yaml
metadata:
  name: my-deployment
  annotations:
    container.apparmor.security.beta.kubernetes.io/web: runtime/default
```

> 💡 **Tip:** Replace `web` with the actual container name. Add one annotation per container.

---

## `safeguard-images-no-latest` — Pin image tag *(LLM-reasoned — ask user)*

**Before:**
```yaml
image: myapp:latest
```

**After:**
```yaml
image: myapp:v1.2.3   # ← version confirmed with user
```

> ⚠️ **Warning:** Do not guess the version. Ask the user: _"What specific version tag or SHA digest should I pin this image to?"_ If from a public registry, suggest checking Docker Hub or the registry for the latest stable tag.

---

## `safeguard-probes-configured` — Add probes *(best-practice recommendation — warning-only, not blocked at admission)*

**HTTP app (most common):**
```yaml
readinessProbe:
  httpGet:
    path: /healthz        # ← ask user for their health endpoint
    port: 8080            # ← ask user for port
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 20
  failureThreshold: 3
```

**TCP-only app (databases, Redis, etc.):**
```yaml
readinessProbe:
  tcpSocket:
    port: 6379           # ← service port
  initialDelaySeconds: 5
  periodSeconds: 10
livenessProbe:
  tcpSocket:
    port: 6379
  initialDelaySeconds: 15
  periodSeconds: 20
```

**gRPC app:**
```yaml
readinessProbe:
  grpc:
    port: 50051
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## `safeguard-host-probes` — Remove host field in probes and lifecycle hooks

**Before:**
```yaml
spec:
  containers:
  - name: my-container
    image: nginx:v1.2.3
    livenessProbe:
      httpGet:
        host: "my-host"
        path: /healthz
        port: 8080
      initialDelaySeconds: 15
      periodSeconds: 20
      failureThreshold: 3
```

**After:**
Remove the `host` field
Example:
```yaml
spec:
  containers:
  - name: my-container
    image: nginx:v1.2.3
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
      initialDelaySeconds: 15
      periodSeconds: 20
      failureThreshold: 3
```

---

## `safeguard-pod-enforce-antiaffinity` — Add topology spread *(LLM-reasoned — ask user for label)*

Ask user: _"What label key/value identifies your workload's pods?"_

```yaml
spec:
  template:
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: <app-label>     # ← from user
      containers:
        - name: web
```

---

## `safeguard-csi-driver-storage-class` — Migrate in-tree to CSI

**Before (Azure Disk in-tree):**
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-storage
provisioner: kubernetes.io/azure-disk
parameters:
  skuName: Premium_LRS
reclaimPolicy: Delete
volumeBindingMode: Immediate
```

**After (Azure Disk CSI):**
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-storage
provisioner: disk.csi.azure.com
parameters:
  skuName: Premium_LRS
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer   # ← preferred for zonal disks
```

| In-tree provisioner | CSI replacement |
|---|---|
| `kubernetes.io/azure-disk` | `disk.csi.azure.com` |
| `kubernetes.io/azure-file` | `file.csi.azure.com` |

---

## PodDisruptionBudget — Add missing PDB

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: <app-name>-pdb
  namespace: <namespace>
spec:
  maxUnavailable: 1
  selector:
    matchLabels:
      app: <app-label>
```

## PodDisruptionBudget — Fix blocking `maxUnavailable: 0`

**Before:**
```yaml
spec:
  maxUnavailable: 0
```

**After:**
```yaml
spec:
  maxUnavailable: 1
```

> ⚠️ **Warning:** `maxUnavailable: 0` completely blocks node drain during AKS Automatic upgrades. At least 1 pod must be allowed unavailable for upgrades to proceed.

---

## `safeguard-no-host-path-volumes` — Replace hostPath *(incompatible — suggest alternatives)*

| hostPath use case | Recommended replacement |
|---|---|
| Log collection (`/var/log`) | Azure Monitor Container Insights (auto-enabled on AKS Automatic) |
| Container runtime socket (`/var/run/docker.sock`) | Use the AKS Automatic node observability features — direct socket access not supported |
| Shared config files | `configMap` volume |
| Secrets / credentials | Kubernetes `secret` volume or Azure Key Vault CSI Driver |
| Ephemeral scratch space | `emptyDir` volume |
| Persistent app data | Azure Disk CSI via PVC (`disk.csi.azure.com`) |
| Shared file storage across pods | Azure Files CSI via PVC (`file.csi.azure.com`) |

**emptyDir example:**
```yaml
volumes:
  - name: scratch
    emptyDir: {}
```

**Azure Files CSI PVC example:**
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: logs-pvc
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: azurefile-csi
  resources:
    requests:
      storage: 10Gi
```
