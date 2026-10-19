---
name: skill-creator
description: Design, structure, validate, and regenerate modular skills for AI coding agents targeting Azure SDKs, Microsoft Foundry services, and domain workflows when creating new skills or refreshing existing skills from authoritative sources, distinct from direct application code execution outside skill authoring.
---

# Skill Creator

Author, validate, categorize, and regenerate modular knowledge packages that configure AI coding agents with procedural workflows, Azure SDK expertise, domain schemas, and bundled resources.

## Operational Principles & Architectural Constraints

### Context Window & Token Budget Allocation

Allocate context window capacity exclusively to specialized knowledge beyond baseline agent capabilities for domain/procedural skills, and enforce the following section-level and total token ceilings for every Azure SDK skill:

| Section | Target | Absolute Max |
| :--- | :--- | :--- |
| Installation + Env Vars | 100 tokens | 150 |
| Authentication & Lifecycle | 200 tokens | 300 |
| Core Workflow (1 example) | 300 tokens | 400 |
| Feature Tables | 200 tokens | 300 |
| Best Practices (6-8 items) | 200 tokens | 250 |
| References (reference/ links) | 100 tokens | 150 |
| **Total SKILL.md** | **~1100 tokens** | **~1500 tokens** |

- Maintain `SKILL.md` below 500 lines (`<5k words` trigger ceiling) and within the 1,500-token ceiling for Azure SDK skills.
- Annotate `<!-- Token Count: ~XXXX (target: 1100, max: 1500) -->` immediately below the H1 heading (`# <SDK Name>`).
- Refactor sections exceeding maximum token limits or approaching the 500-line boundary into `/references/` subdirectories.

### Authoritative Documentation Verification Contract

Instruct agents inside skills and during skill authoring to query `microsoft-docs` MCP and verify API signatures against the installed SDK version or canonical upstream repository before implementation:

```markdown
## Before Implementation

Search `microsoft-docs` MCP for current API patterns:

- Query: "[SDK name] [operation] python"
- Verify: Parameters match your installed SDK version
```

Resolve authoritative sources by target language according to the following priority contract:

- **Python, .NET, Java, TypeScript, Go**: Treat the current Microsoft Learn API reference (retrieved via `microsoft-docs` MCP) and official SDK repositories (`https://github.com/Azure/azure-sdk-for-`) as the primary contract.
- **Go Package Sources**: Use `https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/<service>/<module>/README.md` and `https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/<service>/<module>/` as canonical upstream references.
- **Rust Package Sources**: Treat `https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/)<service>/<crate>/README.md`, `https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/)<service>/<crate>/examples/`, and [crates.io](https://crates.io/) documentation as the primary contract (as Rust packages operate independently of Microsoft Learn API-reference pages).

### Specificity Calibration (Degrees of Freedom)

Calibrate instruction specificity to the determinism required by the target operation:

| Freedom | When | Example |
| :--- | :--- | :--- |
| **High** | Multiple valid approaches | Text guidelines |
| **Medium** | Preferred pattern with variation | Pseudocode |
| **Low** | Must be exact | Specific scripts |

### Progressive Disclosure & Directory Topology

Structure every skill across three progressive loading tiers:

1. **Metadata** (~100 words) — Always in context (`name` matching `.github/skills/<name>/SKILL.md` and `description` targeting ~200 characters, maximum 1,024 characters, stating both what the skill covers and when trigger phrases activate it; place all "when to use" trigger criteria in `description` rather than the `SKILL.md` body).
2. **SKILL.md body** (<5k words, under 500 lines) — Loaded when the skill triggers.
3. **References** (unlimited) — Loaded on demand from one-level-deep files under `references/`.

Organize the skill directory according to the standard topology, excluding `README.md` meta-documentation files and nested subdirectories inside `references/`:

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

Allocate optional bundled resources by function:

| Type | When to Include | Examples |
| :--- | :--- | :--- |
| `scripts/` | Reused code patterns | Auth setup, CLI scripts |
| `references/` | Feature deep-dives and overflow examples | `capabilities.md` index, `non-hero-scenarios.md`, API docs |
| `assets/` | Output templates | Boilerplate code, images |

Apply one of the three progressive disclosure organization patterns based on skill scope:

- **Pattern 1: High-Level Guide with References**:
  ```markdown
  # SDK Name

  ## Quick Start

  [Minimal example]

  ## Advanced Features

  - **Streaming**: See [references/streaming.md](references/streaming.md)
  - **Tools**: See [references/tools.md](references/tools.md)
  ```
- **Pattern 2: Language Variants**:
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
- **Pattern 3: Feature Organization**:
  ```
  azure-ai-agents/
  ├── SKILL.md (core workflow)
  └── references/
      ├── tools.md
      ├── streaming.md
      ├── async-patterns.md
      └── error-handling.md
  ```

Consult bundled design pattern references when structuring complex workflows or language idioms:

| Reference | Contents |
| :--- | :--- |
| `references/workflows.md` | Sequential and conditional workflows |
| `references/output-patterns.md` | Templates and examples |
| `references/azure-sdk-patterns.md` | Language-specific Azure SDK patterns |

## Core Workflow Discipline, Reference Extraction & Contrastive Calibration

### Reference Extraction Decision Matrix

Partition content between `SKILL.md` and `/references/` using frequency, cognitive load, and example length signals:

| Signal | Move to `/references/` | Keep in SKILL.md |
| :--- | :--- | :--- |
| Use frequency | <20% of typical use | ~80%+ of workflows |
| Cognitive load | Advanced patterns, multiple options | Single happy path |
| Example length | >10 lines, multiple paths | 1-5 lines, single path |

Route specialized and edge-case content to standardized reference files:

- **Capability index** (records each hero scenario, its location in `SKILL.md` or bundled references, and links to non-hero deep-dives, excluding historical or migration narration) ➔ `references/capabilities.md`
- **Concrete non-hero examples** (update/patch, delete/cleanup, export/import, advanced auth mode, paging/filtering, retries/error handling, or LRO monitoring kept out of main `SKILL.md`) ➔ `references/non-hero-scenarios.md`
- **Batch operations** ➔ `/references/batch-operations.md`
- **Error handling** (beyond try-except) ➔ `/references/error-handling.md`
- **Performance tuning** ➔ `/references/performance.md`
- **Alternative workflows & trade-off matrices** ➔ `/references/workflows-comparison.md`
- **Credential type comparisons** (e.g., `AzureCliCredential`, workload identity, service principal variants for Azure Identity SDK) ➔ `/references/credential-types.md`
- **Streaming/events** ➔ `/references/streaming.md`
- **Advanced auth** ➔ `/references/auth-strategies.md`
- **Tool integration** ➔ `/references/tools.md`
- **Breaking changes & major API transitions** ➔ `/references/migration.md`

### Core Workflow Selection Gates

Evaluate the SDK's usage distribution to select between single-workflow and multi-hero representation in `SKILL.md`:

- **Case 1: Single Clear Core Workflow (one pattern handles ~80% of use cases)**:
  1. Designate that pattern as the core workflow.
  2. Present exclusively that workflow in `SKILL.md` using 1 complete, runnable example (for Python SDKs supporting both sync and async clients, paired `### Sync` and `### Async` examples for the same workflow count as 1 workflow).
  3. Route alternative workflows to `/references/` (e.g., for Azure Key Vault Secrets, present secret retrieval with managed identity in `SKILL.md` and place local development with `DefaultAzureCredential`, workload identity, and service-principal client secret or certificate flows in `/references/`).
- **Case 2: Multiple Equally Valid Core Workflows (no single pattern dominates, such that a user choosing an alternative approach would judge a single-pattern skill incorrect)**:
  1. Include every hero scenario directly in `SKILL.md` as a first-class workflow with 1 complete, runnable example per hero scenario (e.g., for Azure Identity SDK, retain both primary local-development and production-safe credential flows in `SKILL.md`).
  2. Route trade-offs, secondary credential choices (`AzureCliCredential`, workload identity, service principal variants), and extended comparisons to `/references/workflows-comparison.md` or `/references/credential-types.md`.

### Contrastive Calibration Matrix (Anti-Pattern Elimination)

Enforce structural efficiency by replacing bloated or defective authoring patterns with their normalized target forms:

| Control Dimension | Defective Pattern (Excluded) | Normalized Target Pattern (Required) | Token & Operational Impact |
| :--- | :--- | :--- | :--- |
| **API Surface Scope** | Listing all 50 SDK methods in a feature table with code samples for every variant; claiming full API coverage from a single happy-path sample | Showing 3-5 core methods in a feature table, linking to official Azure API reference via `microsoft-docs` MCP, and including an explicit operation-group table (covered in snippets vs. referenced only) for broad/management SDKs | Saves 400-600 tokens; eliminates cognitive overload and documents true API coverage scope |
| **Workflow Multiplicity** | Presenting approach A, B, C, and D to solve one problem (e.g., pagination) inside `SKILL.md` | Presenting the primary idiom in `SKILL.md` (e.g., `Use ItemPaged for sync pagination`) and linking alternatives to `/references/` | Saves 50-100 tokens per alternate approach; prevents decision paralysis |
| **Skill Progression Tiers** | Mixing beginner ("what is a client?"), intermediate ("custom retry policies"), and advanced ("circuit breaker patterns") levels in one file | Scoping `SKILL.md` to the 80% core workflow and extracting advanced patterns to `/references/` | Saves 200-300 tokens per level (600-900 tokens across 3 levels) |
| **Documentation Grounding** | Restating parameter definitions in prose ("The CosmosClient constructor takes an endpoint (string) and credential...") | Presenting executable code (`client = CosmosClient(endpoint, credential)`) paired with a `microsoft-docs` MCP reference | Saves 50-100 tokens per parameter (300+ tokens on large APIs) |
| **Code Presentation** | Writing verbose introductory prose explaining how to instantiate a constructor before showing code | Presenting the context-managed code block immediately (`with CosmosClient(endpoint, credential) as client:`) | Minimizes token overhead and surfaces runnable syntax immediately |
| **Prerequisite Context** | Creating an SDK skill without user-provided SDK package name or documentation URL | Requiring SDK package name, documentation URL, or repository reference before authoring | Grounds all symbols and signatures in authoritative sources |
| **Trigger Placement** | Placing "when to use" rules in the `SKILL.md` body | Placing all trigger phrases and activation criteria in YAML frontmatter `description` | Ensures triggers are visible before the skill body loads |
| **Credential & Auth Hygiene** | Hardcoding credentials (`api_key="hardcoded"`), using connection strings when Entra ID is supported, or omitting the authentication section | Enforcing environment variables and language-specific Entra ID credentials in a dedicated `## Authentication & Lifecycle` section | Prevents security leaks, Entra audit bypass, and agent improvisation |
| **Python Client & Async Discipline** | Mixing sync and async calls in one example, or omitting sync/async and context-manager rules from `## Best Practices` | Presenting separate `### Sync` and `### Async` examples wrapped in `with` / `async with` and writing the two mandatory rules verbatim at the top of `## Best Practices` | Ensures deterministic HTTP transport/token cleanup and consistent call paths |
| **Catalog & Test Completeness** | Skipping symlink categorization, acceptance criteria, test scenarios, or `references/*.md` coverage for non-hero capabilities | Creating category symlinks, `acceptance-criteria.md`, `scenarios.yaml` (covering hero and non-hero flows), `references/capabilities.md`, and `references/non-hero-scenarios.md` | Guarantees category discoverability, automated harness validation, and production breadth |

Only benchmark against existing Azure SDK skills that already implement the compliant `references/` layout (`references/capabilities.md` and `references/non-hero-scenarios.md`), stays at or under the 1,500-token maximum, covers the hero workflow with 1-2 examples per concept, uses tables for API summaries (credential types, RBAC roles, client hierarchy), links to official docs via `microsoft-docs` MCP, and moves advanced patterns to `/references/`.

## Azure SDK Skill Architecture & Language Specifications

### Mandatory Skill Section Order

Organize every Azure SDK skill in the exact sequence below (for domain skills, organize sections logically around domain workflows):

1. **Title** — `# SDK Name` followed immediately on the next line by `<!-- Token Count: ~XXXX (target: 1100, max: 1500) -->`.
2. **Installation** — Package installation command (`pip install`, `npm install`, `cargo add`, Maven `<dependency>`, etc.).
3. **Environment Variables** — Required configuration variables with inline comments specifying when each variable is required (include `AZURE_TOKEN_CREDENTIALS` set to `prod` or `<specific_credential>` when constraining `DefaultAzureCredential` in production).
4. **Authentication & Lifecycle** — Language-standard Entra ID authentication and deterministic client lifecycle management (for Python skills, open with the verbatim callout block defined below).
5. **Core Workflow** — Minimal viable runnable example(s) following Core Workflow Selection Gates, including resource cleanup/delete operations.
6. **Feature Tables** — Concise tables covering 3-5 core clients, methods, credential types, RBAC roles, or tools.
7. **Best Practices** — Numbered list (6-8 items, maximum 1 example per bullet) opening with the mandatory user-facing rules for the target language.
8. **Reference Links** — Table linking to `/references/*.md` (always including `references/capabilities.md` and `references/non-hero-scenarios.md` for Azure SDK skills).

### Standard Verb Patterns

Apply consistent Azure SDK operation verbs across all languages:

| Verb | Behavior |
| :--- | :--- |
| `create` | Create new; fail if exists |
| `upsert` | Create or update |
| `get` | Retrieve; error if missing |
| `list` | Return collection |
| `delete` | Succeed even if missing |
| `begin` | Start long-running operation |

### Required Authentication & Lifecycle Callout (Python `-py` Skills Only)

Insert the following callout block **verbatim** immediately under `## Authentication & Lifecycle`, before the first code sample, in every Python Azure SDK skill with a client lifecycle:

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

Apply the following conditional rules to the callout and authentication code samples:

- **SDKs lacking Entra ID support** (e.g., legacy speech REST endpoints or WebSocket APIs requiring subscription keys): Retain Rule #2 (context managers) and replace Rule #1 with a single sentence stating that the SDK requires API-key authentication and explaining why Entra ID is unavailable.
- **Async-only Python SDKs** (e.g., `azure-ai-voicelive`): Retain both rules and display exclusively the async form in the bullets.
- **Non-Azure Python skills without client lifecycle** (e.g., `pydantic-models-py`): Omit the callout block entirely.
- **Legacy API-Key Demotion**: When an SDK officially supports API keys alongside Entra ID, present `DefaultAzureCredential` in the primary authentication example and retain a working copy-pastable API-key example inside a subordinate `### Legacy: API Key (existing keyed deployments)` subsection placed immediately after the primary `DefaultAzureCredential` block. Include a one-line note stating that new code should use `DefaultAzureCredential` and that the keyed path is reserved for existing deployments, add the `<SERVICE>_KEY` variable to `## Environment Variables` with the inline comment `# Only required for the legacy API-key auth path below`, and document service-specific key quirks in the legacy block (such as `azure-ai-translation-text` requiring a `region=` parameter when authenticating with a key against the global endpoint while token-credential authentication requires a custom subdomain endpoint).
- **Universal Context Manager Enforcement**: Wrap every client instantiation across the entire skill body in `with` (sync) or `async with` (async), and wrap async `DefaultAzureCredential` from `azure.identity.aio` in `async with credential:` alongside the client, with exceptions permitted solely for the standalone Authentication construction snippet and framework lifespan patterns where the application owns the client (e.g., FastAPI `lifespan`).

### Multi-Language Authentication & Idiom Patterns

Use `DefaultAzureCredential` for local development and constrain it via `AZURE_TOKEN_CREDENTIALS=prod` (or `<specific_credential>`) or use a specific credential (`ManagedIdentityCredential`, `WorkloadIdentityCredential`) in production for Python, C#, Java, TypeScript, and Go. For Rust (which operates without `DefaultAzureCredential`), explicitly use `DeveloperToolsCredential` for local development and `ManagedIdentityCredential` for production:

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

Enforce language-specific SDK idioms across all examples (detailed in `references/azure-sdk-patterns.md`):

- **Python**: `ItemPaged`, `LROPoller`, context managers, Sphinx docstrings. When an SDK provides both sync and async clients, present both forms as equal first-class options in separate self-contained `### Sync` and `### Async` subsections; when an SDK is sync-only or async-only, document exclusively the supported mode.
- **.NET**: `Response<T>`, `Pageable<T>`, `Operation<T>`, mocking support.
- **Java**: Builder pattern, `PagedIterable`/`PagedFlux`, Reactor types.
- **TypeScript**: `PagedAsyncIterableIterator`, `AbortSignal`, browser considerations.
- **Go**: `context.Context` as first argument, `runtime.Pager[T]` via `New*Pager()` + `More()/NextPage(ctx)`, `runtime.Poller[T]` via `Begin*` + `PollUntilDone(ctx, nil)`, `to.Ptr(...)` helpers, and typed `*azcore.ResponseError`. In documentation prose, use the short package name (e.g., `azblob`); in code and import examples, use the full module import path (e.g., `github.com/Azure/azure-sdk-for-go/sdk/storage/azblob`).
- **Rust**: Installation via `cargo add`, conditional dependency rule for `azure_core`, `Response<T>`, `Pager<T>`, `RequestContent::from()`, `.into_model()`, explicit credential types, and RBAC roles for Entra ID authentication.

### Required User-Facing Best Practices in Generated Skills

#### Python, .NET, Java, TypeScript, and Go Skills

Insert the following items **verbatim** (adapted only for target language/SDK identifiers) as the opening items of the generated skill's `## Best Practices` section:

```markdown
1. **Do not mix sync and async clients in the same call path.** Use either `azure.xxx` sync clients or `azure.xxx.aio` async clients within a single call path — do not combine both.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use `DefaultAzureCredential`** for code that runs locally. For code that runs in Azure, either constrain `DefaultAzureCredential` with `AZURE_TOKEN_CREDENTIALS=prod` (or a specific target credential) or use a specific token credential directly (e.g. `ManagedIdentityCredential`, `WorkloadIdentityCredential`).
```

Apply the following variant adjustments when the skill's SDK shape matches a specialized category:

| Skill type | Adjust item #1 to | Adjust item #2 to |
| :--- | :--- | :--- |
| Async-only SDK (e.g. voicelive) | "This SDK is async-only; use the `.aio` namespace throughout." | keep standard |
| Framework guidance that is async-oriented (for example some agent frameworks) | "Use the framework's documented async patterns where required, but do not claim async is globally preferred for Azure Python SDKs." | keep standard |
| Provider-pattern (OpenTelemetry exporters/distro) | keep standard | "Call `provider.shutdown()` / `flush()` at process exit to flush telemetry — providers are not context managers." |
| REST-over-httpx skills | keep standard | "Use `with httpx.Client(...) as client:` (sync) or `async with httpx.AsyncClient(...) as client:` (async) so connections pool and close deterministically." |
| Identity skill | keep standard | "Use credentials as context managers (`with DefaultAzureCredential() as credential:`) when they own token caches / HTTP transports you want cleaned up; for async, use `async with` on credentials from `azure.identity.aio`." |
| FastAPI (non-Azure) | "Pick `def` or `async def` per endpoint based on whether you call async I/O; do not mix sync and blocking calls in one handler." | "Manage long-lived resources (DB pools, HTTP clients) in `lifespan` and inject via `Depends`; use `with`/`async with` for per-request resources." |
| Pure model/schema skill (no I/O, e.g. pydantic) | **skip both** — not applicable | **skip** |

#### Rust Skills

Insert the following 7 items as the opening rules of every Rust skill's `## Best Practices` section:

1. **Use `cargo add` to manage dependencies, never edit `Cargo.toml` directly.** Always use `cargo add <crate>` or `cargo remove <crate>` instead of manually modifying the manifest file. Official crates are published on crates.io and should be added via cargo.
2. **Add `azure_core` to `Cargo.toml` only when you import `azure_core` types directly.** If your code imports types like `azure_core::http::Url`, `azure_core::http::RequestContent`, or `azure_core::error::ErrorKind`, explicitly add `azure_core` to your dependencies. If you only use types re-exported by service crates (e.g., via `use azure_storage_blob::BlobClient`), a direct `azure_core` dependency is optional.
3. **Use `DeveloperToolsCredential` for local development and `ManagedIdentityCredential` for production.** The Rust SDK does not support `DefaultAzureCredential`, so explicitly use the appropriate credential in each environment.
4. **Use `RequestContent::from()` to wrap upload data.** When uploading data (e.g., blobs), wrap the content in `RequestContent::from(your_data)` to ensure proper handling by the SDK.
5. **Assign appropriate RBAC roles for Entra ID auth.** For production authentication using Entra ID, ensure the identity has the necessary RBAC role assigned (e.g., "Storage Blob Data Contributor" for blob write access).
6. **Always verify package versions using crates.io.** Before using a package, check its version on [crates.io](https://crates.io/) to ensure you are using a stable and supported release.
7. **Future-proof `#[non_exhaustive]` model structs and enums.** Azure Rust SDK request/response models are frequently `#[non_exhaustive]`. For **externally constructible** structs that also derive `Default`, end the initializer with `..Default::default()` (even if every currently known field is set), suppressing the lint locally with `#[allow(clippy::needless_update)]` when needed. For **truly `#[non_exhaustive]`** structs (where Rust forbids external struct literals, producing E0639), use the provided constructor or builder, or construct a default value first and then mutate the fields you need. When matching an SDK enum, include a wildcard (`_`) arm so future service-added variants do not break the match. If a skill documents model construction, its code examples MUST demonstrate this pattern. See `references/azure-sdk-patterns.md` (Model Types) for the full example.

### Handling Deprecated or Rebranded SDKs

When an Azure SDK is deprecated or rebranded:

1. Insert the migration notice callout at the top of the skill:

```markdown
> **⚠️ MIGRATION NOTICE**: The [Old Service Name] has been rebranded to **[New Service Name]**. While the package `old-package-name` remains available for compatibility, **new projects should use `new-package-name`** which provides the latest features and updates.
>
> **For new projects**: Use the `new-package-name` package instead.
>
> **This skill remains valid** for existing projects using `old-package-name`, but be aware you're using the legacy package name. The API patterns shown here are compatible with both packages.
```

2. Present both installation options under `## Installation`:

```markdown
## Installation

### Legacy Package (Old Name)

```xml
<dependency>
<groupId>com.azure</groupId>
<artifactId>azure-old-package</artifactId>
<version>4.2.0</version>
</dependency>
```

### Recommended Package (New Name)

**For new projects, use the rebranded package:**

```xml
<dependency>
<groupId>com.azure</groupId>
<artifactId>azure-new-package</artifactId>
<version>1.0.0</version>
</dependency>
```

> **Note**: The API patterns in this skill apply to both packages. Replace package names and imports as needed when using `azure-new-package`.
```

3. Select update versus new-skill creation based on API compatibility, and cross-reference between old and new skills:
   - **Compatible API (same or similar class/method names)**: Update the existing skill in place (e.g., `azure-ai-formrecognizer-java` ➔ `azure-ai-documentintelligence`).
   - **Significantly changed API**: Create a new skill accompanied by `references/migration.md` (e.g., `azure-communication-callingserver-java` ➔ `azure-communication-callautomation`).

### Canonical Azure SDK Skill Template & Frontmatter Schema

Use the following structure and benchmarking frontmatter schema when authoring `SKILL.md` (all `metadata` values must be flat strings):

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

<!-- Token Count: ~1180 (target: 1100, max: 1500) -->

## Installation

```bash
pip install azure-ai-example
```

## Environment Variables

```bash
AZURE_EXAMPLE_ENDPOINT=https://<resource>.example.azure.com
AZURE_TOKEN_CREDENTIALS=prod # Required only if DefaultAzureCredential is used in production
```

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

```python
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
```

## Core Workflow

```python
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

```

## Reference Files

| File | Contents |
| :--- | :--- |
| [references/capabilities.md](references/capabilities.md) | Capability index (hero coverage + links to deep-dives) |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Concrete non-hero examples |
| [references/tools.md](references/tools.md) | Tool integrations |
| [references/streaming.md](references/streaming.md) | Event streaming patterns |
```

## End-to-End Execution Workflow

### Step 1: Gather Prerequisite SDK Context

Verify that the user has provided the required context before authoring any SDK or API skill:

| Required | Example | Purpose |
| :--- | :--- | :--- |
| **SDK Package** | `azure-ai-agents`, `Azure.AI.OpenAI`, `azblob` | Identifies the exact SDK |
| **Documentation URL** | `https://learn.microsoft.com/en-us/azure/ai-services/...` | Primary source of truth |
| **Repository** (optional) | `Azure/azure-sdk-for-python`, `Azure/azure-sdk-for-go` | For code patterns |

If any required parameter is absent, pause authoring and prompt the user with:

```
To create this skill, I need:
1. The SDK package name (e.g., azure-ai-projects)
2. The Microsoft Learn documentation URL or GitHub repo
3. The target language (py/dotnet/ts/java/go)
```

Query `microsoft-docs` MCP to verify current API patterns against the latest SDK version:

```bash
# Use microsoft-docs MCP to get current API patterns
# Query: "[SDK name] [operation] [language]"
# Verify: Parameters match the latest SDK version
```

### Step 2: Scope Operations, Triggers & Reusable Resources

Identify covered SDK operations, activation trigger phrases, and common developer errors, then map recurring requirements to skill components:

| Example Task | Reusable Resource |
| :--- | :--- |
| Same auth code each time | Code example in SKILL.md |
| Complex streaming patterns | `references/streaming.md` |
| Tool configurations | `references/tools.md` |
| Error handling patterns | `references/error-handling.md` |

### Step 3: Assign Product Area Category

Classify the skill by Azure service family, primary use case, and sibling skills in `skills/<language>/<category>/`:

| Category | Description | Examples |
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

### Step 4: Author Bundled Resources & `SKILL.md`

1. Write bundled files under `references/`, `scripts/`, and `assets/` first (`references/capabilities.md`, `references/non-hero-scenarios.md`, and feature deep-dives).
2. Write `.github/skills/<skill-name>/SKILL.md` using the naming convention `azure-<service>-<subservice>-<language>` (e.g., `azure-ai-agents-py`, `azure-cosmos-java`, `azure-storage-blob-ts`, `azure-storage-blob-go`).
3. Measure section token counts, refactor any section exceeding its ceiling into `/references/`, populate the optional `benchmark_tokens_*` and `benchmark_quality_*` metadata strings in frontmatter, and insert the `<!-- Token Count: ~XXXX (target: 1100, max: 1500) -->` comment below H1.

### Step 5: Register Category Symlink

Create a short-name symlink (removing the `azure-` prefix and `-<language>` suffix) under `skills/<language>/<category>/<short-name>` pointing to `../../../.github/skills/<full-skill-name>` and verify the link target:

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

### Step 6: Author Acceptance Criteria, Test Scenarios & Run Evaluations

#### 6.1 Create Acceptance Criteria (`tests/scenarios/<skill-name>/acceptance-criteria.md`)

Create `acceptance-criteria.md` inside the `tests/scenarios/<skill-name>/` directory (separate from the skill folder) grounded in (1) official Microsoft Learn docs via `microsoft-docs` MCP, (2) SDK source code from the repository, and (3) bundled reference files, documenting import paths, authentication patterns, client initialization, `.aio` async variants, and forbidden anti-patterns:

```markdown
# Acceptance Criteria: <skill-name>

**SDK**: `package-name`
**Repository**: https://github.com/Azure/azure-sdk-for-<language>
**Purpose**: Skill testing acceptance criteria

---

## 1. Correct Import Patterns

### 1.1 Client Imports

#### ✅ CORRECT: Main Client

```python
from azure.ai.mymodule import MyClient
from azure.identity import DefaultAzureCredential
```

#### ❌ INCORRECT: Wrong Module Path

```python
from azure.ai.mymodule.models import MyClient # Wrong - Client is not in models
```

## 2. Authentication Patterns

#### ✅ CORRECT: DefaultAzureCredential + context manager

```python
credential = DefaultAzureCredential()
with MyClient(endpoint, credential) as client:
client.do_thing()
```

#### ❌ INCORRECT: Hardcoded Credentials

```python
client = MyClient(endpoint, api_key="hardcoded") # Security risk
```

#### ❌ INCORRECT: Connection string / account key when Entra is supported

```python
client = MyClient.from_connection_string(os.environ["CONNECTION_STRING"]) # Bypasses Entra audit/rotation
```

#### ❌ INCORRECT: Bare client without context manager

```python
client = MyClient(endpoint, credential) # Leaks HTTP transport on exception / interpreter exit
client.do_thing()
```
```

#### 6.2 Create Test Scenarios (`tests/scenarios/<skill-name>/scenarios.yaml`)

Define test scenarios covering at least one hero scenario and one non-hero scenario (when supported by the SDK), with each scenario targeting a single pattern via `expected_patterns`, `forbidden_patterns`, a complete working `mock_response`, and filter `tags` (`basic`, `authentication`, `async`, `streaming`, `tools`):

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

#### 6.3 Execute Test Harness & Vally Evaluation

Run the scenario harness to verify 100% pass rate and zero false positives on mock responses:

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

When a Vally evaluation spec exists under `tests/scenarios/<skill-name>/vally/eval.yaml`, execute `vally lint` and `vally eval` (pass `vally eval` with zero error-severity findings when `COPILOT_TOKEN` is available, or pass `vally lint` in lint-only environments matching [`Vally Evaluation`](../../workflows/vally-evaluation.yml); skip this step for skills without a `vally/` directory):

```bash
# If the eval spec uses the shared Rust custom grader plugin, build it first.
(cd tests/scenarios/_shared/vally/grader-plugins/rust-cargo-build-failure && npm install && npm run build)

vally lint --eval-spec tests/scenarios/<skill-name>/vally/eval.yaml \
  --grader-plugin tests/scenarios/_shared/vally/grader-plugins/rust-cargo-build-failure \
  --strict

vally eval --eval-spec tests/scenarios/<skill-name>/vally/eval.yaml \
  --grader-plugin tests/scenarios/_shared/vally/grader-plugins/rust-cargo-build-failure
```

### Step 7: Synchronize Catalog & Documentation Artifacts

1. Update `README.md` skill catalog:
   - Total skill count (line ~73: `> N skills in...`)
   - Skill Explorer link count (line ~15: `Browse all N skills`)
   - Language count table (lines ~77-83)
   - Language section count (e.g., `> N skills • suffix: -py`)
   - Category count (e.g., `<summary><strong>Foundry & AI</strong> (N skills)</summary>`)
   - Skill row inserted in alphabetical order within its category
   - Test coverage summary (line ~622: `**N skills with N test scenarios**`)
   - Test coverage table (skill count, scenario count, and top skills for the language)
2. Regenerate `docs-site/src/data/skills.json` and rebuild the Astro documentation site into `docs/` for GitHub Pages:
   ```bash
   (cd docs-site && npx tsx scripts/extract-skills.ts && npm run build)
   ```
3. Verify that the skill count in `AGENTS.md` matches the updated catalog.

### Step 8: Regenerate Existing Skills from Latest SDK Sources

Execute the idempotent regeneration workflow when refreshing existing skills with stale examples, updated API signatures, or revised package guidance:

1. **Enforce the API Surface Parity Gate**:
   - Identify every SDK client, operation group, model constructor, enum member, and `begin_*` long-running operation method shown in snippets.
   - Verify each symbol, module import path, and signature against the authoritative language source (Microsoft Learn API reference for Python/.NET/Java/TS/Go; `https://github.com/Azure/azure-sdk-for-rust` and crates.io for Rust).
   - Update snippets to match current authoritative shapes (such as nested `properties=...` models, renamed methods, or `begin_*` LRO methods) and replace outdated compatibility shortcuts.
2. **Enforce the Scenario Coverage Gate**:
   - Represent every hero scenario from authoritative docs/samples in `SKILL.md` with copy-pastable snippets (or explicit links to bundled reference files when exceeding token limits), and validate hero flows in `scenarios.yaml`.
   - Include at least one high-value non-hero scenario (update/patch, delete/cleanup, export/import, advanced auth mode, paging/filtering, retries/error handling, or LRO monitoring) when supported by the SDK (or note explicitly when no distinct non-hero scenario applies).
   - Populate `references/capabilities.md` (concise index of hero and non-hero coverage) and `references/non-hero-scenarios.md` (concrete non-hero examples).
   - Include an operation-group table for broad/management SDKs distinguishing snippet-covered groups from reference-only groups.
3. **Validate Regenerated Skill & Language Gates**:
   - Run `(cd tests && pnpm harness <skill-name> --mock --verbose)` and Vally evals if present.
   - For Rust skills, verify the presence of the exact opening rules in `## Best Practices`:
     ```bash
     rg -n "Use `cargo add` to manage dependencies, never edit `Cargo.toml` directly|Add `azure_core` only when importing `azure_core` types directly" .github/plugins/azure-sdk-rust/skills/**/SKILL.md
     ```
4. **Rebuild Docs & Record Audit Trail**:
   - Run `(cd docs-site && npx tsx scripts/extract-skills.ts && npm run build)`.
   - Record in PR/commit notes: (a) upstream docs/examples used, (b) snippets and signatures corrected, and (c) tests/evals executed and their outcomes.

#### Python Plugin Batch Regeneration Recipe (`azure-sdk-python`)

Execute the following sequence when regenerating all Python skills under `azure-sdk-python`:

1. Scope canonical targets in `.github/plugins/azure-sdk-python/skills/`:
   ```bash
   # Canonical source of truth for Python plugin skills
   ls .github/plugins/azure-sdk-python/skills/*/SKILL.md
   ```
2. Query `microsoft-docs` MCP first for each skill, verify installed package versions via `pip show <package>`, inspect the installed package or official API reference for every symbol/signature, apply Azure Python enforcement rules (standard section order, verbatim `## Authentication & Lifecycle` callout, `with` / `async with` lifecycle wrappers, mandatory `## Best Practices` opening rules, `references/capabilities.md`, and `references/non-hero-scenarios.md`), and apply language-specific variants for non-Azure skills (`fastapi-router-py`, `pydantic-models-py`).
3. Validate frontmatter structure and run the Python mock harness across all `-py` scenarios:
   ```bash
   # Fast frontmatter/structure validation for every Python skill
   python .github/skills/skill-creator/scripts/quick_validate.py .github/plugins/azure-sdk-python/skills/<skill-name>

   # Run Python skill harness in mock mode (all *-py scenarios)
   (cd tests && pwsh ./run-harness-by-language.ps1 -Language py -Mock)
   ```
4. Synchronize `.github/skills/<name>` symlinks with `.github/plugins/azure-sdk-python/skills/` and rebuild documentation artifacts:
   ```bash
   # Ensure .github/skills links point at plugin canonical skills
   python .github/scripts/sync_skill_links.py --plugin azure-sdk-python --check
   python .github/scripts/sync_skill_links.py --plugin azure-sdk-python --apply

   # Refresh docs site data after content changes
   (cd docs-site && npx tsx scripts/extract-skills.ts && npm run build)
   ```

## Pre-Release Verification Gate

Verify that every criterion below is satisfied before completing skill authoring or regeneration:

- **Prerequisites & Grounding**:
  - [ ] User provided SDK package name, documentation URL, or repository reference (for SDK/API skills)
  - [ ] API patterns verified via `microsoft-docs` MCP and checked against the current official language-specific API reference or upstream SDK repository
- **Structure, Token Budget & Code Hygiene**:
  - [ ] YAML frontmatter `name` matches `.github/skills/<name>/SKILL.md` and `description` (~200 chars target, 1,024 chars max) states both scope and trigger phrases
  - [ ] `SKILL.md` stays under 500 lines and within the 1,500-token maximum (annotated with `<!-- Token Count: ~XXXX (target: 1100, max: 1500) -->` below H1), with optional `benchmark_tokens_*` and `benchmark_quality_*` metadata formatted as flat strings
  - [ ] Feature tables list 3-5 core methods (operation-group coverage table included for broad/management SDKs)
  - [ ] Authentication uses environment variables and language-standard Entra ID credentials (`DefaultAzureCredential` for local dev and constrained `AZURE_TOKEN_CREDENTIALS=prod` or specific credential in production for Python/.NET/Java/TS/Go; `DeveloperToolsCredential` local dev and `ManagedIdentityCredential` production for Rust)
  - [ ] Python skills include the verbatim `## Authentication & Lifecycle` callout block, wrap all clients and async credentials in `with` / `async with`, present separate `### Sync` and `### Async` examples when both are supported, and open `## Best Practices` with the mandatory user-facing rules (or documented SDK-shape variant)
  - [ ] Rust skills open `## Best Practices` with the `cargo add` dependency rule and conditional `azure_core` direct-import rule, and handle `#[non_exhaustive]` structs/enums properly
  - [ ] Core workflow examples are immediately copy-pastable and include resource cleanup/delete operations
  - [ ] `references/capabilities.md` indexes hero and non-hero coverage and `references/non-hero-scenarios.md` provides concrete non-hero examples
- **Categorization, Testing & Catalog Sync**:
  - [ ] Skill created in `.github/skills/<skill-name>/` with symlink registered at `skills/<language>/<category>/<short-name>` pointing to `../../../.github/skills/<skill-name>`
  - [ ] `tests/scenarios/<skill-name>/acceptance-criteria.md` and `tests/scenarios/<skill-name>/scenarios.yaml` cover both hero and non-hero scenarios and pass `pnpm harness <skill-name> --mock` (plus `vally lint` / `vally eval` when a Vally spec exists)
  - [ ] `README.md` catalog counts/tables, `docs-site/src/data/skills.json` + `docs/`, and `AGENTS.md` skill counts are synchronized
