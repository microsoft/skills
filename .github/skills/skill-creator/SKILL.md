---
name: skill-creator
description: Design, structure, validate, and regenerate modular AI coding agent skills for Azure SDKs, Microsoft Foundry services, and domain workflows when creating or updating repository skills, isolated from direct application runtime execution.
---

# Skill Creator Specification

Construct, categorize, validate, and refresh modular knowledge skills that extend AI coding agent capabilities across Azure SDKs, Microsoft Foundry services, and domain-specific workflows.

## Domain Architecture & Core Mechanisms

### Modular Skill Components

Structure each skill package across four functional layers:

1. **Procedural knowledge** — Multi-step execution workflows for specialized domains.
2. **SDK expertise** — Client initialization, authentication lifecycles, and error-handling patterns for Azure services.
3. **Domain context** — Schemas, business logic, and repository-specific conventions.
4. **Bundled resources** — Executable scripts, deep-dive reference documentation, and output templates.

### Conflict Resolution Hierarchy

Resolve competing authoring requirements in descending priority order:

`Authoritative API Surface Contract (Microsoft Learn / Upstream SDK Repository / crates.io) > Language-Specific Authentication & Resource Lifecycle Rules > Token Budget (~1100 target / 1500 max) & 500-Line Ceiling > Hero & Non-Hero Scenario Coverage > Legacy Compatibility Shortcuts`

### Required Input Gate & Authoritative Sources

Require the user to supply the target SDK context prior to generating an SDK or API skill:

| Required Input | Example | Operational Purpose |
| :--- | :--- | :--- |
| **SDK Package** | `azure-ai-agents`, `Azure.AI.OpenAI`, `azblob` | Identifies the exact target SDK package |
| **Documentation URL** | `[https://learn.microsoft.com/en-us/azure/ai-services/](https://learn.microsoft.com/en-us/azure/ai-services/)...` | Establishes the primary source of truth |
| **Repository** (optional) | `Azure/azure-sdk-for-python`, `Azure/azure-sdk-for-go` | Supplies idiomatic source code patterns |

Request missing context parameters from the user using the following prompt template:

```
To create this skill, I need:
1. The SDK package name (e.g., azure-ai-projects)
2. The Microsoft Learn documentation URL or GitHub repo
3. The target language (py/dotnet/ts/java/go)
```

Verify current API signatures against authoritative upstream sources prior to authoring or regenerating code snippets:

- **Python, .NET, Java, TypeScript, Go**: Treat current Microsoft Learn package documentation (queried via `microsoft-docs` MCP) and official SDK repositories (`[https://github.com/Azure/azure-sdk-for-](https://github.com/Azure/azure-sdk-for-)<language>`) as the authoritative API contract.
- **Go Package Sources**: Use `[https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/](https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/)<service>/<module>/README.md` and `[https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/](https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/)<service>/<module>/` for canonical Go documentation and examples.
- **Rust Package Sources**: Treat the official SDK repository (`[https://github.com/Azure/azure-sdk-for-rust](https://github.com/Azure/azure-sdk-for-rust)`), crate README (`[https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/](https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/)<service>/<crate>/README.md`), crate examples (`[https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/](https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/)<service>/<crate>/examples/`), and [crates.io](https://crates.io/) documentation as the authoritative contract, as Rust packages lack Microsoft Learn API-reference pages.

Include the pre-implementation verification instruction in domain and SDK workflows:

```markdown
## Before Implementation

Search `microsoft-docs` MCP for current API patterns:

- Query: "[SDK name] [operation] python"
- Verify: Parameters match your installed SDK version
```

```bash
# Use microsoft-docs MCP to get current API patterns
# Query: "[SDK name] [operation] [language]"
# Verify: Parameters match the latest SDK version
```

### Specificity Calibration & Progressive Disclosure

Calibrate instruction specificity to match task execution constraints:

| Freedom | Operational Condition | Representation Format |
| :--- | :--- | :--- |
| **High** | Multiple valid implementation approaches exist | Text guidelines |
| **Medium** | Preferred pattern allows parameter variation | Pseudocode |
| **Low** | Execution requires exact determinism | Specific scripts |

Distribute skill content across three progressive loading tiers:

1. **Metadata** (`~100 words`; `description` target `~200 chars`, schema ceiling `1,024 chars`) — Loaded continuously in context; specifies operational capabilities and trigger phrases.
2. **SKILL.md body** (`<5k words`, `<500 lines`; Azure SDK target `~1100 tokens`, ceiling `~1500 tokens`) — Loaded upon skill activation; contains delta domain knowledge and primary workflows, isolated from base knowledge already present in foundation models.
3. **References** (unlimited capacity, structured one directory level deep under `references/`) — Loaded on demand for advanced or low-frequency patterns.

---

## Package Architecture & Resource Allocation

### Directory Layout & Bundled Resources

Organize each skill package using the standard directory hierarchy:

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/      — Executable code
    ├── references/   — Documentation loaded as needed
    └── assets/       — Output resources (templates, images)
```

Allocate optional bundled resources according to reuse and complexity criteria:

| Resource Type | Inclusion Condition | Concrete Examples |
| :--- | :--- | :--- |
| `scripts/` | Reused executable code patterns | Auth setup, CLI scripts |
| `references/` | Feature deep-dives and overflow examples | `capabilities.md` index, `non-hero-scenarios.md`, API docs |
| `assets/` | Output templates and static files | Boilerplate code, images |

### Token Budget Allocation

Enforce the following section-level and total token limits for each Azure SDK `SKILL.md` file:

| Section | Target | Absolute Max |
| :--- | :--- | :--- |
| Installation + Env Vars | 100 tokens | 150 |
| Authentication & Lifecycle | 200 tokens | 300 |
| Core Workflow (1 example) | 300 tokens | 400 |
| Feature Tables | 200 tokens | 300 |
| Best Practices (6-8 items) | 200 tokens | 250 |
| References (reference/ links) | 100 tokens | 150 |
| **Total SKILL.md** | **~1100 tokens** | **~1500 tokens** |

Refactor overflow content into `/references/` subdirectories whenever a section exceeds its maximum token limit or `SKILL.md` approaches 500 lines. Insert the token count annotation immediately below the H1 heading of `SKILL.md`:

```markdown
<!-- Token Count: ~XXXX (target: 1100, max: 1500) -->
```

```markdown
# Azure Service SDK

<!-- Token Count: ~1180 (target: 1100, max: 1500) -->
```

### Reference Extraction Rules & Progressive Disclosure Patterns

Partition content between `SKILL.md` and `/references/` using quantitative usage and complexity signals:

| Signal | Move to `/references/` | Keep in `SKILL.md` |
| :--- | :--- | :--- |
| Use frequency | `<20%` of typical use | `~80%+` of workflows |
| Cognitive load | Advanced patterns, multiple options | Single happy path |
| Example length | `>10` lines, multiple paths | `1-5` lines, single path |

Map recurring implementation tasks and specialized topics to designated target locations:

- Repeated authentication setup ➔ Code example in `SKILL.md`
- Batch operations ➔ `/references/batch-operations.md`
- Error handling (beyond basic `try-except`) ➔ `/references/error-handling.md`
- Performance tuning ➔ `/references/performance.md`
- Alternative workflows ➔ `/references/workflows-comparison.md`
- Streaming and event handling ➔ `/references/streaming.md`
- Advanced authentication strategies ➔ `/references/auth-strategies.md`
- Tool configurations and integrations ➔ `/references/tools.md`
- Breaking changes and version upgrades ➔ `/references/migration.md`
- Hero scenario index and deep-dive links (isolated from historical or migration narration) ➔ `references/capabilities.md`
- Concrete non-hero examples (update/patch, delete/cleanup, export/import, advanced auth mode, paging/filtering, retries/error handling, LRO monitoring) ➔ `references/non-hero-scenarios.md`

Apply one of three progressive disclosure layouts based on skill scope:

- **Pattern A — High-Level Guide with References**:

```markdown
# SDK Name

## Quick Start

[Minimal example]

## Advanced Features

- **Streaming**: See [references/streaming.md](references/streaming.md)
- **Tools**: See [references/tools.md](references/tools.md)
```

- **Pattern B — Multi-Language Variants**:

```
azure-service-skill/
├── SKILL.md (overview + language selection)
└── references/
    ├── python.md
    ├── dotnet.md
    ├── go.md
    ├── java.md
    └── typescript.md
```

- **Pattern C — Feature Organization**:

```
azure-ai-agents/
├── SKILL.md (core workflow)
└── references/
    ├── tools.md
    ├── streaming.md
    ├── async-patterns.md
    └── error-handling.md
```

Consult shared design pattern references when structuring complex workflows:

| Reference | Contents |
| :--- | :--- |
| `references/workflows.md` | Sequential and conditional workflows |
| `references/output-patterns.md` | Templates and examples |
| `references/azure-sdk-patterns.md` | Language-specific Azure SDK patterns |

### Core Workflow Selection Discipline

Classify and document core workflows in `SKILL.md` according to usage distribution:

- **Case 1 — Single Dominant Core Workflow** (`~80%` of use cases):
  1. Designate the dominant pattern as the core workflow.
  2. Present 1 complete, runnable example for this workflow in `SKILL.md` (for Python SDKs supporting sync and async clients, paired `### Sync` and `### Async` examples for the same workflow count as 1 workflow).
  3. Extract secondary workflows into `/references/` (`/references/batch-operations.md`, `/references/error-handling.md`, `/references/performance.md`, `/references/workflows-comparison.md`).
  + *Anchor*: Azure Key Vault Secrets — document secret retrieval via managed identity in `SKILL.md`; place local development with `DefaultAzureCredential`, workload identity, and service-principal credentials (client secret or certificate) in `/references/`.
- **Case 2 — Multiple Equally Valid Core Workflows** (e.g., authentication strategies, deployment targets):
  1. Include each hero scenario directly in `SKILL.md` as a first-class workflow.
  2. Provide 1 complete, runnable example per hero scenario in `SKILL.md`.
  3. Allocate trade-off matrices, secondary variations, and extended context to `/references/workflows-comparison.md`.
  + *Anchor*: Azure Identity SDK — document primary local-development and production-safe credential flows in `SKILL.md`; place detailed comparisons across `AzureCliCredential`, workload identity, service principal variants, and secondary credentials in `/references/credential-types.md`.
- **Classification Criterion**: Assign an alternative approach to `SKILL.md` as a co-equal hero scenario when developers selecting that path would evaluate its omission from the primary guide as a defect; otherwise summarize and link to `/references/`.

---

## Azure SDK Skill Structure & Language Specifications

### Standard Section Order

Organize every Azure SDK `SKILL.md` in the following 8-section sequence:

1. **Title** — `# SDK Name` followed immediately by the token count HTML comment.
2. **Installation** — Package manager command (`pip install`, `npm install`, `cargo add`, etc.).
3. **Environment Variables** — Required configuration variables with inline comments specifying when each variable applies; include `AZURE_TOKEN_CREDENTIALS` (set to `prod` or `<specific_credential>`) when using `DefaultAzureCredential` in production.
4. **Authentication & Lifecycle** — Local development (`DefaultAzureCredential`, or `DeveloperToolsCredential` for Rust) and production authentication (`AZURE_TOKEN_CREDENTIALS=prod`, `ManagedIdentityCredential`, or `WorkloadIdentityCredential`) paired with deterministic client resource cleanup.
5. **Core Workflow** — Minimal viable, runnable example demonstrating CRUD or primary operations and resource cleanup.
6. **Feature Tables** — Concise tables covering `3-5` core methods, clients, or tools; for management or broad SDKs, include an operation-group table indicating which groups have inline snippets versus reference links.
7. **Best Practices** — Numbered list (`6-8` items) opening with mandatory language-specific rules and restricting examples to a maximum of 1 snippet per item.
8. **Reference Links** — Table linking to `/references/*.md`, including `references/capabilities.md` and `references/non-hero-scenarios.md` for Azure SDK skills.

### Python Authentication & Lifecycle Callout

Open the `## Authentication & Lifecycle` section of every Python Azure SDK skill (`-py` suffix) with the following block **verbatim** prior to any code sample:

```markdown
## Authentication & Lifecycle

> **🔑 Two rules apply to every code sample below:**
>
> 1. **Prefer `DefaultAzureCredential` for local development.** It works as-is with Azure CLI / VS Code / Developer CLI. For production, either constrain `DefaultAzureCredential` to production-safe credentials or use a specific credential directly. Avoid connection strings, account/API keys — they bypass Entra audit and rotation.
>    - Local dev: `DefaultAzureCredential` works as-is.
>    - Production: set `AZURE_TOKEN_CREDENTIALS=prod` (or `AZURE_TOKEN_CREDENTIALS=<specific_credential>`) to constrain the credential chain to production-safe credentials.
> 2. **Wrap every client in a context manager** so HTTP transports, sockets, and token caches are released deterministically:
>    - Sync: `with <Client>(...) as client:`
>    - Async: `async with <Client>(...) as client:` **and** `async with DefaultAzureCredential() as credential:` (from `azure.identity.aio`)
>
> Snippets may abbreviate this setup, but production code should always follow both rules.
```

Apply structural adaptations to the Python callout and authentication section for specialized SDK shapes:

- **SDKs lacking Entra ID support** (legacy speech REST endpoints, websocket APIs requiring subscription keys): Retain rule #2 (context managers) and replace rule #1 with a single sentence stating that the SDK requires API-key authentication and explaining why Entra ID is unavailable.
- **Async-only Python SDKs** (e.g., `azure-ai-voicelive`): Retain both rules and display the async syntax in the bullet points.
- **Non-Azure Python skills without client lifecycles** (e.g., `pydantic-models-py`): Omit the callout block.
- **SDKs supporting legacy API-key authentication**: Present `DefaultAzureCredential` in the primary authentication block, and place the API-key sample in a demoted `### Legacy: API Key (existing keyed deployments)` subsection immediately following the primary block with a one-line note directing new deployments to `DefaultAzureCredential`. Document service-specific key parameters in the demoted block (such as `azure-ai-translation-text` requiring a `region=` parameter when using a key against the global endpoint while token-credential authentication uses a custom subdomain endpoint), and include `<SERVICE>_KEY` in the Environment Variables block with the comment `# Only required for the legacy API-key auth path below`.

### Cross-Language Authentication Patterns

Implement environment-based credential initialization across supported languages, isolated from hardcoded secrets or connection strings:

```python
# Python — note: client is wrapped in `with` for deterministic cleanup
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
# Local dev: DefaultAzureCredential works as-is.
credential = DefaultAzureCredential()
# Production alternative: constrain DefaultAzureCredential with AZURE_TOKEN_CREDENTIALS.
# credential = DefaultAzureCredential(require_envvar=True)
# Or use a specific credential directly in production:
# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes
# credential = ManagedIdentityCredential()
with ServiceClient(endpoint, credential) as client:
    client.do_thing()
```

```csharp
// C#
using Azure.Identity;

// Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
var credential = new DefaultAzureCredential(
    DefaultAzureCredential.DefaultEnvironmentVariableName
);
// Or use a specific credential directly in production:
// See https://learn.microsoft.com/dotnet/api/overview/azure/identity-readme?view=azure-dotnet#credential-classes
// var credential = new ManagedIdentityCredential();
var client = new ServiceClient(new Uri(endpoint), credential);
```

```java
// Java
import com.azure.identity.AzureIdentityEnvVars;
import com.azure.identity.DefaultAzureCredentialBuilder;
import com.azure.identity.ManagedIdentityCredential;
import com.azure.identity.ManagedIdentityCredentialBuilder;

// Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
TokenCredential credential = new DefaultAzureCredentialBuilder()
    .requireEnvVars(AzureIdentityEnvVars.AZURE_TOKEN_CREDENTIALS)
    .build();
// Or use a specific credential directly in production:
// See https://learn.microsoft.com/java/api/overview/azure/identity-readme?view=azure-java-stable#credential-classes
// TokenCredential credential = new ManagedIdentityCredentialBuilder().build();
ServiceClient client = new ServiceClientBuilder()
    .endpoint(endpoint)
    .credential(credential)
    .buildClient();
```

```typescript
// TypeScript
import {
  DefaultAzureCredential,
  ManagedIdentityCredential,
} from "@azure/identity";
// Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
const credential = new DefaultAzureCredential({
  requiredEnvVars: ["AZURE_TOKEN_CREDENTIALS"],
});
// Or use a specific credential directly in production:
// See https://learn.microsoft.com/javascript/api/overview/azure/identity-readme?view=azure-node-latest#credential-classes
// const credential = new ManagedIdentityCredential();
const client = new ServiceClient(endpoint, credential);
```

```go
// Go
import (
  "context"

  "github.com/Azure/azure-sdk-for-go/sdk/azidentity"
  "github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
)

ctx := context.Background()

// Local dev: DefaultAzureCredential. Production: set AZURE_TOKEN_CREDENTIALS=prod or AZURE_TOKEN_CREDENTIALS=<specific_credential>
cred, err := azidentity.NewDefaultAzureCredential(nil)
if err != nil {
  panic(err)
}

// Or use a specific credential directly in production:
// cred, err := azidentity.NewManagedIdentityCredential(nil)

client, err := azblob.NewClient("https://<account>.blob.core.windows.net/", cred, nil)
if err != nil {
  panic(err)
}

_ = client
_ = ctx
```

```rust
// Rust
use azure_identity::DeveloperToolsCredential;
use azure_storage_blob::BlobServiceClient;

let credential = DeveloperToolsCredential::new(); // Local dev
let client = BlobServiceClient::new(
    "https://<account>.blob.core.windows.net/",
    credential,
    None,
)?;
```

### Standard SDK Verb & Language Idioms

Map Azure SDK operations to standard method verb prefixes:

| Verb | Operational Behavior |
| :--- | :--- |
| `create` | Create a new resource; fail if the resource already exists |
| `upsert` | Create a new resource or update an existing resource |
| `get` | Retrieve a single resource; return an error if missing |
| `list` | Return a pageable collection of resources |
| `delete` | Remove a resource; succeed even if the resource is missing |
| `begin` | Initiate a long-running operation (LRO) |

Enforce language-specific SDK idioms documented in `references/azure-sdk-patterns.md`:

- **Python**: Use `ItemPaged`, `LROPoller`, `with` / `async with` context managers, and Sphinx docstrings. Present both sync and async clients with equal prominence in separate `### Sync` and `### Async` subsections when the SDK supports both modes; document the single available mode for sync-only or async-only SDKs, keeping sync and async calls isolated in separate examples.
- **.NET**: Use `Response<T>`, `Pageable<T>`, `Operation<T>`, and mocking-friendly client patterns.
- **Java**: Use the `*Builder` pattern, `PagedIterable`/`PagedFlux`, and Project Reactor types.
- **TypeScript**: Use `PagedAsyncIterableIterator`, `AbortSignal`, and browser-compatible bundle considerations.
- **Go**: Pass `context.Context` as the first argument, iterate pages via `runtime.Pager[T]` (`New*Pager()` + `More()/NextPage(ctx)`), monitor long-running operations via `runtime.Poller[T]` (`Begin*` + `PollUntilDone(ctx, nil)`), construct pointer fields with `to.Ptr(...)` helpers, inspect typed `*azcore.ResponseError` errors, use the short package name (e.g., `azblob`) in documentation prose, and reserve the full module path (`[github.com/Azure/azure-sdk-for-go/sdk/storage/azblob](https://github.com/Azure/azure-sdk-for-go/sdk/storage/azblob)`) for code import blocks.
- **Rust**: Manage crates via `cargo add`, apply the `azure_core` direct-import dependency rule, use `Response<T>`, `Pager<T>`, `RequestContent::from()`, `.into_model()`, explicit credential types (`DeveloperToolsCredential` for local dev, `ManagedIdentityCredential` for production), and Entra ID RBAC role assignments.

### Mandatory User-Facing Best Practices

#### Python, .NET, Java, TypeScript, and Go Skills

Insert the following rules verbatim (adapted for target language syntax) as the opening items of `## Best Practices` in every generated skill:

```markdown
1. **Do not mix sync and async clients in the same call path.** Use either `azure.xxx` sync clients or `azure.xxx.aio` async clients within a single call path — do not combine both.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use `DefaultAzureCredential`** for code that runs locally. For code that runs in Azure, either constrain `DefaultAzureCredential` with `AZURE_TOKEN_CREDENTIALS=prod` (or a specific target credential) or use a specific token credential directly (e.g. `ManagedIdentityCredential`, `WorkloadIdentityCredential`).
```

Adapt items #1 and #2 according to the target skill architecture:

| Skill Type | Item #1 Adaptation | Item #2 Adaptation |
| :--- | :--- | :--- |
| Async-only SDK (e.g., `voicelive`) | `"This SDK is async-only; use the .aio namespace throughout."` | Keep standard wording |
| Async-oriented framework guidance (e.g., agent frameworks) | `"Use the framework's documented async patterns where required, but do not claim async is globally preferred for Azure Python SDKs."` | Keep standard wording |
| Provider-pattern (OpenTelemetry exporters/distro) | Keep standard wording | `"Call provider.shutdown() / flush() at process exit to flush telemetry — providers are not context managers."` |
| REST-over-httpx skills | Keep standard wording | `"Use with httpx.Client(...) as client: (sync) or async with httpx.AsyncClient(...) as client: (async) so connections pool and close deterministically."` |
| Identity skill | Keep standard wording | `"Use credentials as context managers (with DefaultAzureCredential() as credential:) when they own token caches / HTTP transports you want cleaned up; for async, use async with on credentials from azure.identity.aio."` |
| FastAPI (non-Azure) | `"Pick def or async def per endpoint based on whether you call async I/O; do not mix sync and blocking calls in one handler."` | `"Manage long-lived resources (DB pools, HTTP clients) in lifespan and inject via Depends; use with/async with for per-request resources."` |
| Pure model/schema skill (no I/O, e.g., `pydantic`) | Skip item #1 | Skip item #2 |

Demonstrate both rules across code examples in the skill body: wrap each client instantiation in `with` / `async with` (excluding the standalone credential-construction snippet in `## Authentication & Lifecycle` and framework `lifespan` ownership patterns) and wrap async credentials from `azure.identity.aio` in `async with credential:` alongside the client.

#### Rust Skills

Insert the following 7 rules as the opening items of `## Best Practices` in every Rust skill:

1. **Use `cargo add` to manage dependencies, never edit `Cargo.toml` directly.** Run `cargo add <crate>` or `cargo remove <crate>` to modify dependencies from crates.io rather than editing `Cargo.toml` manually.
2. **Add `azure_core` to `Cargo.toml` only when you import `azure_core` types directly.** Add `azure_core` as an explicit dependency when importing types such as `azure_core::http::Url`, `azure_core::http::RequestContent`, or `azure_core::error::ErrorKind`; omit the direct `azure_core` dependency when consuming types re-exported by service crates (such as `use azure_storage_blob::BlobClient`).
3. **Use `DeveloperToolsCredential` for local development and `ManagedIdentityCredential` for production.** Select the explicit environment-matched credential type in Rust, as the Rust SDK excludes `DefaultAzureCredential`.
4. **Use `RequestContent::from()` to wrap upload data.** Wrap upload payloads (such as blob bytes) in `RequestContent::from(your_data)`.
5. **Assign appropriate RBAC roles for Entra ID auth.** Provision the required RBAC role on the target identity for production Entra ID authentication (e.g., `"Storage Blob Data Contributor"` for blob write operations).
6. **Always verify package versions using crates.io.** Check [crates.io](https://crates.io/) prior to adding a crate to confirm a stable, supported release version.
7. **Future-proof `#[non_exhaustive]` model structs and enums.** Terminate struct literal initializers for externally constructible `#[non_exhaustive]` structs deriving `Default` with `..Default::default()`, adding `#[allow(clippy::needless_update)]` locally when every currently known field is populated. Construct truly `#[non_exhaustive]` structs (which trigger compiler error `E0639` on external struct literals) via the provided constructor, builder, or mutable `Default::default()` instance. Include a wildcard (`_`) match arm when matching SDK enums, and demonstrate this pattern in every model-construction snippet (see `references/azure-sdk-patterns.md` under Model Types).

### Deprecated & Rebranded SDK Handling

Update existing skills when APIs remain compatible across package rebrands, or create a new skill paired with `references/migration.md` and bidirectional cross-references when the API surface changes:

- `azure-ai-formrecognizer-java` ➔ `azure-ai-documentintelligence` (rebranded service)
- `azure-communication-callingserver-java` ➔ `azure-communication-callautomation` (deprecated package with migration guide)

Insert the migration notice callout at the top of deprecated or rebranded skills:

```markdown
> **⚠️ MIGRATION NOTICE**: The [Old Service Name] has been rebranded to **[New Service Name]**. While the package `old-package-name` remains available for compatibility, **new projects should use `new-package-name`** which provides the latest features and updates.
>
> **For new projects**: Use the `new-package-name` package instead.
>
> **This skill remains valid** for existing projects using `old-package-name`, but be aware you're using the legacy package name. The API patterns shown here are compatible with both packages.
```

Present both legacy and recommended package installations:

```markdown
## Installation

### Legacy Package (Old Name)

\`\`\`xml
<dependency>
<groupId>com.azure</groupId>
<artifactId>azure-old-package</artifactId>
<version>4.2.0</version>
</dependency>
\`\`\`

### Recommended Package (New Name)

**For new projects, use the rebranded package:**

\`\`\`xml
<dependency>
<groupId>com.azure</groupId>
<artifactId>azure-new-package</artifactId>
<version>1.0.0</version>
</dependency>
\`\`\`

> **Note**: The API patterns in this skill apply to both packages. Replace package names and imports as needed when using `azure-new-package`.
```

### Canonical Azure SDK Skill Template

Format `SKILL.md` frontmatter (including optional flat-string benchmarking metadata keys) and body sections according to the canonical template:

```yaml
---
name: azure-service-py
description: |
  Azure Service SDK for Python. Use for [specific features].
  Triggers: "service name", "create resource", "specific operation".
metadata:
  benchmark_tokens_estimated: "1180"
  benchmark_tokens_target: "1100"
  benchmark_tokens_max: "1500"
  benchmark_quality_single_core_workflow: "true"
  benchmark_quality_examples_focused: "true"
  benchmark_quality_no_prose_bloat: "true"
  benchmark_quality_anti_patterns_checked: "true"
---
```

```markdown
---
name: skill-creator
description: |
  Azure AI Example SDK for Python. Use for [specific service features].
  Triggers: "example service", "create example", "list examples".
---

# Azure AI Example SDK

## Installation

\`\`\`bash
pip install azure-ai-example
\`\`\`

## Environment Variables

\`\`\`bash
AZURE_EXAMPLE_ENDPOINT=https://<resource>.example.azure.com
AZURE_TOKEN_CREDENTIALS=prod # Required only if DefaultAzureCredential is used in production
\`\`\`

## Authentication & Lifecycle

> **🔑 Two rules apply to every code sample below:**
>
> 1. **Prefer `DefaultAzureCredential` for local development.** It works as-is with Azure CLI / VS Code / Developer CLI. For production, either constrain `DefaultAzureCredential` to production-safe credentials or use a specific credential directly. Avoid connection strings, account/API keys — they bypass Entra audit and rotation.
>    - Local dev: `DefaultAzureCredential` works as-is.
>    - Production: set `AZURE_TOKEN_CREDENTIALS=prod` (or `AZURE_TOKEN_CREDENTIALS=<specific_credential>`) to constrain the credential chain to production-safe credentials.
> 2. **Wrap every client in a context manager** so HTTP transports, sockets, and token caches are released deterministically:
>    - Sync: `with <Client>(...) as client:`
>    - Async: `async with <Client>(...) as client:` **and** `async with DefaultAzureCredential() as credential:` (from `azure.identity.aio`)
>
> Snippets may abbreviate this setup, but production code should always follow both rules.

\`\`\`python
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
from azure.ai.example import ExampleClient

# Local dev: DefaultAzureCredential works as-is.
credential = DefaultAzureCredential()

# Production alternative: constrain DefaultAzureCredential with AZURE_TOKEN_CREDENTIALS.
# credential = DefaultAzureCredential(require_envvar=True)

# Or use a specific credential directly in production:

# See https://learn.microsoft.com/python/api/overview/azure/identity-readme?view=azure-python#credential-classes

# credential = ManagedIdentityCredential()

with ExampleClient(
endpoint=os.environ["AZURE_EXAMPLE_ENDPOINT"],
credential=credential,
) as client:
item = client.get_item("example")
\`\`\`

## Core Workflow

\`\`\`python
with ExampleClient(endpoint=endpoint, credential=credential) as client: # Create
item = client.create_item(name="example", data={...})

    # List (pagination handled automatically)
    for item in client.list_items():
        print(item.name)

    # Long-running operation
    poller = client.begin_process(item.id)
    result = poller.result()

    # Cleanup
    client.delete_item(item.id)

\`\`\`

## Reference Files

| File                                                                 | Contents                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------ |
| [references/capabilities.md](references/capabilities.md)             | Capability index (hero coverage + links to deep-dives) |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Concrete non-hero examples                             |
| [references/tools.md](references/tools.md)                           | Tool integrations                                      |
| [references/streaming.md](references/streaming.md)                   | Event streaming patterns                               |
```

---

## Execution, Categorization, Testing & Regeneration Workflows

### End-to-End Skill Authoring Sequence

Execute the following 8 steps sequentially when creating a new skill:

1. **Gather SDK Context** — Collect the SDK package name, Microsoft Learn documentation URL, or repository reference, and query `microsoft-docs` MCP for current API signatures.
2. **Analyze Scope & Scenarios** — Identify target SDK operations, activation trigger phrases, common developer errors, hero scenarios, and at least 1 high-value non-hero scenario.
3. **Assign Product Area Category** — Map the skill to its language and product area directory under `skills/<language>/<category>/`:

| Category | Service Scope | Example Skills |
| :--- | :--- | :--- |
| `foundry` | AI Foundry, agents, projects, inference | `azure-ai-agents-py`, `azure-ai-projects-py` |
| `data` | Storage, Cosmos DB, Tables, Data Lake | `azure-cosmos-py`, `azure-storage-blob-py` |
| `messaging` | Event Hubs, Service Bus, Event Grid | `azure-eventhub-py`, `azure-servicebus-py` |
| `monitoring` | OpenTelemetry, App Insights, Query | `azure-monitor-opentelemetry-py` |
| `identity` | Authentication, DefaultAzureCredential | `azure-identity-py` |
| `security` | Key Vault, secrets, keys, certificates | `azure-keyvault-py` |
| `integration` | API Management, App Configuration | `azure-appconfiguration-py` |
| `compute` | Batch, ML compute | `azure-compute-batch-java` |
| `container` | Container Registry, ACR | `azure-containerregistry-py` |

4. **Author Bundled Resources & SKILL.md** — Write `references/`, `scripts/`, and `assets/` first, then author `.github/skills/<skill-name>/SKILL.md` using the naming pattern `azure-<service>-<subservice>-<language>` (e.g., `azure-ai-agents-py`, `azure-cosmos-java`, `azure-storage-blob-ts`, `azure-storage-blob-go`).
5. **Create Category Symlink** — Link `skills/<language>/<category>/<short-name>` (stripping the `azure-` prefix and `-<language>` suffix) to `../../../.github/skills/<full-skill-name>` and verify the link target:

```bash
# Pattern: skills/<language>/<category>/<short-name> -> ../../../.github/skills/<full-skill-name>

# Example for azure-ai-agents-py in python/foundry:
cd skills/python/foundry
ln -s ../../../.github/skills/azure-ai-agents-py agents

# Example for azure-cosmos-db-py in python/data:
cd skills/python/data
ln -s ../../../.github/skills/azure-cosmos-db-py cosmos-db

# Example for azure-storage-blob-go in go/data:
cd skills/go/data
ln -s ../../../.github/skills/azure-storage-blob-go blob
```

```bash
ls -la skills/python/foundry/agents
# Should show: agents -> ../../../.github/skills/azure-ai-agents-py
```

6. **Author Acceptance Criteria & Test Scenarios** — Create `tests/scenarios/<skill-name>/acceptance-criteria.md` and `tests/scenarios/<skill-name>/scenarios.yaml` (stored strictly under `tests/`, isolated from the `.github/skills/<skill-name>/` directory), then execute the test harness and optional Vally evaluation.
7. **Update Catalog Documentation & Site Data** — Update `README.md` skill counts and tables, rebuild `docs-site/src/data/skills.json` and `docs/`, and verify `AGENTS.md`.
8. **Audit & Annotate** — Measure section token counts, run the quality gate checklist, and record the measured token count in the H1 HTML comment.

### Test Suite Construction & Execution

Create `tests/scenarios/<skill-name>/acceptance-criteria.md` documenting correct and incorrect import, authentication, client initialization, and async (`.aio`) patterns from Microsoft Learn, SDK source code, and skill reference files:

```markdown
# Acceptance Criteria: <skill-name>

**SDK**: `package-name`
**Repository**: https://github.com/Azure/azure-sdk-for-<language>
**Purpose**: Skill testing acceptance criteria

---

## 1. Correct Import Patterns

### 1.1 Client Imports

#### ✅ CORRECT: Main Client

\`\`\`python
from azure.ai.mymodule import MyClient
from azure.identity import DefaultAzureCredential
\`\`\`

#### ❌ INCORRECT: Wrong Module Path

\`\`\`python
from azure.ai.mymodule.models import MyClient # Wrong - Client is not in models
\`\`\`

## 2. Authentication Patterns

#### ✅ CORRECT: DefaultAzureCredential + context manager

\`\`\`python
credential = DefaultAzureCredential()
with MyClient(endpoint, credential) as client:
client.do_thing()
\`\`\`

#### ❌ INCORRECT: Hardcoded Credentials

\`\`\`python
client = MyClient(endpoint, api_key="hardcoded") # Security risk
\`\`\`

#### ❌ INCORRECT: Connection string / account key when Entra is supported

\`\`\`python
client = MyClient.from_connection_string(os.environ["CONNECTION_STRING"]) # Bypasses Entra audit/rotation
\`\`\`

#### ❌ INCORRECT: Bare client without context manager

\`\`\`python
client = MyClient(endpoint, credential) # Leaks HTTP transport on exception / interpreter exit
client.do_thing()
\`\`\`
```

Create `tests/scenarios/<skill-name>/scenarios.yaml` where each scenario targets a single feature with `expected_patterns`, `forbidden_patterns`, `tags` (`basic`, `async`, `streaming`, `tools`), and a complete runnable `mock_response` covering both hero and non-hero scenarios:

```yaml
config:
  model: gpt-4
  max_tokens: 2000
  temperature: 0.3

scenarios:
  - name: basic_client_creation
    prompt: |
      Create a basic example using the Azure SDK.
      Include proper authentication and client initialization.
    expected_patterns:
      - "DefaultAzureCredential"
      - "MyClient"
      - "with MyClient" # enforce context manager
    forbidden_patterns:
      - "api_key="
      - "hardcoded"
      - "from_connection_string" # prefer Entra over connection strings
    tags:
      - basic
      - authentication
    mock_response: |
      import os
      from azure.identity import DefaultAzureCredential
      from azure.ai.mymodule import MyClient

      credential = DefaultAzureCredential()
      with MyClient(
          endpoint=os.environ["AZURE_ENDPOINT"],
          credential=credential,
      ) as client:
          # ... rest of working example
          pass
```

Run the test harness and optional Vally evaluation (matching the [`Vally Evaluation`](../../workflows/vally-evaluation.yml) workflow when `tests/scenarios/<skill-name>/vally/eval.yaml` exists and `COPILOT_TOKEN` is available):

```bash
cd tests
pnpm install

# Check skill is discovered
pnpm harness --list

# Run in mock mode (fast, deterministic)
pnpm harness <skill-name> --mock --verbose

# Run with Ralph Loop (iterative improvement)
pnpm harness <skill-name> --ralph --mock --max-iterations 5 --threshold 85
```

```bash
# If the eval spec uses the shared Rust custom grader plugin, build it first.
(cd tests/scenarios/_shared/vally/grader-plugins/rust-cargo-build-failure && npm install && npm run build)

vally lint --eval-spec tests/scenarios/<skill-name>/vally/eval.yaml \
  --grader-plugin tests/scenarios/_shared/vally/grader-plugins/rust-cargo-build-failure \
  --strict

vally eval --eval-spec tests/scenarios/<skill-name>/vally/eval.yaml \
  --grader-plugin tests/scenarios/_shared/vally/grader-plugins/rust-cargo-build-failure
```

### Catalog & Documentation Synchronization

Update repository catalog metadata and rebuild static documentation artifacts after adding or refreshing a skill:

1. **Update `README.md`**:
   - Increment total skill count (line `~73`: `> N skills in...`).
   - Increment Skill Explorer link count (line `~15`: `Browse all N skills`).
   - Update the language count table (lines `~77-83`).
   - Increment the language section header count (e.g., `> N skills • suffix: -py`).
   - Increment the category summary count (e.g., `<summary><strong>Foundry & AI</strong> (N skills)</summary>`).
   - Insert the skill row in alphabetical order within its category table.
   - Update the test coverage summary (line `~622`: `**N skills with N test scenarios**`) and language test coverage row.
2. **Regenerate GitHub Pages Data**:

```bash
(cd docs-site && npx tsx scripts/extract-skills.ts && npm run build)
```

3. **Verify `AGENTS.md`**: Confirm the total skill count matches the updated catalog.

### Skill Regeneration & Batch Refresh Workflow

Execute surgical regeneration when refreshing existing skills from updated upstream SDKs:

1. **Verify API Surface Parity**: Inspect each client constructor, operation group, model class, enum member, `begin_*` LRO method, and module import path against the language-specific authoritative source (Microsoft Learn or `[https://github.com/Azure/azure-sdk-for-rust](https://github.com/Azure/azure-sdk-for-rust)` + [crates.io](https://crates.io/)). Replace outdated shapes (such as flat arguments replaced by nested `properties=...` models or renamed methods) to match current upstream definitions.
2. **Enforce Scenario Breadth**: Represent every hero scenario in `SKILL.md` (or linked reference files), include at least 1 concrete non-hero scenario in `references/non-hero-scenarios.md`, index coverage in `references/capabilities.md`, and state explicitly that the skill targets hero workflows plus selected secondary scenarios rather than claiming complete API surface coverage unless every major operation group is demonstrated.
3. **Validate Regenerated Skills**:

```bash
(cd tests && pnpm harness <skill-name> --mock --verbose)
```

For Rust skills, verify that the opening two best-practice rules are present across all regenerated files:

```bash
rg -n "Use `cargo add` to manage dependencies, never edit `Cargo.toml` directly|Add `azure_core` only when importing `azure_core` types directly" .github/plugins/azure-sdk-rust/skills/**/SKILL.md
```

4. **Execute Python Plugin Batch Refresh (`azure-sdk-python`)**: When regenerating all Python skills under `.github/plugins/azure-sdk-python/skills/*/SKILL.md` (treating the plugin directory as canonical, inspecting installed versions via `pip show <package>`, and applying language-specific variants for non-Azure skills such as `fastapi-router-py` and `pydantic-models-py`), run the validation, symlink synchronization, and documentation build pipeline:

```bash
# Canonical source of truth for Python plugin skills
ls .github/plugins/azure-sdk-python/skills/*/SKILL.md
```

```bash
# Fast frontmatter/structure validation for every Python skill
python .github/skills/skill-creator/scripts/quick_validate.py .github/plugins/azure-sdk-python/skills/<skill-name>

# Run Python skill harness in mock mode (all *-py scenarios)
(cd tests && pwsh ./run-harness-by-language.ps1 -Language py -Mock)
```

```bash
# Ensure .github/skills links point at plugin canonical skills
python .github/scripts/sync_skill_links.py --plugin azure-sdk-python --check
python .github/scripts/sync_skill_links.py --plugin azure-sdk-python --apply

# Refresh docs site data after content changes
(cd docs-site && npx tsx scripts/extract-skills.ts && npm run build)
```

5. **Record Commit & PR Audit Trail**: Document the upstream sources consulted, symbol and signature corrections applied, and test harness / Vally evaluation outcomes.

---

## Anti-Patterns & Pre-Publication Audit Matrix

### Anti-Patterns & Safety Locks

Enforce the following structural, security, and token-efficiency locks across all authored and regenerated skills (benchmarking only structure-compliant skills that already contain `references/capabilities.md` and `references/non-hero-scenarios.md`):

| Anti-Pattern | Token / Operational Impact | Mandatory Corrective Standard |
| :--- | :--- | :--- |
| **Exhaustive API Reference** (listing 50+ SDK methods in `SKILL.md`) | Wastes `400-600 tokens` and overloads context | Document `3-5` core methods in feature tables and link to official API docs via `microsoft-docs` MCP |
| **Multiple Ways to Solve One Problem** in `SKILL.md` | Adds `50-100 tokens` per variant and causes decision paralysis | Show 1 primary idiom (e.g., `ItemPaged` for sync pagination) in `SKILL.md` and extract alternatives to `/references/` |
| **Beginner + Intermediate + Advanced Mixed** in one file | Adds `600-900 extra tokens` across skill tiers | Keep the `~80%` core workflow in `SKILL.md` and isolate advanced patterns (custom retry policies, circuit breakers) in `/references/` |
| **Restating Official Documentation Prose** | Wastes `50-100 tokens` per parameter (`300+ tokens` on large APIs) | Present runnable code immediately (`client = CosmosClient(endpoint, credential)`) and link to `microsoft-docs` MCP |
| **Verbose Prose Explanations Before Code** | Bloats token count without adding executable value | Lead directly with context-managed code (`with CosmosClient(endpoint, credential) as client:`) |
| **Creating Skills Without SDK Context** | Produces hallucinated packages and invalid signatures | Halt skill creation and prompt the user for the SDK package name and documentation URL |
| **Placing Trigger Conditions in Skill Body** | Fails to influence skill activation (`SKILL.md` body loads after triggering) | Place all trigger phrases and activation conditions inside the YAML frontmatter `description` field |
| **Hardcoding Credentials or Connection Strings** | Introduces severe security and Entra audit/rotation bypass risks | Enforce environment variables and `DefaultAzureCredential` / `ManagedIdentityCredential` / `DeveloperToolsCredential` |
| **Skipping the Authentication Section** | Causes coding agents to improvise insecure or deprecated auth setups | Include a complete `## Authentication & Lifecycle` section in every SDK skill |
| **Using Outdated SDK Signatures or Wrong Import Paths** | Breaks compilation and runtime execution | Verify every class, method, and module import path against current Microsoft Learn or upstream SDK repo sources |
| **Including `README.md` or Deeply Nested References** | Adds redundant meta-documentation and fragments context lookup | Exclude `README.md` inside skill folders and keep `references/` exactly 1 directory level deep |
| **Omitting Sync/Async + Context-Manager Rules in Python Best Practices** | Leaves end users without explicit lifecycle and concurrency guards | Include the verbatim two opening rules in `## Best Practices` and wrap every client/async credential in `with` / `async with` |
| **Mixing Sync and Async Calls in a Single Python Snippet** | Demonstrates the exact concurrency bug the skill prevents | Separate sync and async workflows into dedicated `### Sync` and `### Async` subsections |
| **Shipping Skills Without Acceptance Criteria, Tests, or Symlinks** | Prevents automated regression testing and category discovery | Create `acceptance-criteria.md`, `scenarios.yaml` (`100%` mock pass rate), and `skills/<language>/<category>/<short-name>` symlinks |
| **Claiming Full API Coverage from a Single Happy-Path Sample** | Conceals unimplemented operation groups and non-hero gaps | State hero + secondary scope explicitly and populate `references/capabilities.md` and `references/non-hero-scenarios.md` |

### Pre-Publication Verification Checklist

Verify that every criterion below is satisfied prior to completing a skill creation or regeneration task:

- [ ] **Input & API Parity Verified**: User supplied SDK package name or documentation URL; every snippet symbol, signature, and import path matches current Microsoft Learn docs (via `microsoft-docs` MCP), installed package inspection (`pip show <package>`), or upstream Rust/Go SDK repositories and [crates.io](https://crates.io/).
- [ ] **Frontmatter & Token Budget Compliant**: `name` matches `.github/skills/<name>/SKILL.md`; `description` includes capabilities and trigger keywords within `~200 chars` (`1,024 chars` max); optional `metadata` (`benchmark_tokens_*`, `benchmark_quality_*`) uses flat string values; `SKILL.md` remains under `500 lines` and `~1500 tokens` (`~1100 tokens` target) with the `<!-- Token Count: ~XXXX (target: 1100, max: 1500) -->` comment placed below H1.
- [ ] **Authentication & Lifecycle Enforced**: Python skills include the verbatim `## Authentication & Lifecycle` callout block, use `DefaultAzureCredential` locally and constrained `AZURE_TOKEN_CREDENTIALS=prod` or explicit credentials in production, wrap every client and async credential (`azure.identity.aio`) in `with` / `async with`, and isolate legacy API keys in `### Legacy: API Key (existing keyed deployments)` with `<SERVICE>_KEY` documented; Rust skills use `DeveloperToolsCredential` locally and `ManagedIdentityCredential` in production.
- [ ] **Scenario & Reference Coverage Complete**: Every hero scenario has 1 runnable example in `SKILL.md` (with equal `### Sync` and `### Async` subsections for dual-mode Python SDKs) including resource cleanup/delete; feature tables list `3-5` core methods (plus an operation-group coverage table for broad SDKs); `references/capabilities.md` indexes hero and non-hero coverage; `references/non-hero-scenarios.md` provides concrete non-hero examples.
- [ ] **Language Best Practices Present**: Python/.NET/Java/TS/Go skills start `## Best Practices` with the mandatory sync/async isolation, context manager, and credential rules (using the table-matched variant for specialized skill types); Rust skills start `## Best Practices` with the `cargo add` dependency rule and the `azure_core` direct-import rule, plus `#[non_exhaustive]` handling.
- [ ] **Categorization, Tests & Catalog Synced**: Skill resides in `.github/skills/<skill-name>/SKILL.md` with a verified symlink at `skills/<language>/<category>/<short-name>`; `tests/scenarios/<skill-name>/acceptance-criteria.md` and `tests/scenarios/<skill-name>/scenarios.yaml` cover hero and non-hero flows and pass `pnpm harness <skill-name> --mock --verbose` at `100%` (plus `vally lint` / `vally eval` when `vally/eval.yaml` is present); `README.md`, `docs-site/src/data/skills.json`, `docs/`, and `AGENTS.md` are updated.
