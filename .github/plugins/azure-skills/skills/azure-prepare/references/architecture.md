# Architecture Planning

Select hosting stack and map components to Azure services.

## Stack Selection

| Stack           | Best For                                               | Azure Services                    |
| --------------- | ------------------------------------------------------ | --------------------------------- |
| **Containers**  | Docker experience, complex dependencies, microservices | Container Apps, AKS, ACR          |
| **Serverless**  | Event-driven, variable traffic, cost optimization      | Functions, Logic Apps, Event Grid |
| **App Service** | Traditional web apps, PaaS preference                  | App Service, Static Web Apps      |

### Decision Factors

| Factor                   | Containers |          Serverless          | App Service |
| ------------------------ | :--------: | :--------------------------: | :---------: |
| Docker experience        |     ✓✓     |                              |             |
| Event-driven             |     ✓      |              ✓✓              |             |
| Variable traffic         |            |              ✓✓              |      ✓      |
| Complex dependencies     |     ✓✓     |                              |      ✓      |
| Long-running processes   |     ✓✓     |    ✓ (Durable Functions)     |      ✓      |
| Workflow / orchestration |            | ✓✓ (Durable Functions + DTS) |             |
| Minimal ops overhead     |            |              ✓✓              |      ✓      |

### Container Hosting: Container Apps vs AKS

| Factor                    |       Container Apps        |                 AKS                 |
| ------------------------- | :-------------------------: | :---------------------------------: |
| **Scale to zero**         |             ✓✓              |                                     |
| **Kubernetes API access** |                             |                 ✓✓                  |
| **Custom operators/CRDs** |                             |                 ✓✓                  |
| **Service mesh**          |       Dapr (built-in)       |                Istio                |
| **Networking/dataplane**  |  Managed platform defaults  |     Azure CNI powered by Cilium     |
| **GPU workloads**         | Serverless A100/T4 inference |      Full Kubernetes control        |
| **Best for**              | Managed microservices, event-driven apps, serverless inference | Kubernetes APIs, operators, custom scheduling/networking |

#### When to Use Container Apps

- Microservices without Kubernetes complexity
- Event-driven workloads (KEDA built-in)
- Need scale-to-zero for cost optimization
- Teams without Kubernetes expertise
- Serverless GPU inference that does not require Kubernetes APIs, operators, or
  custom scheduling ([Microsoft Learn](https://learn.microsoft.com/azure/container-apps/gpu-serverless-overview))

#### When to Use AKS

- Need Kubernetes API/kubectl access
- Require custom operators or CRDs
- Service mesh requirements (Istio, Linkerd)
- GPU/ML workloads that require Kubernetes APIs, operators, custom scheduling,
  or advanced networking/control
- Complex networking or multi-tenant architectures

> **AKS Planning:** For AKS SKU selection (Automatic vs Standard), networking, identity, scaling, and security configuration, invoke the **azure-kubernetes** skill.

## Service Mapping

### Hosting

| Component Type           | Primary Service   | Alternatives                                     |
| ------------------------ | ----------------- | ------------------------------------------------ |
| SPA Frontend             | Static Web Apps   | Blob + CDN                                       |
| SSR Web App              | Container Apps    | App Service, AKS                                 |
| REST/GraphQL API         | Container Apps    | App Service, Functions, AKS                      |
| Background Worker        | Container Apps    | Functions, AKS                                   |
| Scheduled Task           | Functions (Timer) | Container Apps Jobs, Kubernetes CronJob (on AKS) |
| Event Processor          | Functions         | Container Apps, AKS + KEDA                       |
| Microservices (full K8s) | AKS               | Container Apps                                   |
| GPU inference (managed/serverless) | Container Apps | AKS (when Kubernetes control is required), Azure ML |
| GPU/ML with Kubernetes control | AKS | Container Apps (serverless inference), Azure ML |

### Data

| Need       | Primary      | Reference                                       | Alternatives      |
| ---------- | ------------ | ----------------------------------------------- | ----------------- |
| Relational | Azure SQL    | [SQL Database](services/sql-database/README.md) | PostgreSQL, MySQL |
| Document   | Cosmos DB    | [Cosmos DB](services/cosmos-db/README.md)       | MongoDB           |
| Cache      | Redis Cache  |                                                 |                   |
| Files      | Blob Storage | [Storage](services/storage/README.md)           | Files Storage     |
| Search     | AI Search    |                                                 |                   |

### Integration

| Need          | Service     |
| ------------- | ----------- |
| Message Queue | Service Bus |
| Pub/Sub       | Event Grid  |
| Streaming     | Event Hubs  |

### Workflow & Orchestration

| Need                                | Service                                        | Notes                                                                                                                                                       |
| ----------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-step workflow / orchestration | **Durable Functions + Durable Task Scheduler** | DTS is the **required** managed backend for Durable Functions. Do NOT use Azure Storage or MSSQL backends. See [durable.md](services/functions/durable.md). |
| Low-code / visual workflow          | Logic Apps                                     | For integration-heavy, low-code scenarios                                                                                                                   |

### Supporting (Always Include)

| Service              | Purpose                 |
| -------------------- | ----------------------- |
| Log Analytics        | Centralized logging     |
| Application Insights | Monitoring, APM         |
| Key Vault            | Secrets management      |
| Managed Identity     | Service-to-service auth |

---

## Document Architecture

Record selections in `.azure/deployment-plan.md` with rationale for each choice.
