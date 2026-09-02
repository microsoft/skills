# Cloud Design Patterns

A comprehensive reference of all 44 cloud design patterns from the Azure Architecture Center, organized by concern area and detailed with problem context, usage scenarios, WAF pillar alignment, and related patterns.

---

## Patterns by Concern

### Availability / Reliability

Circuit Breaker · Compensating Transaction · Health Endpoint Monitoring · Leader Election · Queue-Based Load Leveling · Retry · Saga · Scheduler Agent Supervisor · Sequential Convoy · Bulkhead · Rate Limiting · Idempotent Consumer

### Data Management

Cache-Aside · CQRS · Event Sourcing · Index Table · Materialized View · Sharding · Valet Key · Claim Check

### Design / Implementation

Ambassador · Anti-Corruption Layer · Backends for Frontends · Compute Resource Consolidation · Deployment Stamps · External Configuration Store · Gateway Aggregation · Gateway Offloading · Gateway Routing · Sidecar · Strangler Fig · Federated Identity

### Messaging

Asynchronous Request-Reply · Choreography · Claim Check · Competing Consumers · Idempotent Consumer · Messaging Bridge · Pipes and Filters · Priority Queue · Publisher/Subscriber · Queue-Based Load Leveling · Sequential Convoy

### Performance / Scalability

Cache-Aside · Geode · Throttling · Deployment Stamps · CQRS · Static Content Hosting

### Security

Gatekeeper · Quarantine · Valet Key · Federated Identity · Throttling

---

## Pattern Reference

### 1. Ambassador

**Create helper services that send network requests on behalf of a consumer service or application.**

**Problem:** Applications need common connectivity features such as monitoring, logging, routing, security (TLS), and resiliency patterns. Legacy or difficult-to-modify apps may not support these features natively. Network calls require substantial configuration for concerns such as circuit breaking, routing, metering, and telemetry.

**When to use:**

- You need a common set of client connectivity features across multiple languages or frameworks
- The connectivity concern is owned by infrastructure teams or another specialized team
- You need to reduce the age or complexity of legacy app networking without modifying source code
- You want to standardize observability and resiliency across polyglot services

**WAF Pillars:** Reliability, Security

**Related patterns:** Sidecar, Gateway Routing, Gateway Offloading

---

### 2. Anti-Corruption Layer

**Implement a façade or adapter layer between a modern application and a legacy system.**

**Problem:** During migration, the new system must often integrate with the legacy system's data model or API, which may use outdated schemas, protocols, or design conventions. Allowing the modern application to depend on legacy contracts contaminates its design and limits future evolution.

**When to use:**

- A migration is planned over multiple phases and the old and new systems must coexist
- The new system's domain model differs significantly from the legacy system
- You want to prevent legacy coupling from leaking into modern components
- Two bounded contexts (DDD) need to communicate but have incompatible models

**WAF Pillars:** Operational Excellence

**Related patterns:** Strangler Fig, Gateway Routing

---

### 3. Asynchronous Request-Reply

**Decouple backend processing from a frontend host, where backend processing needs to be asynchronous but the frontend still needs a clear response.**

**Problem:** In many architectures, the client expects an immediate acknowledgement while the actual work happens in the background. The client needs a way to learn the result of the background operation without holding a long-lived connection or repeatedly guessing when processing completes.

**When to use:**

- Backend processing may take seconds to minutes and the client should not block
- Client-side code such as a browser app cannot provide a callback endpoint
- You want to expose an HTTP API where the server initiates long-running work and the client polls for results
- You need an alternative to WebSocket or server-sent events for status updates

**WAF Pillars:** Performance Efficiency

**Related patterns:** Competing Consumers, Pipes and Filters, Queue-Based Load Leveling

---

### 4. Backends for Frontends

**Create separate backend services to be consumed by specific frontend applications or interfaces.**

**Problem:** A general-purpose backend API tends to accumulate conflicting requirements from different frontends (mobile, web, desktop, IoT). Over time the backend becomes bloated and changes for one frontend risk breaking another. Release cadences diverge and the single backend becomes a bottleneck.

