# Cloud Solution Architect Acceptance Criteria

**Skill**: `cloud-solution-architect`
**Purpose**: Produce architecture reviews, design pattern recommendations, and technology decisions aligned with Azure Well-Architected Framework
**Focus**: WAF pillar alignment, design patterns, technology justification, mission-critical design, performance antipatterns, ADRs

---

## 1. Architecture Review and WAF Pillar Alignment

### 1.1 ✅ CORRECT: Recommendations Mapped to All 5 WAF Pillars

```markdown
## Architecture Review: Order Processing System

### WAF Pillar: Reliability
- **Finding**: Single database instance without failover
- **Pattern**: Deploy Geode pattern for multi-region data
- **Recommendation**: Enable Azure SQL geo-replication
- **Impact**: Improves RTO from hours to minutes

### WAF Pillar: Security
- **Finding**: API keys stored in application config
- **Pattern**: External Configuration Store pattern
- **Recommendation**: Migrate secrets to Azure Key Vault with managed identity
- **Impact**: Eliminates credential exposure risk

### WAF Pillar: Cost Optimization
- **Finding**: Over-provisioned VMs running at 15% utilization
- **Pattern**: Queue-Based Load Leveling pattern
- **Recommendation**: Replace dedicated VMs with Azure Container Apps with scale-to-zero
- **Impact**: Estimated 60% cost reduction

### WAF Pillar: Operational Excellence
- **Finding**: No automated deployment pipeline
- **Pattern**: Deployment Stamps pattern
- **Recommendation**: Implement Azure DevOps pipelines with staged rollouts
- **Impact**: Reduces deployment errors and enables rollback

### WAF Pillar: Performance Efficiency
- **Finding**: Synchronous API calls to downstream services
- **Pattern**: Async Request-Reply pattern
- **Recommendation**: Introduce Azure Service Bus for async processing
- **Impact**: Reduces P99 latency from 5s to 200ms
```

### 1.2 ✅ CORRECT: Recommendations Include Specific Azure Services and Design Patterns

```markdown
### Finding: Tight coupling between order and payment services

- **WAF Pillar**: Reliability
- **Pattern**: [Choreography pattern](https://learn.microsoft.com/azure/architecture/patterns/choreography)
- **Azure Services**: Azure Service Bus, Azure Event Grid
- **Design**: Publish OrderCreated event → Payment service subscribes and processes independently
- **Fallback**: Dead-letter queue with retry policy for failed payments
```

### 1.3 ❌ INCORRECT: Generic Advice Without WAF Pillar Mapping

```markdown
## Architecture Review

- Consider using caching
- Add monitoring
- Use managed services
- Improve security
```

### 1.4 ❌ INCORRECT: Recommendations Not Tied to Specific Design Patterns

```markdown
### Finding: Database is slow

- **Recommendation**: Make the database faster
- **Impact**: Better performance
```

---

## 2. Design Pattern Selection

### 2.1 ✅ CORRECT: Pattern Selected Matches Problem Context with Justification

```markdown
### Pattern Decision: Inter-Service Communication

**Problem Context**: 5 microservices need to coordinate order fulfillment
with varying processing times (100ms to 30s). Services must remain
independently deployable and failures must not cascade.

**Selected Pattern**: Choreography via Event-Driven Architecture

**Justification**:
- Services have different processing times → async decoupling required
- No single orchestrator needed → reduces single point of failure
- Teams own services independently → choreography respects team boundaries

**Rejected Alternative**: Orchestrator pattern
- Would create central dependency and bottleneck
- Harder to scale orchestrator for 10k+ orders/sec
```

### 2.2 ✅ CORRECT: Trade-offs Documented Between Alternative Patterns

