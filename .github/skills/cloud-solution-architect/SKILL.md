---
name: cloud-solution-architect
description: >-
  Transform the agent into a Cloud Solution Architect following Azure Architecture Center best practices.
  Use when designing cloud architectures, reviewing system designs, selecting architecture styles,
  applying cloud design patterns, making technology choices, or conducting Well-Architected Framework reviews.
---

# Cloud Solution Architect

## Overview

Design well-architected, production-grade cloud systems following Azure Architecture Center best practices. This skill provides:

- **10 design principles** for Azure applications
- **6 architecture styles** with selection guidance
- **44 cloud design patterns** mapped to WAF pillars, with selection and composition guidance
- **Technology choice frameworks** for compute, storage, data, messaging
- **AI workload design** guidance for the five-layer application model
- **Performance antipatterns** to avoid
- **Architecture review workflow** for systematic design validation

---

## Ten Design Principles for Azure Applications

| # | Principle | Key Tactics |
|---|-----------|-------------|
| 1 | **Design for self-healing** | Retry with backoff, circuit breaker, bulkhead isolation, health endpoint monitoring, graceful degradation |
| 2 | **Make all things redundant** | Eliminate single points of failure, use availability zones, deploy multi-region, replicate data |
| 3 | **Minimize coordination** | Decouple services, use async messaging, embrace eventual consistency, use domain events |
| 4 | **Design to scale out** | Horizontal scaling, autoscaling rules, stateless services, avoid session stickiness, partition workloads |
| 5 | **Partition around limits** | Data partitioning (shard/hash/range), respect compute & network limits, use CDNs for static content |
| 6 | **Design for operations** | Structured logging, distributed tracing, metrics & dashboards, runbook automation, infrastructure as code |
| 7 | **Use managed services** | Prefer PaaS over IaaS, reduce operational burden, leverage built-in HA/DR/scaling |
| 8 | **Use an identity service** | Microsoft Entra ID, managed identity, RBAC, avoid storing credentials, zero-trust principles |
| 9 | **Design for evolution** | Loose coupling, versioned APIs, backward compatibility, async messaging for integration, feature flags |
| 10 | **Build for business needs** | Define SLAs/SLOs, establish RTO/RPO targets, domain-driven design, cost modeling, composite SLAs |

---

## Architecture Styles

| Style | Description | When to Use | Key Services |
|-------|-------------|-------------|--------------|
| **N-tier** | Horizontal layers (presentation, business, data) | Traditional enterprise apps, lift-and-shift | App Service, SQL Database, VNets |
| **Web-Queue-Worker** | Web frontend → message queue → backend worker | Moderate-complexity apps with long-running tasks | App Service, Service Bus, Functions |
| **Microservices** | Small autonomous services, bounded contexts, independent deploy | Complex domains, independent team scaling | AKS, Container Apps, API Management |
| **Event-driven** | Pub/sub model, event producers/consumers | Real-time processing, IoT, reactive systems | Event Hubs, Event Grid, Functions |
| **Big data** | Batch + stream processing pipeline | Analytics, ML pipelines, large-scale data | Synapse, Data Factory, Databricks |
| **Big compute** | HPC, parallel processing | Simulations, modeling, rendering, genomics | Batch, CycleCloud, HPC VMs |

### Selection Criteria

- **Domain complexity** → Microservices (high), N-tier (low-medium)
- **Team autonomy** → Microservices (independent teams), N-tier (single team)
- **Data volume** → Big data (TB+), others (GB)
- **Latency requirements** → Event-driven (real-time), Web-Queue-Worker (tolerant)

---

## Cloud Design Patterns

44 patterns organized by primary concern. WAF pillar mapping: **R**=Reliability, **S**=Security, **CO**=Cost Optimization, **OE**=Operational Excellence, **PE**=Performance Efficiency.

### Selecting a Pattern

Cloud workloads are vulnerable to the fallacies of distributed computing — assumptions like "the network is reliable," "latency is zero," and "bandwidth is infinite." These misconceptions produce flawed designs; patterns compensate for them.

- **Choose a pattern by problem, not technology.** Start from a specific constraint or risk: a service that fails under load, a data store that can't keep up with reads, a dependency you can't fully trust.
- **A pattern fits when its problem statement matches your challenge** and the trade-offs it introduces are ones you can accept in your workload.
- **Every pattern has trade-offs,** and some affect other WAF pillars. Focus on why you choose a pattern, not just how to implement it.

### Messaging & Communication