**When to use:**

- A shared backend must be maintained with significant development overhead for multiple frontends
- You want to optimize each backend for the constraints of a specific client (bandwidth, latency, payload shape)
- Different frontend teams need independent release cycles for their backend logic
- A single backend would require complex, client-specific branching logic

**WAF Pillars:** Reliability, Security, Performance Efficiency

**Related patterns:** Gateway Aggregation, Gateway Offloading, Gateway Routing

---

### 5. Bulkhead

**Isolate elements of an application into pools so that if one fails, the others continue to function.**

**Problem:** A cloud-based application may call multiple downstream services. If a single downstream becomes slow or unresponsive, the caller's thread pool or connection pool can be exhausted, causing cascading failure that takes down unrelated functionality.

**When to use:**

- You need to protect critical consumers from failures in non-critical downstream dependencies
- A single noisy tenant or request type should not degrade service for others
- You want to limit the blast radius of a downstream fault
- The application calls multiple services with differing SLAs

**WAF Pillars:** Reliability, Security, Performance Efficiency

**Related patterns:** Circuit Breaker, Retry, Throttling, Queue-Based Load Leveling

---

### 6. Cache-Aside

**Load data on demand into a cache from a data store.**

**Problem:** Applications frequently read the same data from a data store. Repeated round trips increase latency and reduce throughput. Data stores may throttle or become expensive under high read loads.

**When to use:**

- The data store is read-heavy and the same data is requested frequently
- The data store does not natively provide caching
- Data can tolerate short periods of staleness
- You want to reduce cost and latency of repeated reads

**WAF Pillars:** Reliability, Performance Efficiency

**Related patterns:** Materialized View, Event Sourcing, CQRS

---

### 7. Choreography

**Have each component of the system participate in the decision-making process about the workflow of a business transaction, instead of relying on a central point of control.**

**Problem:** A central orchestrator can become a single point of failure, a performance bottleneck, or a source of tight coupling. Changes to the workflow require changes to the orchestrator, which may be owned by a different team.

**When to use:**

- Services are independently deployable and owned by separate teams
- The workflow changes frequently and a central orchestrator would become a maintenance burden
- You want to avoid a single point of failure in workflow coordination
- Services need loose coupling and can react to events

**WAF Pillars:** Operational Excellence, Performance Efficiency

**Related patterns:** Publisher/Subscriber, Saga, Competing Consumers

---

### 8. Circuit Breaker

**Handle faults that might take a variable amount of time to fix when connecting to a remote service or resource.**

**Problem:** Transient faults are handled by the Retry pattern, but when a downstream service is unavailable for an extended period, retries waste resources and block callers. Continuing to send requests to a failing service prevents it from recovering and wastes the caller's threads, connections, and compute.

**When to use:**

- A remote dependency experiences intermittent prolonged outages
- You need to fail fast rather than make callers wait for a timeout
- You want to give a failing downstream time to recover before sending more requests
- You want to surface degraded functionality instead of hard failures

**WAF Pillars:** Reliability, Performance Efficiency

**Related patterns:** Retry, Bulkhead, Health Endpoint Monitoring, Ambassador

---

### 9. Claim Check

**Split a large message into a claim check and payload to avoid overwhelming the messaging infrastructure.**

**Problem:** Message brokers and queues often have size limits and charge per message. Sending large payloads (images, documents, datasets) through the messaging channel wastes bandwidth, increases cost, and may hit transport limits.

**When to use:**

- The message payload exceeds the messaging system's size limit
- You want to reduce messaging costs by keeping message bodies small
- Not all consumers need the full payload; some only need metadata
- You need to protect sensitive payload data by separating access control from the messaging channel

**WAF Pillars:** Reliability, Security, Cost Optimization, Performance Efficiency

**Related patterns:** Competing Consumers, Pipes and Filters, Publisher/Subscriber

---

### 10. Compensating Transaction

**Undo the work performed by a series of steps, which together define an eventually consistent operation.**

**Problem:** In distributed systems, multi-step operations cannot rely on traditional ACID transactions. If a later step fails, the previous steps have already committed. The system needs a mechanism to reverse or compensate for the work done by the completed steps.