```markdown
### Pattern Comparison: Data Consistency

| Criteria | Saga (Choreography) | Saga (Orchestration) | 2PC |
|----------|---------------------|----------------------|-----|
| Consistency | Eventual | Eventual | Strong |
| Coupling | Low | Medium | High |
| Complexity | Medium | Medium | Low (but rigid) |
| Failure handling | Compensating events | Central coordinator | Automatic rollback |
| Scalability | High | Medium | Low |
| **Fit for context** | ✅ Best fit | ⚠️ Acceptable | ❌ Poor fit |

**Decision**: Saga with Choreography — aligns with existing event-driven
architecture and team autonomy requirements.
```

### 2.3 ❌ INCORRECT: Pattern Chosen Without Considering Problem Constraints

```markdown
### Pattern: CQRS

Use CQRS for the application.
```

### 2.4 ❌ INCORRECT: Applying Patterns That Don't Fit the Problem Domain

```markdown
### Pattern: Event Sourcing

Implement event sourcing for the static content website to track all
changes to HTML pages.
```

---

## 3. Technology Choice Justification

### 3.1 ✅ CORRECT: Technology Choices Justified with Comparison Table

```markdown
### Technology Decision: Message Broker

**Requirements**: 10k msgs/sec, at-least-once delivery, <100ms latency,
.NET SDK support, managed service preferred.

| Criteria | Azure Service Bus | Azure Event Hubs | Azure Queue Storage |
|----------|-------------------|------------------|---------------------|
| Throughput | 1M msgs/sec (premium) | Millions/sec | 20k msgs/sec |
| Ordering | FIFO (sessions) | Per-partition | None |
| Max message size | 256KB–100MB | 1MB | 64KB |
| Dead-letter support | ✅ Built-in | ❌ Manual | ❌ Manual |
| Cost (estimated/mo) | ~$670 | ~$220 | ~$5 |
| Team experience | Medium | Low | High |

**Decision**: Azure Service Bus Premium
- Dead-letter support critical for payment reliability
- FIFO sessions needed for order sequencing
- Cost justified by reduced operational complexity
```

### 3.2 ✅ CORRECT: Decision Considers Scale, Cost, Complexity, and Team Skills

```markdown
### Technology Decision: Container Orchestration

**Scale**: 20 microservices, 3 environments, ~500 pods peak
**Team skills**: 2 engineers with Kubernetes experience, 6 with App Service
**Budget**: $15k/month compute

**Decision**: Azure Container Apps (not AKS)
- Team lacks deep K8s expertise → ACA reduces operational burden
- Scale requirements fit ACA limits (300 replicas per app)
- KEDA-based autoscaling meets event-driven needs
- Saves ~$3k/month vs equivalent AKS cluster
- Migration path to AKS exists if requirements grow
```

### 3.3 ❌ INCORRECT: Technology Selected Without Comparison to Alternatives

```markdown
### Technology Decision

Use Kubernetes for containers.
```

### 3.4 ❌ INCORRECT: Choosing Most Complex Option Without Justification

```markdown
### Technology Decision

Deploy AKS with Istio service mesh, Dapr sidecars, and custom operators
for a 3-service application with 100 requests per minute.
```

---

## 4. Mission-Critical Design

### 4.1 ✅ CORRECT: Design Addresses All 8 Design Areas

```markdown
## Mission-Critical Assessment: Payment Platform

**SLO Target**: 99.99% availability (≤4.32 min downtime/month)

### 1. Application Platform
- AKS multi-region (East US + West US) with availability zones
- Node auto-scaling: 3–20 nodes per region

### 2. Application Design
- Stateless services with external state in Cosmos DB
- Circuit breaker on all downstream calls (Polly)
- Bulkhead isolation between payment providers

### 3. Networking
- Azure Front Door with health probes per region
- Private endpoints for all data services
- DDoS Protection Standard enabled

### 4. Data Platform
- Cosmos DB multi-region write with strong consistency
- Automated backups every 4 hours, PITR enabled
- Read replicas in 3 regions

### 5. Deployment and Testing
- Blue-green deployment via Azure Front Door traffic shifting
- Canary releases: 5% → 25% → 100% over 2 hours
- Chaos engineering: monthly failure injection tests

### 6. Health Modeling
- Composite health score: infrastructure + dependency + application metrics
- Azure Monitor with custom health model dashboard
- Automated alerting at degraded/unhealthy thresholds

### 7. Security
- Zero Trust: verify explicitly, least privilege, assume breach
- Managed identities for all service-to-service auth
- WAF policies on Front Door

### 8. Operational Procedures
- Runbooks for top 10 failure scenarios
- Automated failover tested quarterly
- On-call rotation with 15-minute response SLA
```

