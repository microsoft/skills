# sanitize-readiness-input.jq — allowlist projection for AKS Automatic readiness.
#
# Usage (from the skill root; requires jq 1.6+):
#   kubectl get deployment,statefulset,daemonset,job,cronjob,pod,service,poddisruptionbudget,storageclass \
#     -A -o json | jq -f scripts/sanitize-readiness-input.jq
#
# Keeps only the fields the constraint spec evaluates. Everything else — env
# values, envFrom, volume sources, annotations other than AppArmor, managedFields,
# status, Secret/ConfigMap data — is dropped by default because it is never
# selected. Never feed Secret or ConfigMap resources into this pipeline.
# Ported from Azure/AKS-Skills skills/aks-automatic-readiness (PR #71).

def compact:
  walk(
    if type == "object" then
      with_entries(select(.value != null and .value != {} and .value != []))
    else
      .
    end
  );

def metadata_projection:
  {
    name: .name,
    namespace: .namespace,
    restrictedLabelKeys: (
      (.labels // {})
      | keys
      | map(select(startswith("kubernetes.azure.com/")))
    ),
    legacyAppArmorProfiles: [
      (.annotations // {})
      | to_entries[]
      | select(
          .key
          | startswith(
              "container.apparmor.security.beta.kubernetes.io/"
            )
        )
      | {
          container: (
            .key
            | ltrimstr(
                "container.apparmor.security.beta.kubernetes.io/"
              )
          ),
          valid: (
            .value == null
            or .value == "runtime/default"
            or (if (.value | type) == "string"
                then (.value | startswith("localhost/"))
                else false
                end)
          )
        }
    ]
  }
  | compact;

def security_context_projection:
  {
    privileged: .privileged,
    allowPrivilegeEscalation: .allowPrivilegeEscalation,
    runAsNonRoot: .runAsNonRoot,
    runAsUser: .runAsUser,
    procMount: .procMount,
    capabilities: {
      add: (.capabilities.add // []),
      drop: (.capabilities.drop // [])
    },
    seccompProfile: {type: .seccompProfile.type},
    appArmorProfile: {type: .appArmorProfile.type},
    seLinuxOptions: {
      type: .seLinuxOptions.type,
      userConfigured: (.seLinuxOptions.user != null and .seLinuxOptions.user != ""),
      roleConfigured: (.seLinuxOptions.role != null and .seLinuxOptions.role != "")
    },
    windowsOptions: {
      hostProcess: .windowsOptions.hostProcess,
      runsAsContainerAdministrator:
        (.windowsOptions.runAsUserName == "ContainerAdministrator")
    },
    sysctls: [(.sysctls // [])[] | {name: .name}]
  }
  | compact;

def container_projection:
  (.image // "") as $image
  | ($image | test("@sha256:[0-9A-Fa-f]{64}$")) as $uses_digest
  | ($image | split("@")[0] | split("/") | last) as $name_and_tag
  | ($name_and_tag | test(":[^:]+$")) as $has_tag
  | ($name_and_tag | endswith(":latest")) as $uses_latest_tag
  |
  {
    name: .name,
    imagePolicy: {
      usesLatestTag: (
        ($uses_digest | not)
        and (($has_tag | not) or $uses_latest_tag)
      ),
      pinned: (
        $uses_digest
        or ($has_tag and ($uses_latest_tag | not))
      )
    },
    resources: .resources,
    readinessProbeConfigured: has("readinessProbe"),
    livenessProbeConfigured: has("livenessProbe"),
    securityContext: (.securityContext | security_context_projection),
    ports: [
      (.ports // [])[]
      | {
          containerPort: .containerPort,
          hostPort: .hostPort,
          protocol: .protocol
        }
      | compact
    ]
  }
  | compact;

def volume_projection:
  . as $volume
  | {
      name: .name,
      types: (
        [
          "awsElasticBlockStore",
          "azureDisk",
          "azureFile",
          "cephfs",
          "cinder",
          "configMap",
          "csi",
          "downwardAPI",
          "emptyDir",
          "ephemeral",
          "fc",
          "flexVolume",
          "flocker",
          "gcePersistentDisk",
          "gitRepo",
          "glusterfs",
          "hostPath",
          "iscsi",
          "nfs",
          "persistentVolumeClaim",
          "photonPersistentDisk",
          "portworxVolume",
          "projected",
          "quobyte",
          "rbd",
          "scaleIO",
          "secret",
          "storageos",
          "vsphereVolume"
        ]
        | map(. as $type | select($volume | has($type)))
      )
    }
  | compact;

def pod_spec_projection:
  {
    hostPID: (.hostPID // false),
    hostIPC: (.hostIPC // false),
    hostNetwork: (.hostNetwork // false),
    securityContext: (.securityContext | security_context_projection),
    containers: [(.containers // [])[] | container_projection],
    initContainers: [(.initContainers // [])[] | container_projection],
    ephemeralContainers: [(.ephemeralContainers // [])[] | container_projection],
    volumes: [(.volumes // [])[] | volume_projection],
    podAntiAffinityConfigured: (.affinity.podAntiAffinity != null),
    topologySpreadConstraintsConfigured:
      (((.topologySpreadConstraints // []) | length) > 0)
  }
  | compact;

def workload_projection:
  {
    apiVersion: .apiVersion,
    kind: .kind,
    metadata: (.metadata | metadata_projection),
    spec: {
      replicas: .spec.replicas,
      template: {
        metadata: (.spec.template.metadata | metadata_projection),
        spec: (.spec.template.spec | pod_spec_projection)
      }
    }
  }
  | compact;

def cronjob_projection:
  {
    apiVersion: .apiVersion,
    kind: .kind,
    metadata: (.metadata | metadata_projection),
    spec: {
      jobTemplate: {
        spec: {
          template: {
            metadata:
              (.spec.jobTemplate.spec.template.metadata | metadata_projection),
            spec:
              (.spec.jobTemplate.spec.template.spec | pod_spec_projection)
          }
        }
      }
    }
  }
  | compact;

def pod_projection:
  {
    apiVersion: .apiVersion,
    kind: .kind,
    metadata: (.metadata | metadata_projection),
    spec: (.spec | pod_spec_projection)
  }
  | compact;

def service_selector_key:
  (.spec.selector // {})
  | to_entries
  | sort_by(.key)
  | tojson;

def service_projection($all):
  . as $service
  | {
      apiVersion: .apiVersion,
      kind: .kind,
      metadata: (.metadata | metadata_projection),
      selectorDuplicateCount: (
        if (($service.spec.selector // {}) | length) == 0 then
          0
        else
          [
            $all[]
            | select(.kind == "Service")
            | select(
                (.metadata.namespace // "default")
                == ($service.metadata.namespace // "default")
              )
            | select(
                service_selector_key
                == ($service | service_selector_key)
              )
          ]
          | length
        end
      )
    }
  | compact;

def pdb_projection:
  {
    apiVersion: .apiVersion,
    kind: .kind,
    metadata: (.metadata | metadata_projection),
    spec: {
      minAvailable: .spec.minAvailable,
      maxUnavailable: .spec.maxUnavailable
    }
  }
  | compact;

def storageclass_projection:
  {
    apiVersion: .apiVersion,
    kind: .kind,
    metadata: (.metadata | metadata_projection),
    provisioner: .provisioner
  }
  | compact;

(.items // []) as $all
| {
    apiVersion: .apiVersion,
    kind: .kind,
    items: [
      $all[]
      | if .kind == "CronJob" then
          cronjob_projection
        elif .kind == "Pod" then
          pod_projection
        elif .kind == "Service" then
          service_projection($all)
        elif .kind == "PodDisruptionBudget" then
          pdb_projection
        elif .kind == "StorageClass" then
          storageclass_projection
        elif (
          .kind == "Deployment"
          or .kind == "StatefulSet"
          or .kind == "DaemonSet"
          or .kind == "Job"
        ) then
          workload_projection
        else
          empty
        end
    ]
  }