**When to use:**

- Multi-step operations span multiple services or data stores that do not share a transaction coordinator
- You need to maintain consistency when a step in a distributed workflow fails
- Rolling back is semantically meaningful (refund a charge, release a reservation)
- The cost of inconsistency outweighs the complexity of compensation logic

**WAF Pillars:** Reliability

**Related patterns:** Saga, Retry, Scheduler Agent Supervisor

---

### 11. Competing Consumers

**Enable multiple concurrent consumers to process messages received on the same messaging channel.**

**Problem:** At peak load, a single consumer cannot keep up with the volume of incoming messages. Messages queue up, latency increases, and the system may breach its SLAs.

**When to use:**

- The workload varies significantly and you need to scale message processing dynamically
- You require high availability—if one consumer fails, others continue processing
- Multiple messages are independent and can be processed in parallel
- You want to distribute work across multiple instances or nodes

**WAF Pillars:** Reliability, Cost Optimization, Performance Efficiency

**Related patterns:** Queue-Based Load Leveling, Priority Queue, Publisher/Subscriber, Pipes and Filters

---

### 12. Compute Resource Consolidation

**Consolidate multiple tasks or operations into a single computational unit.**

**Problem:** Deploying each small task or component as a separate service introduces operational overhead: more deployments, monitoring endpoints, and infrastructure cost. Many lightweight components are underutilized most of the time, wasting allocated compute.

**When to use:**

- Several lightweight processes have low CPU or memory usage individually
- You want to reduce deployment and operational overhead
- Processes share the same scaling profile and lifecycle
- Communication between tasks benefits from being in-process rather than over the network

**WAF Pillars:** Cost Optimization, Operational Excellence, Performance Efficiency

**Related patterns:** Sidecar, Backends for Frontends

---

### 13. CQRS (Command and Query Responsibility Segregation)

**Segregate operations that read data from operations that update data by using separate interfaces.**

**Problem:** In traditional CRUD architectures, the same data model is used for reads and writes. This creates tension: read models want denormalized, query-optimized shapes while write models want normalized, consistency-optimized shapes. As the system grows, the shared model becomes a compromise that serves neither concern well.

**When to use:**

- Read and write workloads are asymmetric (far more reads than writes, or vice versa)
- Read and write models have different schema requirements
- You want to scale read and write sides independently
- The domain benefits from an event-driven or task-based style rather than CRUD

**WAF Pillars:** Performance Efficiency

**Related patterns:** Event Sourcing, Materialized View, Cache-Aside

---

### 14. Deployment Stamps

**Deploy multiple independent copies of application components, including data stores.**

**Problem:** A single shared deployment for all tenants or regions creates coupling. A fault in one tenant's workload can affect all tenants. Regulatory requirements may mandate data residency. Scaling the entire deployment for a single tenant's spike is wasteful.

**When to use:**

- You need to isolate tenants for compliance, performance, or fault isolation
- Your application must serve multiple geographic regions with data residency requirements
- You need independent scaling per tenant group or region
- You want blue/green or canary deployments at the stamp level

**WAF Pillars:** Operational Excellence, Performance Efficiency

**Related patterns:** Geode, Sharding, Throttling

---

### 15. Event Sourcing

**Use an append-only store to record the full series of events that describe actions taken on data in a domain.**

**Problem:** Traditional CRUD stores only keep current state—history is lost. Audit, debugging, temporal queries, and replays are impossible without supplementary logging, which is often incomplete or out of sync.

**When to use:**

- You need a complete, immutable audit trail of all changes
- The business logic benefits from replaying or projecting events into different views
- You want to decouple the write model from the read model (often combined with CQRS)
- You need to reconstruct past states for debugging or regulatory purposes

**WAF Pillars:** Reliability, Performance Efficiency

**Related patterns:** CQRS, Materialized View, Compensating Transaction, Saga

---

### 16. External Configuration Store

**Move configuration information out of the application deployment package to a centralized location.**

**Problem:** Configuration files deployed alongside the application binary require redeployment to change. Different environments (dev, staging, prod) need different values. Sharing configuration across multiple services is difficult when each has its own config file.