### 4.2 ✅ CORRECT: SLO Target Explicitly Stated with Redundancy Strategy

```markdown
### Availability Design

| Component | SLA | Redundancy | Failover |
|-----------|-----|------------|----------|
| Azure Front Door | 99.99% | Global | Automatic |
| AKS | 99.95% | AZ-redundant | Pod rescheduling |
| Cosmos DB | 99.999% | Multi-region write | Automatic |
| Key Vault | 99.99% | AZ-redundant | Automatic |

**Composite SLO**: 99.95% × 99.99% × 99.999% × 99.99% = ~99.93%
**Target SLO**: 99.95% → Add regional AKS failover to close gap
```

### 4.3 ❌ INCORRECT: Missing Design Areas in Mission-Critical Review

```markdown
## Mission-Critical Assessment

- Use multi-region deployment
- Add monitoring
- Enable autoscaling
```

### 4.4 ❌ INCORRECT: No Health Modeling or Observability Strategy

```markdown
## Mission-Critical Assessment

### Compute
- Deploy to two regions

### Data
- Use Cosmos DB

(No health modeling, security, operational procedures, or deployment strategy)
```

---

## 5. Performance Antipattern Identification

### 5.1 ✅ CORRECT: Antipatterns Identified with Specific Remediation Steps

```markdown
## Performance Antipattern: Chatty I/O

**Detection**: Application Insights shows 47 SQL queries per API request
to `/api/orders/{id}` endpoint, averaging 1.2s total.

**Metrics**:
- Dependency calls per request: 47 (target: <5)
- P95 latency: 2.1s (target: <200ms)

**Root cause**: N+1 query pattern — loading order, then iterating line
items and loading each product individually.

**Remediation**:
1. Replace individual queries with batch query using `WHERE IN` clause
2. Add projection to return only needed columns
3. Implement response caching with 30s TTL for product data

**Expected improvement**: 47 queries → 2 queries, latency 2.1s → ~150ms
```

### 5.2 ✅ CORRECT: Detection Method and Metrics Defined for Each Antipattern

```markdown
## Performance Antipattern: No Caching

**Detection method**: Azure Monitor → API response times + database DTU
**Key metrics**:
- Cache hit ratio: 0% (no cache exists)
- Database DTU: 85% sustained (threshold: 70%)
- Identical query ratio: 62% of queries return same data within 60s

**Remediation**:
1. Add Azure Cache for Redis (Standard C1)
2. Cache product catalog (TTL: 5 min)
3. Cache user sessions (TTL: 30 min)
4. Implement cache-aside pattern with fallback to database

**Monitoring after fix**:
- Track cache hit ratio (target: >80%)
- Monitor Redis memory usage and evictions
```

### 5.3 ❌ INCORRECT: Antipattern Identified Without Remediation Guidance

```markdown
## Performance Issue

The application has a chatty I/O problem. Too many database calls.
```

### 5.4 ❌ INCORRECT: Generic Performance Advice Without Specific Antipattern Analysis

```markdown
## Performance Review

- Add caching
- Use async
- Scale up the database
- Optimize queries
```

---

## 6. Architecture Decision Records

### 6.1 ✅ CORRECT: Decisions Documented with Context, Options, Rationale, and Consequences