| Pattern | Summary | Pillars |
|---------|---------|---------|
| [Asynchronous Request-Reply](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply) | Decouple request/response with polling or callbacks | PE |
| [Claim Check](https://learn.microsoft.com/en-us/azure/architecture/patterns/claim-check) | Split large messages; store payload separately, pass reference | R, S, CO, PE |
| [Choreography](https://learn.microsoft.com/en-us/azure/architecture/patterns/choreography) | Services coordinate via events without central orchestrator | OE, PE |
| [Competing Consumers](https://learn.microsoft.com/en-us/azure/architecture/patterns/competing-consumers) | Multiple consumers process messages from shared queue concurrently | R, CO, PE |
| [Messaging Bridge](https://learn.microsoft.com/en-us/azure/architecture/patterns/messaging-bridge) | Connect incompatible messaging systems | CO, OE |
| [Pipes and Filters](https://learn.microsoft.com/en-us/azure/architecture/patterns/pipes-and-filters) | Decompose complex processing into reusable filter stages | R |
| [Priority Queue](https://learn.microsoft.com/en-us/azure/architecture/patterns/priority-queue) | Prioritize requests so higher-priority work is processed first | R, PE |
| [Publisher/Subscriber](https://learn.microsoft.com/en-us/azure/architecture/patterns/publisher-subscriber) | Decouple senders from receivers via topics/subscriptions | R, S, CO, OE, PE |
| [Queue-Based Load Leveling](https://learn.microsoft.com/en-us/azure/architecture/patterns/queue-based-load-leveling) | Buffer requests with a queue to smooth intermittent loads | R, CO, PE |
| [Sequential Convoy](https://learn.microsoft.com/en-us/azure/architecture/patterns/sequential-convoy) | Process related messages in order while allowing parallel groups | R |

### Reliability & Resilience

| Pattern | Summary | Pillars |
|---------|---------|---------|
| [Bulkhead](https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead) | Isolate resources per workload to prevent cascading failure | R, S, PE |
| [Circuit Breaker](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker) | Stop calling a failing service; fail fast to protect resources | R, PE |
| [Compensating Transaction](https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction) | Undo previously committed steps when a later step fails | R |
| [Health Endpoint Monitoring](https://learn.microsoft.com/en-us/azure/architecture/patterns/health-endpoint-monitoring) | Expose health checks for load balancers and orchestrators | R, OE, PE |
| [Idempotent Consumer](https://learn.microsoft.com/en-us/azure/architecture/patterns/idempotent-consumer) | Handle duplicate message delivery so reprocessing has no additional effect | R |
| [Leader Election](https://learn.microsoft.com/en-us/azure/architecture/patterns/leader-election) | Coordinate distributed instances by electing a leader | R |
| [Retry](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry) | Handle transient faults by retrying with exponential backoff | R |
| [Saga](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga) | Manage data consistency across microservices with compensating transactions | R |
| [Scheduler Agent Supervisor](https://learn.microsoft.com/en-us/azure/architecture/patterns/scheduler-agent-supervisor) | Coordinate distributed actions with retry and failure handling | R, PE |

### Data Management

| Pattern | Summary | Pillars |
|---------|---------|---------|
| [Cache-Aside](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside) | Load data on demand into cache from data store | R, PE |
| [CQRS](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs) | Separate read and write models for independent scaling | PE |
| [Event Sourcing](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) | Store state as append-only sequence of domain events | R, PE |
| [Index Table](https://learn.microsoft.com/en-us/azure/architecture/patterns/index-table) | Create indexes over frequently queried fields in data stores | R, PE |
| [Materialized View](https://learn.microsoft.com/en-us/azure/architecture/patterns/materialized-view) | Pre-compute views over data for efficient queries | PE |
| [Sharding](https://learn.microsoft.com/en-us/azure/architecture/patterns/sharding) | Distribute data across partitions for scale and performance | R, CO |
| [Static Content Hosting](https://learn.microsoft.com/en-us/azure/architecture/patterns/static-content-hosting) | Serve static content from cloud storage/CDN directly | CO |
| [Valet Key](https://learn.microsoft.com/en-us/azure/architecture/patterns/valet-key) | Grant clients limited direct access to storage resources | S, CO, PE |

### Design & Structure

| Pattern | Summary | Pillars |
|---------|---------|---------|
| [Ambassador](https://learn.microsoft.com/en-us/azure/architecture/patterns/ambassador) | Offload cross-cutting concerns to a helper sidecar proxy | R, S |
| [Anti-Corruption Layer](https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer) | Translate between new and legacy system models | OE |
| [Backends for Frontends](https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends) | Create separate backends per frontend type (mobile, web, etc.) | R, S, PE |
| [Compute Resource Consolidation](https://learn.microsoft.com/en-us/azure/architecture/patterns/compute-resource-consolidation) | Combine multiple workloads into fewer compute instances | CO, OE, PE |
| [External Configuration Store](https://learn.microsoft.com/en-us/azure/architecture/patterns/external-configuration-store) | Externalize configuration from deployment packages | OE |
| [Sidecar](https://learn.microsoft.com/en-us/azure/architecture/patterns/sidecar) | Deploy helper components alongside the main service | S, OE |
| [Strangler Fig](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig) | Incrementally migrate legacy systems by replacing pieces | R, CO, OE |

### Security & Access

| Pattern | Summary | Pillars |
|---------|---------|---------|
| [Federated Identity](https://learn.microsoft.com/en-us/azure/architecture/patterns/federated-identity) | Delegate authentication to an external identity provider | R, S, PE |
| [Gatekeeper](https://learn.microsoft.com/en-us/azure/architecture/patterns/gatekeeper) | Protect services using a dedicated broker that validates requests | S, PE |
| [Quarantine](https://learn.microsoft.com/en-us/azure/architecture/patterns/quarantine) | Isolate and validate external assets before allowing use | S, OE |
| [Rate Limiting](https://learn.microsoft.com/en-us/azure/architecture/patterns/rate-limiting-pattern) | Control consumption rate of resources by consumers | R |
| [Throttling](https://learn.microsoft.com/en-us/azure/architecture/patterns/throttling) | Control resource consumption to sustain SLAs under load | R, S, CO, PE |

### Deployment & Scaling

| Pattern | Summary | Pillars |
|---------|---------|---------|
| [Deployment Stamps](https://learn.microsoft.com/en-us/azure/architecture/patterns/deployment-stamp) | Deploy multiple independent copies of application components | OE, PE |
| [Gateway Aggregation](https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-aggregation) | Aggregate multiple backend calls into a single client request | R, S, OE, PE |
| [Gateway Offloading](https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-offloading) | Offload shared functionality (SSL, auth) to a gateway | R, S, CO, OE, PE |
| [Gateway Routing](https://learn.microsoft.com/en-us/azure/architecture/patterns/gateway-routing) | Route requests to multiple backends using a single endpoint | R, OE, PE |
| [Geode](https://learn.microsoft.com/en-us/azure/architecture/patterns/geodes) | Deploy backends to multiple regions for active-active serving | R, PE |

### Combining Patterns

Patterns are composable. A single pattern addresses one problem, but a workload usually faces several at once:

- **Retry + Circuit Breaker** — retry transient faults, but stop retrying when a fault persists.
- **Queue-Based Load Leveling + Competing Consumers** — buffer load with a queue, then scale out the processing of that load.
- **Gateway Routing + Gateway Aggregation + Gateway Offloading** — layer all three behind a single gateway endpoint.
- **Saga + Compensating Transaction** — maintain data consistency across services when a distributed operation fails partway through.

See [Design Patterns Reference](./references/design-patterns.md) for detailed implementation guidance.

---

## Technology Choices

### Decision Framework

For each technology area, evaluate: **requirements → constraints → tradeoffs → select**.

| Area | Key Options | Selection Criteria |
|------|-------------|-------------------|
| **Compute** | App Service, Functions, Container Apps, AKS, VMs, Batch | Hosting model, scaling, cost, team skills |
| **Storage** | Blob Storage, Data Lake, Files, Disks, Managed Lustre | Access patterns, throughput, cost tier |
| **Data stores** | SQL Database, Cosmos DB, PostgreSQL, Redis, Table Storage | Consistency model, query patterns, scale |
| **Messaging** | Service Bus, Event Hubs, Event Grid, Queue Storage | Ordering, throughput, pub/sub vs queue |
| **Networking** | Front Door, Application Gateway, Load Balancer, Traffic Manager | Global vs regional, L4 vs L7, WAF |
| **AI services** | Azure OpenAI, AI Search, AI Foundry, Document Intelligence | Model needs, data grounding, orchestration |
| **Containers** | Container Apps, AKS, Container Instances | Operational control vs simplicity |

See [Technology Choices Reference](./references/technology-choices.md) for detailed decision trees.

---

## Best Practices

| Practice | Key Guidance |
|----------|-------------|
| **API design** | RESTful conventions, resource-oriented URIs, HATEOAS, versioning via URL path or header |
| **API implementation** | Async operations, pagination, idempotent PUT/DELETE, content negotiation, ETag caching |
| **Autoscaling** | Scale on metrics (CPU, queue depth, custom), cool-down periods, predictive scaling, scale-in protection |
| **Background jobs** | Use queues or scheduled triggers, idempotent processing, poison message handling, graceful shutdown |
| **Caching** | Cache-aside pattern, TTL policies, cache invalidation strategies, distributed cache for multi-instance |
| **CDN** | Static asset offloading, cache-busting with versioned URLs, geo-distribution, HTTPS enforcement |
| **Data partitioning** | Horizontal (sharding), vertical, functional partitioning; partition key selection for even distribution |
| **Partitioning strategies** | Hash-based, range-based, directory-based; rebalancing approach, cross-partition query avoidance |
| **Host name preservation** | Preserve original host header through proxies/gateways for cookies, redirects, auth flows |
| **Message encoding** | Schema evolution (Avro/Protobuf), backward/forward compatibility, schema registry |
| **Monitoring & diagnostics** | Structured logging, distributed tracing (W3C Trace Context), metrics, alerts, dashboards |
| **Transient fault handling** | Retry with exponential backoff + jitter, circuit breaker, idempotency keys, timeout budgets |

See [Best Practices Reference](./references/best-practices.md) for implementation details.

---

## Performance Antipatterns

Avoid these common patterns that degrade performance under load:

| Antipattern | Problem | Fix |
|-------------|---------|-----|
| **Busy Database** | Offloading too much processing to the database | Move logic to application tier, use caching |
| **Busy Front End** | Resource-intensive work on frontend request threads | Offload to background workers/queues |
| **Chatty I/O** | Many small I/O requests instead of fewer large ones | Batch requests, use bulk APIs, buffer writes |
| **Extraneous Fetching** | Retrieving more data than needed | Project only required fields, paginate, filter server-side |
| **Improper Instantiation** | Recreating expensive objects per request | Use singletons, connection pooling, HttpClientFactory |
| **Monolithic Persistence** | Single data store for all data types | Polyglot persistence — right store for each workload |
| **No Caching** | Repeatedly fetching unchanged data | Cache-aside pattern, CDN, output caching, Redis |
| **Noisy Neighbor** | One tenant consuming all shared resources | Bulkhead isolation, per-tenant quotas, throttling |
| **Retry Storm** | Aggressive retries overwhelming a recovering service | Exponential backoff + jitter, circuit breaker, retry budgets |
| **Synchronous I/O** | Blocking threads on I/O operations | Async/await, non-blocking I/O, reactive streams |

---

## Mission-Critical Design

For workloads targeting **99.99%+ SLO**, address these design areas:

| Design Area | Key Considerations |
|-------------|-------------------|
| **Application platform** | Multi-region active-active, availability zones, Container Apps or AKS with zone redundancy |
| **Application design** | Stateless services, idempotent operations, graceful degradation, bulkhead isolation |
| **Networking** | Azure Front Door (global LB), DDoS Protection, private endpoints, redundant connectivity |
| **Data platform** | Multi-region Cosmos DB, zone-redundant SQL, async replication, conflict resolution |
| **Deployment & testing** | Blue-green deployments, canary releases, chaos engineering, automated rollback |
| **Health modeling** | Composite health scores, dependency health tracking, automated remediation, SLI dashboards |
| **Security** | Zero-trust, managed identity everywhere, key rotation, WAF policies, threat modeling |
| **Operational procedures** | Automated runbooks, incident response playbooks, game days, postmortems |

See [Mission-Critical Reference](./references/mission-critical.md) for detailed guidance.

---

## AI Workload Design

AI workloads need the same pattern discipline as any distributed system, plus coordination approaches for nondeterministic, autonomous components. Design intelligent capabilities across five layers, each enforcing its own policies, identity, and caching:

| Layer | Responsibility |
|-------|----------------|
| **Client** | User interface and client applications; keep this layer thin |
| **Intelligence** | Routing, orchestration, and agent capabilities that coordinate AI operations |
| **Inferencing** | Model loading, runtime invocation, input/output pre- and postprocessing |
| **Knowledge** | Grounding data, retrieval services, and access policy enforcement for context |
| **Tools** | Business APIs and action capabilities the intelligence layer can invoke |

Key design considerations:

- **Multi-layer caching** — cache results and answers, retrieved grounding snippets, and intermediate model outputs. Scope cache keys by tenant/user identity, policy context, model version, and prompt version. Risks: data leakage, stale data, privacy violations.
- **Model routing** — route requests across models for availability or per-task quality. Use when the workload tolerates added variability and latency; avoid when deterministic behavior or fine-tuned models with narrow SLOs are required.
- **Grounding data design** — externalize grounding data to a search index rather than querying source systems directly; chunk to fit context windows; iterate on chunking and embeddings based on observed query patterns.
- **AI agent orchestration** — for multi-agent workloads, apply the dedicated [AI agent orchestration patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns).

For full guidance, see [Well-Architected Framework guidance for AI workloads](https://learn.microsoft.com/azure/well-architected/ai/).

---

## Well-Architected Framework (WAF) Pillars

Every architecture decision should be evaluated against all five pillars:

| Pillar | Focus | Key Questions |
|--------|-------|---------------|
| **Reliability** | Resiliency, availability, disaster recovery | What is the RTO/RPO? How does it handle failures? Is there redundancy? |
| **Security** | Threat protection, identity, data protection | Is identity managed? Is data encrypted? Are there network controls? |
| **Cost Optimization** | Cost management, efficiency, right-sizing | Is compute right-sized? Are there reserved instances? Is there waste? |
| **Operational Excellence** | Monitoring, deployment, automation | Is deployment automated? Is there observability? Are there runbooks? |
| **Performance Efficiency** | Scaling, load testing, performance targets | Can it scale horizontally? Are there performance baselines? Is caching used? |

### WAF Tradeoff Matrix

| Optimizing for... | May impact... |
|-------------------|---------------|
| Reliability (redundancy) | Cost (more resources) |
| Security (isolation) | Performance (added latency) |
| Cost (consolidation) | Reliability (shared failure domains) |
| Performance (caching) | Cost (cache infrastructure), Reliability (stale data) |

---

## Architecture Review Workflow

When reviewing or designing a system, follow this structured approach:

### Step 1: Identify Requirements

```
Functional: What must the system do?
Non-functional:
  - Availability target (e.g., 99.9%, 99.99%)
  - Latency requirements (p50, p95, p99)
  - Throughput (requests/sec, messages/sec)
  - Data residency and compliance
  - Recovery targets (RTO, RPO)
  - Cost constraints
```

### Step 2: Select Architecture Style

Match requirements to architecture style using the selection criteria table above.

### Step 3: Choose Technology Stack

Use the technology choices decision framework. Prefer managed services (PaaS) over IaaS.

### Step 4: Apply Design Patterns

Select relevant patterns from the 44 cloud design patterns based on identified concerns. Choose by problem statement, not technology, and accept each pattern's trade-offs consciously.

Perform [failure mode analysis](https://learn.microsoft.com/en-us/azure/architecture/resiliency/failure-mode-analysis/) on the resulting design: for each component, identify possible failure modes, their blast radius, and the detection and recovery response.

### Step 5: Address Cross-Cutting Concerns

- **Identity & access** — Microsoft Entra ID, managed identity, RBAC
- **Monitoring** — Application Insights, Azure Monitor, Log Analytics
- **Security** — Network segmentation, encryption at rest/in transit, Key Vault
- **CI/CD** — GitHub Actions, Azure DevOps Pipelines, infrastructure as code
- **AI workloads** — five-layer design (client, intelligence, inferencing, knowledge, tools), grounding data design, model routing trade-offs

### Step 6: Validate Against WAF Pillars

Review each pillar systematically. Document tradeoffs explicitly.

### Step 7: Document Decisions

Use Architecture Decision Records (ADRs):

```markdown
# ADR-NNN: [Decision Title]

## Status: [Proposed | Accepted | Deprecated]

## Context
[What is the issue we're addressing?]

## Decision
[What did we decide and why?]

## Consequences
[What are the positive and negative impacts?]
```

---

## References

- [Design Patterns Reference](./references/design-patterns.md) — Detailed pattern implementations
- [Technology Choices Reference](./references/technology-choices.md) — Decision trees for Azure services
- [Best Practices Reference](./references/best-practices.md) — Implementation guidance
- [Mission-Critical Reference](./references/mission-critical.md) — High-availability design
- [Design Principles Reference](./references/design-principles.md) — The ten design principles in depth
- [Architecture Styles Reference](./references/architecture-styles.md) — Architecture style comparisons
- [Performance Antipatterns Reference](./references/performance-antipatterns.md) — Detection and remediation

---

## Source

Content derived from the [Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/) — Microsoft's official guidance for cloud solution architecture on Azure. Covers design principles, architecture styles, cloud design patterns, technology choices, best practices, performance antipatterns, mission-critical design, and the Well-Architected Framework.