**When to use:**

- Multiple services share common configuration settings
- You need to update configuration without redeploying or restarting services
- You want centralized access control and audit logging for configuration
- Configuration must differ across environments but be managed in a single system

**WAF Pillars:** Operational Excellence

**Related patterns:** Sidecar, Cache-Aside

---

### 17. Federated Identity

**Delegate authentication to an external identity provider.**

**Problem:** Building and maintaining your own identity store introduces security risks (password storage, credential rotation, MFA implementation). Users must manage separate credentials for each application, leading to password fatigue and weaker security posture.

**When to use:**

- Users already have identities in an enterprise directory or social provider
- You want to enable single sign-on (SSO) across multiple applications
- Business partners need to access your application with their own credentials
- You want to offload identity management (MFA, password policy) to a specialized provider

**WAF Pillars:** Reliability, Security, Performance Efficiency

**Related patterns:** Gatekeeper, Valet Key, Gateway Offloading

---

### 18. Gatekeeper

**Protect applications and services by using a dedicated host instance that acts as a broker between clients and the application or service.**

**Problem:** Services that expose public endpoints are vulnerable to malicious attacks. Placing validation, authentication, and sanitization logic inside the service mixes security concerns with business logic and increases the attack surface if the service is compromised.

**When to use:**

- Applications handle sensitive data or high-value transactions
- You need a centralized point for request validation and sanitization
- You want to limit the attack surface by isolating security checks from the trusted host
- Compliance requires an explicit security boundary between public and private tiers

**WAF Pillars:** Security

**Related patterns:** Valet Key, Gateway Routing, Gateway Offloading, Federated Identity

---

### 19. Gateway Aggregation

**Use a gateway to aggregate multiple individual requests into a single request.**

**Problem:** A client (especially mobile) may need data from multiple backend microservices to render a single page or view. Making many fine-grained calls from the client increases latency (multiple round trips), battery usage, and complexity. The client must understand the topology of the backend.

**When to use:**

- A client needs to make multiple calls to different backend services for a single operation
- Network latency between the client and backend is significant (mobile, IoT, remote clients)
- You want to reduce chattiness and simplify client code
- Backend services are fine-grained microservices and the client should not know their topology

**WAF Pillars:** Reliability, Security, Operational Excellence, Performance Efficiency

**Related patterns:** Backends for Frontends, Gateway Offloading, Gateway Routing

---

### 20. Gateway Offloading

**Offload shared or specialized service functionality to a gateway proxy.**

**Problem:** Cross-cutting concerns such as TLS termination, authentication, rate limiting, logging, and compression are duplicated across every service. Each team must implement, configure, and maintain these features independently, leading to inconsistency and wasted effort.

**When to use:**

- Multiple services share cross-cutting concerns (TLS, auth, rate limiting, logging)
- You want to standardize and centralize these features instead of duplicating them per service
- You need to reduce operational complexity for individual service teams
- The gateway is already in the request path and adding features there avoids extra hops

**WAF Pillars:** Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency

**Related patterns:** Gateway Aggregation, Gateway Routing, Sidecar, Ambassador

---

### 21. Gateway Routing

**Route requests to multiple services using a single endpoint.**

**Problem:** Clients must know the addresses of multiple services. Adding, removing, or relocating a service requires client updates. Exposing internal service topology increases coupling and complicates DNS and load balancing.

**When to use:**

- You want to expose multiple services behind a single URL with path- or header-based routing
- You need to decouple client URLs from the internal service topology
- You want to simplify client configuration and DNS management
- You need to support versioned APIs or blue/green routing at the gateway level

**WAF Pillars:** Reliability, Operational Excellence, Performance Efficiency

**Related patterns:** Gateway Aggregation, Gateway Offloading, Backends for Frontends

---

### 22. Geode

**Deploy backend services into a set of geographical nodes, each of which can service any client request in any region.**

**Problem:** Users across the globe experience high latency when all traffic routes to a single region. A single-region deployment also creates a single point of failure and cannot meet data residency requirements for multiple jurisdictions.