```markdown
## ADR-003: Use Azure Cosmos DB for Order Data

**Status**: Accepted
**Date**: 2024-03-15
**Deciders**: Platform team, Product engineering

### Context
Order service needs a database supporting:
- Multi-region writes for <50ms latency globally
- Automatic scaling from 100 to 50,000 RU/s
- Document model for flexible order schemas
- 99.999% availability SLA for payment-critical data

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Azure SQL | Strong consistency, familiar | Single-region write, fixed schema |
| Cosmos DB | Multi-region, flexible schema, SLA | Cost at scale, eventual consistency default |
| PostgreSQL Flexible | Open source, cost-effective | Manual geo-replication, no SLA match |

### Decision
Azure Cosmos DB with NoSQL API and session consistency.

### Rationale
- Only service offering 99.999% SLA with multi-region writes
- Session consistency balances performance and user experience
- Auto-scale RU/s matches unpredictable order volume patterns
- Document model accommodates evolving order schema without migrations

### Consequences
- **Positive**: Global low-latency reads/writes, managed scaling
- **Negative**: Higher cost (~$2k/month vs ~$500 for SQL), team needs Cosmos DB training
- **Risks**: Partition key design errors can cause hot partitions — mitigate with design review
```

### 6.2 ❌ INCORRECT: Architecture Decisions Without Documented Rationale

```markdown
## Decision

We will use Cosmos DB for orders.
```

---

## 7. AI Workload Design

### 7.1 ✅ CORRECT: AI Workload Designed Across the Five Layers with Grounding and Routing Decisions

```markdown
## AI Workload Design: Enterprise Assistant

**Client**: Thin Teams/web front end; capabilities delegated to backend layers.

**Intelligence**: Orchestrator with model routing — small fast model for
simple queries, escalation to a larger model on low confidence.

**Inferencing**: Model deployments with runtime invocation and prompt/
completion pre- and postprocessing.

**Knowledge**: Search index over approved documents; retrieval enforces
per-user authorization; chunking iterated against observed queries.

**Tools**: Ticketing and HR APIs behind standardized, policy-enforced
interfaces.

**Caching**: Grounded answers cached with keys scoped by user identity,
model version, and prompt version; TTL by data freshness; no cross-user
caching of private answers.

**Routing decision**: Model routing tolerated for broad Q&A; single model
pinned where deterministic behavior or narrow SLOs are required.
```

### 7.2 ❌ INCORRECT: AI Advice Without Layering, Grounding, or Routing Considerations

```markdown
## AI Design

- Use GPT-4 for everything
- Add a vector database
- Fine-tune on your documents
```

---

## 8. Anti-Patterns Summary

| Anti-Pattern | Impact | Fix |
|--------------|--------|-----|
| No WAF mapping | Incomplete review, missed pillars | Map each recommendation to a WAF pillar |
| Wrong pattern | Mismatched solution to problem | Validate pattern against problem constraints |
| No tradeoff analysis | Uninformed decisions | Compare alternatives systematically |
| Missing design areas | Gaps in mission-critical review | Use 8-area checklist for coverage |
| No remediation | Unactionable findings | Include specific fix steps for each antipattern |
| No ADR rationale | Undocumented decisions erode over time | Record context, options, and consequences |

---

## 9. Checklist for Architecture Review

- [ ] Architecture review maps to all 5 WAF pillars
- [ ] Design patterns selected with problem context justification
- [ ] Technology choices include comparison and tradeoff analysis
- [ ] Mission-critical designs address all 8 design areas
- [ ] Performance antipatterns identified with specific remediation
- [ ] Architecture decisions documented with rationale
- [ ] SLO/SLA targets explicitly stated
- [ ] Health modeling strategy defined
- [ ] Deployment strategy includes zero-downtime approach
- [ ] Security follows Zero Trust model
- [ ] AI workloads address the five layers, grounding, and model routing