**When to use:**

- Users are globally distributed and expect low-latency access
- You need active-active multi-region availability
- Data residency or sovereignty requirements mandate regional deployment
- A single-region failure should not take down the service globally

**WAF Pillars:** Reliability, Performance Efficiency

**Related patterns:** Deployment Stamps, Sharding, Cache-Aside, Static Content Hosting

---

### 23. Health Endpoint Monitoring

**Implement functional checks in an application that external tools can access through exposed endpoints at regular intervals.**

**Problem:** Without health checks, failures are detected only when users report them. Load balancers, orchestrators, and monitoring systems need a programmatic way to determine whether an instance is healthy, ready to accept traffic, and functioning correctly.

**When to use:**

- You use a load balancer or orchestrator (Kubernetes, App Service) that needs liveness and readiness signals
- You want automated alerting when a service degrades
- You need to verify downstream dependencies (database, cache, third-party API) are reachable
- You want to enable self-healing by removing unhealthy instances from rotation

**WAF Pillars:** Reliability, Operational Excellence, Performance Efficiency

**Related patterns:** Circuit Breaker, Retry, Ambassador

---

### 24. Idempotent Consumer

**Design message consumers so that processing the same message more than once has the same effect as processing it once.**

**Problem:** Most message brokers guarantee at-least-once delivery. Duplicates arise from producer retries, redelivery after a missing acknowledgment, or consumer failures mid-processing. Exactly-once delivery is impractical to guarantee across a distributed system, so without duplicate resilience, reprocessing a message can create duplicate records, double-charge a customer, or have other unwanted effects.

**When to use:**

- You consume messages from a broker with at-least-once delivery (the default for most brokers)
- Reprocessing a message produces incorrect results, such as duplicate financial transactions, duplicate resource creation, or repeated notifications
- Multiple competing consumers process the same channel, making concurrent duplicate delivery likely
- The same unit of work can run more than once outside messaging too — scheduled jobs that overlap, webhook endpoints, ETL and stream replays resumed from a checkpoint

**Implementation notes:**

- Prefer naturally idempotent operations first (upserts keyed on a business identifier, absolute-value writes); add a deduplication store only for operations that can't be made naturally idempotent
- Key deduplication on a stable identifier that survives redelivery (Service Bus `MessageId`, CloudEvents `source` + `id`), not transport-level identifiers that change between duplicates
- Commit the deduplication marker and the business side effects in the same transaction (the *inbox pattern*), and guard concurrent duplicates with a unique constraint at the data store
- Retain deduplication records at least as long as the broker can redeliver the message, and propagate idempotency keys to downstream calls

**WAF Pillars:** Reliability

**Related patterns:** Competing Consumers, Retry, Queue-Based Load Leveling, Saga

---

### 25. Index Table

**Create indexes over the fields in data stores that are frequently referenced by queries.**

**Problem:** Many NoSQL stores support queries efficiently only on the primary or partition key. Queries on non-key fields result in full scans, which are slow and expensive at scale.

**When to use:**

- Queries frequently filter or sort on non-key attributes
- The data store does not support secondary indexes natively
- You want to trade additional storage and write overhead for faster reads
- Read performance on secondary fields is critical to the user experience

**WAF Pillars:** Reliability, Performance Efficiency

**Related patterns:** Materialized View, Sharding, CQRS

---

### 26. Leader Election

**Coordinate the actions performed by a collection of collaborating instances by electing one instance as the leader that assumes responsibility for managing the others.**

**Problem:** Multiple identical instances need to coordinate shared work (aggregation, scheduling, rebalancing). Without coordination, instances may duplicate effort, conflict, or corrupt shared state.

**When to use:**

- A group of peer instances needs exactly one to perform coordination tasks
- The leader must be automatically re-elected if it fails
- You want to avoid a statically assigned coordinator that becomes a single point of failure
- Distributed locks or consensus are needed for coordination

**WAF Pillars:** Reliability

**Related patterns:** Scheduler Agent Supervisor, Competing Consumers

---

### 27. Materialized View

**Generate prepopulated views over the data in one or more data stores when the data isn't ideally formatted for required query operations.**

**Problem:** The normalized storage schema that is optimal for writes is often suboptimal for complex read queries. Joins across tables or services are expensive, slow, and sometimes impossible in NoSQL stores.

**When to use:**

- Read queries require joining data across multiple stores or tables
- The read pattern is well-known and relatively stable
- You can tolerate a short delay between a write and its appearance in the view
- You want to offload complex query logic from the application tier

**WAF Pillars:** Performance Efficiency

**Related patterns:** CQRS, Event Sourcing, Index Table, Cache-Aside

---

### 28. Messaging Bridge

**Build an intermediary to enable communication between messaging systems that are otherwise incompatible, due to protocol, format, or infrastructure differences.**

**Problem:** Organizations may operate multiple messaging systems (RabbitMQ, Azure Service Bus, Kafka, legacy MQ). Applications bound to different brokers cannot exchange messages natively, creating data silos and duplicated effort.

**When to use:**

- You need to integrate systems that use different messaging protocols or brokers
- A migration from one messaging platform to another must be gradual
- You want to decouple producers and consumers from a specific messaging technology
- Interoperability between cloud and on-premises messaging is required

**WAF Pillars:** Cost Optimization, Operational Excellence

**Related patterns:** Anti-Corruption Layer, Publisher/Subscriber, Strangler Fig

---

### 29. Pipes and Filters

**Decompose a task that performs complex processing into a series of separate elements that can be reused.**

**Problem:** Monolithic processing pipelines are difficult to test, scale, and reuse. A single stage's failure brings down the entire pipeline. Different stages may have different scaling needs that cannot be addressed independently.

**When to use:**

- Processing can be broken into discrete, independent steps
- Different steps have different scaling or deployment requirements
- You want to reorder, add, or remove processing stages without rewriting the pipeline
- Individual steps should be independently testable and reusable

**WAF Pillars:** Reliability

**Related patterns:** Competing Consumers, Queue-Based Load Leveling, Choreography

---

### 30. Priority Queue

**Prioritize requests sent to services so that requests with a higher priority are received and processed more quickly than those with a lower priority.**

**Problem:** A standard FIFO queue treats all messages equally. High-priority messages (payment confirmations, alerts) wait behind low-priority messages (reports, analytics), degrading the experience for critical operations.

**When to use:**

- The system serves multiple clients or tenants with different SLAs
- Certain message types must be processed within tighter time bounds
- You need to guarantee that premium or critical workloads are not starved
- Different priorities map to different processing costs or deadlines

**WAF Pillars:** Reliability, Performance Efficiency

**Related patterns:** Competing Consumers, Queue-Based Load Leveling, Throttling

---

### 31. Publisher/Subscriber

**Enable an application to announce events to multiple interested consumers asynchronously, without coupling the senders to the receivers.**

**Problem:** A service that must notify multiple consumers directly becomes tightly coupled to each consumer. Adding a new consumer requires changing the producer. Synchronous calls from the producer to each consumer increase latency and reduce availability.

**When to use:**

- Multiple consumers need to react to the same event independently
- Producers and consumers should evolve independently
- You need to add new consumers without modifying the producer
- The system benefits from temporal decoupling (consumers process events at their own pace)

**WAF Pillars:** Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency

**Related patterns:** Choreography, Competing Consumers, Event Sourcing, Queue-Based Load Leveling

---

### 32. Quarantine

**Ensure external assets meet a team-agreed quality level before being authorized for consumption.**

**Problem:** External artifacts (container images, packages, data files, IaC modules) may contain vulnerabilities, malware, or misconfigurations. Consuming them without validation exposes the system to supply-chain attacks and compliance violations.

**When to use:**

- You consume third-party container images, packages, or libraries
- Compliance requires scanning artifacts before deployment
- You want to gate promotion of artifacts through quality tiers (untested → tested → approved)
- You need traceability for which version of an external asset is deployed

**WAF Pillars:** Security, Operational Excellence

**Related patterns:** Gatekeeper, Gateway Offloading, Pipes and Filters

---

### 33. Queue-Based Load Leveling

**Use a queue that acts as a buffer between a task and a service it invokes, to smooth intermittent heavy loads.**

**Problem:** Spikes in demand can overwhelm a service, causing throttling, errors, or outages. Over-provisioning to handle peak load wastes resources during normal periods.

**When to use:**

- The workload is bursty but the backend service scales slowly or is expensive to over-provision
- You need to decouple the rate at which work is submitted from the rate at which it is processed
- You want to flatten traffic spikes without losing requests
- Temporary unavailability of the backend should not result in data loss

**WAF Pillars:** Reliability, Cost Optimization, Performance Efficiency

**Related patterns:** Competing Consumers, Priority Queue, Throttling, Bulkhead

---

### 34. Rate Limiting

**Control the rate of requests a client or service can send to or receive from another service, to prevent overconsumption of resources.**

**Problem:** Without rate limiting, a misbehaving or compromised client can exhaust backend resources, causing service degradation for all consumers. Uncontrolled traffic can also trigger cloud provider throttling or incur excessive costs.

**When to use:**

- You need to protect shared resources from overconsumption
- You want to enforce fair usage across tenants or clients
- The backend has known capacity limits and you want to stay below them
- You need to prevent cascade failures caused by sudden traffic surges

**WAF Pillars:** Reliability

**Related patterns:** Throttling, Bulkhead, Circuit Breaker, Queue-Based Load Leveling

---

### 35. Retry

**Enable an application to handle anticipated, temporary failures when it tries to connect to a service or network resource, by transparently retrying a failed operation.**

**Problem:** Cloud environments experience transient faults—brief network glitches, service restarts, temporary throttling. If the application treats every failure as permanent, it unnecessarily degrades the user experience or triggers costly failovers.

**When to use:**

- The failure is likely transient (HTTP 429, 503, timeout)
- Retrying the same request is idempotent or safe
- You want to improve resilience without complex failover infrastructure
- The downstream service is expected to recover within a short window

**WAF Pillars:** Reliability

**Related patterns:** Circuit Breaker, Bulkhead, Ambassador, Health Endpoint Monitoring

---

### 36. Saga

**Manage data consistency across microservices in distributed transaction scenarios.**

**Problem:** Traditional distributed transactions (two-phase commit) are not feasible across microservices with independent databases. Without a coordination mechanism, partial failures leave the system in an inconsistent state.

**When to use:**

- A business operation spans multiple microservices, each with its own data store
- You need eventual consistency with well-defined compensating actions
- Two-phase commit is not available or would introduce unacceptable coupling
- Each step can be reversed by a compensating transaction

**WAF Pillars:** Reliability

**Related patterns:** Compensating Transaction, Choreography, Scheduler Agent Supervisor, Event Sourcing

---

### 37. Scheduler Agent Supervisor

**Coordinate a set of distributed actions as a single operation. If any of the actions fail, try to handle the failures transparently, or else undo the work that was performed.**

**Problem:** Distributed workflows involve multiple steps across different services. You need a way to track progress, detect failures, retry or compensate, and ensure the workflow reaches a terminal state.

**When to use:**

- A workflow spans multiple remote services that must be orchestrated
- You need centralized monitoring and control of workflow progress
- Failures should be retried or compensated automatically
- The workflow must guarantee completion or rollback

**WAF Pillars:** Reliability, Performance Efficiency

**Related patterns:** Saga, Compensating Transaction, Leader Election, Retry

---

### 38. Sequential Convoy

**Process a set of related messages in a defined order, without blocking processing of other groups of messages.**

**Problem:** Message ordering is required within a logical group (e.g., all events for a single order), but a strict global order would serialize the entire system and destroy throughput. Different groups are independent and can be processed in parallel.

**When to use:**

- Messages within a group must be processed in order (e.g., order events, session events)
- Different groups can be processed concurrently
- Out-of-order processing within a group would cause data corruption or incorrect results
- You need high throughput across groups while preserving per-group ordering

**WAF Pillars:** Reliability

**Related patterns:** Competing Consumers, Priority Queue, Queue-Based Load Leveling

---

### 39. Sharding

**Divide a data store into a set of horizontal partitions or shards.**

**Problem:** A single database server has finite storage, compute, and I/O capacity. As data volume and query load grow, vertical scaling becomes prohibitively expensive or hits hardware limits. A single server is also a single point of failure.

**When to use:**

- A single data store cannot handle the storage or throughput requirements
- You need to distribute data geographically for latency or compliance
- You want to scale horizontally by adding more nodes
- Different subsets of data have different access patterns or SLAs

**WAF Pillars:** Reliability, Cost Optimization

**Related patterns:** Index Table, Materialized View, Geode, Deployment Stamps

---

### 40. Sidecar

**Deploy components of an application into a separate process or container to provide isolation and encapsulation.**

**Problem:** Applications need cross-cutting functionality (logging, monitoring, configuration, networking). Embedding these directly into the application creates tight coupling, language lock-in, and shared failure domains.

**When to use:**

- The cross-cutting component must run alongside the main application but in isolation
- The main application and the sidecar can be developed in different languages
- You want to extend or add functionality without modifying the main application
- The sidecar has a different lifecycle or scaling requirement than the main application

**WAF Pillars:** Security, Operational Excellence

**Related patterns:** Ambassador, Gateway Offloading, Compute Resource Consolidation

---

### 41. Static Content Hosting

**Deploy static content to a cloud-based storage service that can deliver them directly to the client.**

**Problem:** Serving static files (images, scripts, stylesheets, documents) from the application server wastes compute that should be reserved for dynamic content. It also limits scalability and increases cost.

**When to use:**

- The application serves static files that do not change per request
- You want to reduce the load on your web servers
- A CDN can accelerate delivery to geographically distributed users
- You want cost-effective, highly available static file hosting

**WAF Pillars:** Cost Optimization

**Related patterns:** Valet Key, Geode, Cache-Aside

---

### 42. Strangler Fig

**Incrementally migrate a legacy system by gradually replacing specific pieces of functionality with new applications and services.**

**Problem:** Rewriting a large legacy system from scratch is risky, expensive, and often fails. The legacy system must continue operating during the migration. A big-bang cutover is not feasible due to risk and business continuity requirements.

**When to use:**

- You are replacing a monolithic legacy application incrementally
- You need the old and new systems to coexist during migration
- You want to reduce migration risk by delivering value incrementally
- The legacy system is too large or complex for a single-phase replacement

**WAF Pillars:** Reliability, Cost Optimization, Operational Excellence

**Related patterns:** Anti-Corruption Layer, Gateway Routing, Sidecar

---

### 43. Throttling

**Control the consumption of resources used by an instance of an application, an individual tenant, or an entire service.**

**Problem:** Sudden spikes in demand or a misbehaving tenant can exhaust shared resources, degrading the experience for all users. Over-provisioning to handle worst-case load is expensive and wasteful.

**When to use:**

- You need to enforce SLAs or quotas per tenant in a multi-tenant system
- The backend has known capacity limits and exceeding them causes instability
- You want to degrade gracefully under load rather than fail entirely
- You need to prevent a single workload from monopolizing shared resources

**WAF Pillars:** Reliability, Security, Cost Optimization, Performance Efficiency

**Related patterns:** Rate Limiting, Bulkhead, Queue-Based Load Leveling, Priority Queue

---

### 44. Valet Key

**Use a token or key that provides clients with restricted direct access to a specific resource or service.**

**Problem:** Routing all data transfers through the application server creates a bottleneck and increases cost. Giving clients direct access to the data store without any restriction is a security risk.

**When to use:**

- You want to minimize the load on the application server for data-intensive transfers (uploads/downloads)
- You need to grant time-limited, scope-limited access to a specific resource
- You want to offload transfer bandwidth to a storage service (Blob Storage, S3)
- Clients need temporary access without full credentials to the data store

**WAF Pillars:** Security, Cost Optimization, Performance Efficiency

**Related patterns:** Gatekeeper, Static Content Hosting, Federated Identity

---

> Source: [Azure Architecture Center — Cloud Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/)
