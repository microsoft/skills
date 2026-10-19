---
name: skill-creator
description: Architect, validate, and regenerate modular AI coding agent skills for Azure SDKs and Microsoft Foundry services when creating new skills or refreshing existing skills, excluding direct SDK application development outside skill authoring workflows.
---

# Skill Creator

## Core Architecture & Operational Principles

Modular skills extend AI coding agent capabilities across Azure SDKs and Microsoft Foundry services through four structural layers:

1. **Procedural knowledge** — Multi-step execution workflows for specific engineering domains
2. **SDK expertise** — Client initialization, authentication, pagination, long-running operations, and error handling for Azure services
3. **Domain context** — Data schemas, business logic, and repository-specific architecture patterns
4. **Bundled resources** — Reusable scripts, deep-dive reference files, and output templates for complex tasks

### Mandatory Input Context Gate

Require the user to supply the SDK package name, official documentation URL, or upstream repository reference before authoring any SDK or API skill, excluding ungrounded skill generation from pre-trained weights alone. Prompt the user with the following request block whenever any required parameter is absent from the input:

```
To create this skill, I need:
1. The SDK package name (e.g., azure-ai-projects)
2. The Microsoft Learn documentation URL or GitHub repo
3. The target language (py/dotnet/ts/java/go)
```

### Context Window Economy

Restrict domain and procedural skills to specialized delta knowledge beyond baseline agent capabilities. Ground SDK and API skills strictly in verified package structures, method signatures, and configuration contracts from the supplied documentation URL or repository reference.

### Authoritative Documentation Verification

Instruct target agents to query the `microsoft-docs` MCP server for current API patterns prior to code generation and verify parameter compatibility against the installed SDK version:

```markdown
## Before Implementation

Search `microsoft-docs` MCP for current API patterns:

- Query: "[SDK name] [operation] python"
- Verify: Parameters match your installed SDK version
```

### Specificity Calibration by Degrees of Freedom

Align instruction specificity with the operational constraints of the target task:

| Freedom    | When                             | Example          |
| ---------- | -------------------------------- | ---------------- |
| **High**   | Multiple valid approaches        | Text guidelines  |
| **Medium** | Preferred pattern with variation | Pseudocode       |
| **Low**    | Must be exact                    | Specific scripts |

### Three-Tier Progressive Disclosure

Distribute skill content across three loading tiers to bound active context consumption:

1. **Metadata** (~100 words) — Persistent in context across all turns
2. **SKILL.md body** (<5k words, maximum 500 lines) — Loaded upon skill trigger activation
3. **References** (unbounded) — Loaded on demand from `/references/` subdirectories

Extract detailed subsections into `/references/` files whenever `SKILL.md` approaches the 500-line ceiling.

## Skill Directory Topology & Component Specifications

Organize each skill package according to the following directory layout:

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

### SKILL.md Structural Contract

- **Frontmatter**: Define `name` (matching `.github/skills/<name>/SKILL.md`) and `description` (targeting ~200 characters, maximum 1,024 characters) containing both functional capabilities and activation trigger phrases, excluding placement of "when to use" trigger conditions inside the `SKILL.md` body (which loads only after activation).
- **Body**: Maintain `SKILL.md` under 500 lines, ordered strictly by the **Skill Section Order** for Azure SDK skills or by domain workflow sequence for general domain skills, excluding meta-documentation `README.md` files inside the skill directory.

### Bundled Resource Allocation

Keep `/references/` paths flat at one level deep (`references/<file>.md`), excluding nested reference subdirectories:

| Type          | When to Include                          | Examples                                                   |
| ------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `scripts/`    | Reused code patterns                     | Auth setup, CLI scripts                                    |
| `references/` | Feature deep-dives and overflow examples | `capabilities.md` index, `non-hero-scenarios.md`, API docs |
| `assets/`     | Output templates                         | Boilerplate code, images                                   |

## Azure SDK Skill Structural & Token Specifications

### Section Token Budget

Enforce the following token ceilings across every Azure SDK `SKILL.md` file:

| Section                       | Target           | Absolute Max     |
| ----------------------------- | ---------------- | ---------------- |
| Installation + Env Vars       | 100 tokens       | 150              |
| Authentication & Lifecycle    | 200 tokens       | 300              |
| Core Workflow (1 example)     | 300 tokens       | 400              |
| Feature Tables                | 200 tokens       | 300              |
| Best Practices (6-8 items)    | 200 tokens       | 250              |
| References (reference/ links) | 100 tokens       | 150              |
| **Total SKILL.md**            | **~1100 tokens** | **~1500 tokens** |

- Refactor overflow content into `/references/` files whenever any individual section or the total file exceeds the Absolute Max ceiling or approaches 500 lines.
- Insert the token count annotation `<!-- Token Count: ~XXXX (target: 1100, max: 1500) -->` immediately below the H1 title (`# SDK Name`).

### Reference Extraction Partitioning

Partition content between `SKILL.md` and `/references/` according to usage frequency, cognitive load, and snippet length:

| Signal         | Move to `/references/`              | Keep in SKILL.md       |
| -------------- | ----------------------------------- | ---------------------- |
| Use frequency  | <20% of typical use                 | ~80%+ of workflows     |
| Cognitive load | Advanced patterns, multiple options | Single happy path      |
| Example length | >10 lines, multiple paths           | 1-5 lines, single path |

Route specialized topics to dedicated `/references/` files according to the following mapping:

- **Batch operations** ➔ `/references/batch-operations.md`
- **Error handling** (beyond try-except) ➔ `/references/error-handling.md`
- **Performance tuning** ➔ `/references/performance.md`
- **Alternative workflows** ➔ `/references/workflows-comparison.md`
- **Streaming/events** ➔ `/references/streaming.md`
- **Advanced auth** ➔ `/references/auth-strategies.md`
- **Tool integration** ➔ `/references/tools.md`
- **Breaking changes** ➔ `/references/migration.md`

### Core Workflow Selection Discipline

Classify the target Azure SDK into one of two workflow topologies before drafting `SKILL.md`:

- **Topology 1 — Single Dominant Core Workflow (~80% of use cases)**:
  1. Designate the primary pattern as the core workflow.
  2. Present solely this workflow in `SKILL.md` via one complete, runnable example (for Python SDKs supporting both synchronous and asynchronous clients, present paired `### Sync` and `### Async` subsections as a single unified workflow).
  3. Extract secondary patterns (`batch-operations.md`, `error-handling.md`, `performance.md`, `workflows-comparison.md`) to `/references/`.
  + *Calibration Anchor*: Azure Key Vault Secrets designates secret retrieval via managed identity as the core workflow in `SKILL.md`, while routing local development with `DefaultAzureCredential`, workload identity, and service-principal credentials (client secret or certificate) to `/references/`.

- **Topology 2 — Multiple Equally Valid Hero Workflows (e.g., authentication strategies, deployment targets)**:
  1. Include every primary hero scenario in `SKILL.md` whenever selecting an alternative approach represents an equally valid primary production or development path rather than an edge case.
  2. Provide one complete, runnable example per hero scenario in `SKILL.md`.
  3. Route trade-off matrices, secondary credential variants, and extended comparisons to `/references/workflows-comparison.md`, excluding classification of valid primary alternatives as advanced edge cases.
  + *Calibration Anchor*: Azure Identity SDK retains primary local-development and production-safe credential flows in `SKILL.md`, while routing detailed comparisons across `AzureCliCredential`, workload identity, and service principal variants to `/references/credential-types.md`.

### Mandatory Skill Section Order

Structure every Azure SDK `SKILL.md` in the following eight-section sequence:

1. **Title** — `# SDK Name` followed immediately by `<!-- Token Count: ~XXXX (target: 1100, max: 1500) -->`.
2. **Installation** — Package installation command (`pip install`, `npm install`, `cargo add`, etc.).
3. **Environment Variables** — Required environment variables with inline comments specifying when each variable is required; include `AZURE_TOKEN_CREDENTIALS` (set to `prod` or `<specific_credential>`) whenever `DefaultAzureCredential` is used in production.
4. **Authentication & Lifecycle** — Language-specific Entra ID authentication and client resource management (opening with the verbatim callout block for Python skills).
5. **Core Workflow** — Minimal viable runnable example(s) adhering to the Core Workflow Selection Discipline and including resource cleanup (`delete`).
6. **Feature Tables** — Concise tables covering 3–5 core clients, methods, or tools (plus an operation-group coverage table for broad management SDKs).
7. **Best Practices** — Numbered list of 6–8 items (maximum 1 code example per bullet) opening with the mandatory language-specific rules.
8. **Reference Links** — Table linking to `/references/*.md`, including `references/capabilities.md` and `references/non-hero-scenarios.md` for all Azure SDK skills.

## Authentication, Lifecycle & Language Idioms

### Required Python Authentication & Lifecycle Callout

Apply this rule to Python Azure SDK skills (`-py` suffix) that manage client lifecycles, excluding non-Azure Python skills without client lifecycles (such as `pydantic-models-py`).

Insert the following callout block **verbatim** immediately below the `## Authentication & Lifecycle` heading prior to any code samples:

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

Apply the following subdomain adjustments and code sample rules:

- **API-Key-Only SDK Subdomain**: When an SDK lacks Entra ID support (such as legacy speech REST endpoints or websocket APIs requiring subscription keys), retain Rule #2 (context managers) and replace Rule #1 with a single sentence stating that the SDK requires API-key authentication because Entra ID authentication is unavailable.
- **Async-Only SDK Subdomain**: When an SDK is exclusively asynchronous (such as `azure-ai-voicelive`), retain both rules and include only the `Async:` bullet under Rule #2.
- **Context Manager Enforcement**: Wrap every client instantiation across all sections of the skill in `with` / `async with` (and wrap async `DefaultAzureCredential` from `azure.identity.aio` in `async with credential:` alongside the client), excluding only standalone constructor-illustration lines or framework-owned application lifespan managers (such as FastAPI `lifespan`).
- **Legacy API-Key Compatibility**: Present `DefaultAzureCredential` in the primary authentication example, and retain officially supported API-key examples inside a subordinate `### Legacy: API Key (existing keyed deployments)` subsection placed immediately after the primary `DefaultAzureCredential` block under `## Authentication & Lifecycle`. Include a one-line notice stating that new code uses `DefaultAzureCredential` while the keyed path supports existing deployments, declare `<SERVICE>_KEY` in the `## Environment Variables` block with `# Only required for the legacy API-key auth path below`, and document service-specific key parameters (such as the `region=` parameter required by `azure-ai-translation-text` when authenticating with a key against the global endpoint instead of a custom subdomain endpoint).

### Multi-Language Authentication Patterns

Configure local development with `DefaultAzureCredential` (or `DeveloperToolsCredential` in Rust) and constrain production environments via `AZURE_TOKEN_CREDENTIALS=prod` (or `<specific_credential>`) or explicit production credential classes (`ManagedIdentityCredential`, `WorkloadIdentityCredential`), reading all endpoints and secrets from environment variables and excluding hardcoded credentials:

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

## Standard Verbs, Language Idioms & Mandatory Best Practices

### Standard SDK Verb Semantics

Apply consistent Azure SDK method verb semantics across all target languages:

| Verb     | Behavior                     |
| -------- | ---------------------------- |
| `create` | Create new; fail if exists   |
| `upsert` | Create or update             |
| `get`    | Retrieve; error if missing   |
| `list`   | Return collection            |
| `delete` | Succeed even if missing      |
| `begin`  | Start long-running operation |

### Language-Specific Idioms

Consult `references/azure-sdk-patterns.md` and enforce the following idioms per target language:

- **Python**: Use `ItemPaged`, `LROPoller`, context managers (`with` / `async with`), and Sphinx docstrings. Present both synchronous and asynchronous clients with equal prominence in separate `### Sync` and `### Async` subsections when the SDK supports both modes; document solely the available mode when the SDK is sync-only or async-only, excluding mixed sync and async calls within a single code example.
- **.NET**: Use `Response<T>`, `Pageable<T>`, `Operation<T>`, and mocking-compatible client patterns.
- **Java**: Use the `*Builder` pattern, `PagedIterable` / `PagedFlux`, and Reactor types.
- **TypeScript**: Use `PagedAsyncIterableIterator`, `AbortSignal`, and browser-compatible patterns.
- **Go**: Pass `context.Context` as the first argument, iterate pages with `runtime.Pager[T]` via `New*Pager()` + `More()/NextPage(ctx)`, manage long-running operations with `runtime.Poller[T]` via `Begin*` + `PollUntilDone(ctx, nil)`, construct pointers with `to.Ptr(...)` helpers, inspect errors via typed `*azcore.ResponseError`, use the short package name (e.g., `azblob`) in documentation prose, and reserve the full module path (e.g., `github.com/Azure/azure-sdk-for-go/sdk/storage/azblob`) for import statements and code blocks.
- **Rust**: Manage dependencies via `cargo add`, apply the conditional `azure_core` dependency rule, use `Response<T>`, `Pager<T>`, `RequestContent::from()`, `.into_model()`, explicit `DeveloperToolsCredential` (local dev) and `ManagedIdentityCredential` (production), and document required Entra ID RBAC roles.

### Mandatory User-Facing Best Practices (Python, .NET, Java, TypeScript, Go)

Insert the following rules verbatim (adapted for target language syntax) as the **first entries** of the `## Best Practices` section in every generated skill:

```markdown
1. **Do not mix sync and async clients in the same call path.** Use either `azure.xxx` sync clients or `azure.xxx.aio` async clients within a single call path — do not combine both.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use `DefaultAzureCredential`** for code that runs locally. For code that runs in Azure, either constrain `DefaultAzureCredential` with `AZURE_TOKEN_CREDENTIALS=prod` (or a specific target credential) or use a specific token credential directly (e.g. `ManagedIdentityCredential`, `WorkloadIdentityCredential`).
```

Adapt items #1 and #2 according to the following subdomain variant matrix when the target library architecture differs from standard Azure SDK clients:

| Skill type                                                                    | Adjust item #1 to                                                                                                                   | Adjust item #2 to                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Async-only SDK (e.g. voicelive)                                               | "This SDK is async-only; use the `.aio` namespace throughout."                                                                      | keep standard                                                                                                                                                                                                                  |
| Framework guidance that is async-oriented (for example some agent frameworks) | "Use the framework's documented async patterns where required, but do not claim async is globally preferred for Azure Python SDKs." | keep standard                                                                                                                                                                                                                  |
| Provider-pattern (OpenTelemetry exporters/distro)                             | keep standard                                                                                                                       | "Call `provider.shutdown()` / `flush()` at process exit to flush telemetry — providers are not context managers."                                                                                                              |
| REST-over-httpx skills                                                        | keep standard                                                                                                                       | "Use `with httpx.Client(...) as client:` (sync) or `async with httpx.AsyncClient(...) as client:` (async) so connections pool and close deterministically."                                                                    |
| Identity skill                                                                | keep standard                                                                                                                       | "Use credentials as context managers (`with DefaultAzureCredential() as credential:`) when they own token caches / HTTP transports you want cleaned up; for async, use `async with` on credentials from `azure.identity.aio`." |
| FastAPI (non-Azure)                                                           | "Pick `def` or `async def` per endpoint based on whether you call async I/O; do not mix sync and blocking calls in one handler."    | "Manage long-lived resources (DB pools, HTTP clients) in `lifespan` and inject via `Depends`; use `with`/`async with` for per-request resources."                                                                              |
| Pure model/schema skill (no I/O, e.g. pydantic)                               | **skip both** — not applicable                                                                                                      | **skip**                                                                                                                                                                                                                       |

### Mandatory User-Facing Best Practices (Rust)

Insert the following seven rules as the opening items of the `## Best Practices` section in every Rust skill:

1. **Use `cargo add` to manage dependencies, never edit `Cargo.toml` directly.** Always use `cargo add <crate>` or `cargo remove <crate>` instead of manually modifying the manifest file. Official crates are published on crates.io and should be added via cargo.
2. **Add `azure_core` to `Cargo.toml` only when you import `azure_core` types directly.** If your code imports types like `azure_core::http::Url`, `azure_core::http::RequestContent`, or `azure_core::error::ErrorKind`, explicitly add `azure_core` to your dependencies. If you only use types re-exported by service crates (e.g., via `use azure_storage_blob::BlobClient`), a direct `azure_core` dependency is optional.
3. **Use `DeveloperToolsCredential` for local development and `ManagedIdentityCredential` for production.** The Rust SDK does not support `DefaultAzureCredential`, so explicitly use the appropriate credential in each environment.
4. **Use `RequestContent::from()` to wrap upload data.** When uploading data (e.g., blobs), wrap the content in `RequestContent::from(your_data)` to ensure proper handling by the SDK.
5. **Assign appropriate RBAC roles for Entra ID auth.** For production authentication using Entra ID, ensure the identity has the necessary RBAC role assigned (e.g., "Storage Blob Data Contributor" for blob write access).
6. **Always verify package versions using crates.io.** Before using a package, check its version on [crates.io](https://crates.io/) to ensure you are using a stable and supported release.
7. **Future-proof `#[non_exhaustive]` model structs and enums.** Azure Rust SDK request/response models are frequently `#[non_exhaustive]`. For **externally constructible** structs that also derive `Default`, end the initializer with `..Default::default()` (even if every currently known field is set), suppressing the lint locally with `#[allow(clippy::needless_update)]` when needed. For **truly `#[non_exhaustive]`** structs (where Rust forbids external struct literals, producing E0639), use the provided constructor or builder, or construct a default value first and then mutate the fields you need. When matching an SDK enum, include a wildcard (`_`) arm so future service-added variants do not break the match. If a skill documents model construction, its code examples MUST demonstrate this pattern. See `references/azure-sdk-patterns.md` (Model Types) for the full example.

## SDK Deprecation, Templates & Progressive Disclosure Patterns

### Deprecated or Rebranded SDK Handling

Update existing skills in-place when a rebranded SDK preserves compatible class and method names, or create a new skill paired with `references/migration.md` when the API surface changes substantially, cross-referencing both skills in each case:

- `azure-ai-formrecognizer-java` ➔ `azure-ai-documentintelligence` (rebranded service)
- `azure-communication-callingserver-java` ➔ `azure-communication-callautomation` (deprecated, with migration guide)

Insert the migration notice banner at the top of the skill and display both legacy and recommended installation blocks:

```markdown
> **⚠️ MIGRATION NOTICE**: The [Old Service Name] has been rebranded to **[New Service Name]**. While the package `old-package-name` remains available for compatibility, **new projects should use `new-package-name`** which provides the latest features and updates.
>
> **For new projects**: Use the `new-package-name` package instead.
>
> **This skill remains valid** for existing projects using `old-package-name`, but be aware you're using the legacy package name. The API patterns shown here are compatible with both packages.
```

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

### Benchmark Skill Qualification Criteria

Select reference skills for structural benchmarking only when they conform to the required `references/` architecture:

1. Total `SKILL.md` length stays at or below the 1,500-token ceiling.
2. Core workflow covers primary CRUD or hero operations without exhaustive feature permutations.
3. Each concept uses 1–2 focused code examples.
4. API summaries use structured tables (credential types, RBAC roles, client hierarchy).
5. Detailed parameter specifications link to official docs via `microsoft-docs` MCP.
6. Advanced patterns reside in `/references/`.
7. Both `references/capabilities.md` and `references/non-hero-scenarios.md` are present.

### Canonical Azure SDK Skill Template

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
| [references/capabilities.md](references/capabilities.md) | Capability index (hero coverage + links to deep-dives) |
| [references/non-hero-scenarios.md](references/non-hero-scenarios.md) | Concrete non-hero examples |
| [references/tools.md](references/tools.md) | Tool integrations |
| [references/streaming.md](references/streaming.md) | Event streaming patterns |                            |
```

### Progressive Disclosure Topologies

#### High-Level Guide with Deep-Dive References

```markdown
# SDK Name

## Quick Start

[Minimal example]

## Advanced Features

- **Streaming**: See [references/streaming.md](references/streaming.md)
- **Tools**: See [references/tools.md](references/tools.md)
```

#### Multi-Language Reference Partitioning

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

#### Feature-Scoped Reference Partitioning

```
azure-ai-agents/
├── SKILL.md (core workflow)
└── references/
    ├── tools.md
    ├── streaming.md
    ├── async-patterns.md
    └── error-handling.md
```

### Bundled Design Pattern References

| Reference                          | Contents                             |
| ---------------------------------- | ------------------------------------ |
| `references/workflows.md`          | Sequential and conditional workflows |
| `references/output-patterns.md`    | Templates and examples               |
| `references/azure-sdk-patterns.md` | Language-specific Azure SDK patterns |

## Contrastive Calibration & Anti-Pattern Remediation Matrix

Enforce the target patterns below and eliminate token-bloat and structural anti-patterns across all authored skills:

| Anti-Pattern Category | Prohibited Pattern (Source Violation) | Required Target Pattern (Calibrated Specification) | Token & Operational Impact |
| :--- | :--- | :--- | :--- |
| **Exhaustive API Reference** | Listing all 50 SDK methods in a feature table with code samples for every variant | Present 3–5 core methods in a feature table and link to the official Azure API reference via `microsoft-docs` MCP | Saves 400–600 tokens; eliminates selection paralysis |
| **Multiple Solutions in Main Body** | Showing approaches A, B, C, and D to paginate results inside `SKILL.md` | Show primary pagination (`Use ItemPaged for sync pagination`) in `SKILL.md` and link alternatives to `/references/` | Saves 50–100 tokens per alternate path |
| **Mixed Proficiency Tiers** | Combining basic client concepts, custom retry policies, and circuit breakers in `SKILL.md` | Restrict `SKILL.md` to the 80% core workflow and extract advanced patterns to `/references/` | Saves 200–300 tokens per tier (600–900 tokens total) |
| **Restating Official Documentation** | Explaining constructor parameters in prose (`The CosmosClient constructor takes an endpoint (string) and credential (TokenCredential)...`) | Present executable code (`client = CosmosClient(endpoint, credential)`) and reference `microsoft-docs` MCP | Saves 50–100 tokens per parameter (300+ tokens on large APIs) |
| **Verbose Prose Over Code** | Writing multi-sentence instantiation narratives before showing syntax | Present the context-managed code block (`with CosmosClient(endpoint, credential) as client:`) immediately | Eliminates redundant prose overhead |
| **Missing Input Context** | Creating an SDK skill without user-provided package name or documentation URL | Require package name, documentation URL, or repository reference before authoring | Prevents hallucinated API surfaces |
| **Misplaced Trigger Conditions** | Placing "when to use" activation rules in the `SKILL.md` body | Declare all trigger phrases and usage conditions inside the YAML frontmatter `description` | Ensures triggers are visible prior to body loading |
| **Hardcoded Credentials & Unmanaged Clients** | Hardcoding API keys, using connection strings when Entra is supported, or omitting authentication sections | Enforce Entra ID credentials via environment variables and wrap clients in context managers | Eliminates security leaks and socket/transport exhaustion |
| **Unverified Imports & Stale Patterns** | Guessing module paths (e.g., `from azure.ai.mymodule.models import MyClient`) or using deprecated signatures | Verify exact import paths and signatures via `microsoft-docs` MCP and installed package inspection | Prevents runtime `ImportError` and signature mismatches |
| **Mixed Sync/Async & Omitted Best Practices** | Interleaving sync and async calls in one Python snippet or omitting the two mandatory Python Best Practices rules | Separate `### Sync` and `### Async` subsections and write both mandatory rules at the top of `## Best Practices` | Enforces deterministic async/sync execution |
| **Unindexed or Deeply Nested References** | Nesting `/references/` multiple levels deep, omitting `references/*.md` for non-hero flows, or adding `README.md` | Keep `/references/` one level deep with `capabilities.md` and `non-hero-scenarios.md`, excluding `README.md` | Preserves flat discovery and complete non-hero coverage |
| **Overclaiming API Coverage** | Claiming full API surface coverage from a single happy-path snippet | Declare hero-workflow optimization explicitly and include an operation-group table for broad SDKs | Accurately represents covered vs. reference-only groups |
| **Untested or Uncategorized Delivery** | Shipping new or regenerated skills without `acceptance-criteria.md`, `scenarios.yaml`, or `skills/<language>/<category>/` symlinks | Create acceptance criteria, test scenarios, and category symlinks for every skill | Guarantees automated regression verification and catalog discovery |

## End-to-End Execution Workflows

### Workflow A: Authoring a New Skill

1. **Gather & Verify SDK Context**:
   - Collect the required inputs from the user:
     | Required                  | Example                                                   | Purpose                  |
     | ------------------------- | --------------------------------------------------------- | ------------------------ |
     | **SDK Package**           | `azure-ai-agents`, `Azure.AI.OpenAI`, `azblob`            | Identifies the exact SDK |
     | **Documentation URL**     | `https://learn.microsoft.com/en-us/azure/ai-services/...` | Primary source of truth  |
     | **Repository** (optional) | `Azure/azure-sdk-for-python`, `Azure/azure-sdk-for-go`    | For code patterns        |
   - Query `microsoft-docs` MCP to retrieve current API signatures and verify parameter parity against the latest SDK release:
     ```bash
     # Use microsoft-docs MCP to get current API patterns
     # Query: "[SDK name] [operation] [language]"
     # Verify: Parameters match the latest SDK version
     ```

2. **Analyze Scope & Allocate Reusable Resources**:
   - Identify target SDK operations, activation triggers, and common developer error patterns, mapping each requirement to its designated resource container:
     | Example Task               | Reusable Resource              |
     | -------------------------- | ------------------------------ |
     | Same auth code each time   | Code example in SKILL.md       |
     | Complex streaming patterns | `references/streaming.md`      |
     | Tool configurations        | `references/tools.md`          |
     | Error handling patterns    | `references/error-handling.md` |

3. **Determine Product Area Category**:
   - Assign the skill to its language and product area directory under `skills/<language>/<category>/` based on Azure service family, primary use case, and sibling skills:
     | Category      | Description                             | Examples                                     |
     | ------------- | --------------------------------------- | -------------------------------------------- |
     | `foundry`     | AI Foundry, agents, projects, inference | `azure-ai-agents-py`, `azure-ai-projects-py` |
     | `data`        | Storage, Cosmos DB, Tables, Data Lake   | `azure-cosmos-py`, `azure-storage-blob-py`   |
     | `messaging`   | Event Hubs, Service Bus, Event Grid     | `azure-eventhub-py`, `azure-servicebus-py`   |
     | `monitoring`  | OpenTelemetry, App Insights, Query      | `azure-monitor-opentelemetry-py`             |
     | `identity`    | Authentication, DefaultAzureCredential  | `azure-identity-py`                          |
     | `security`    | Key Vault, secrets, keys, certificates  | `azure-keyvault-py`                          |
     | `integration` | API Management, App Configuration       | `azure-appconfiguration-py`                  |
     | `compute`     | Batch, ML compute                       | `azure-compute-batch-java`                   |
     | `container`   | Container Registry, ACR                 | `azure-containerregistry-py`                 |

4. **Author Bundled Resources & `SKILL.md`**:
   - Name the skill directory `.github/skills/<skill-name>/SKILL.md` following the pattern `azure-<service>-<subservice>-<language>` (e.g., `azure-ai-agents-py`, `azure-cosmos-java`, `azure-storage-blob-ts`, `azure-storage-blob-go`).
   - Author bundled files (`references/capabilities.md`, `references/non-hero-scenarios.md`, domain references, scripts, assets) first, then compose `SKILL.md` following the Mandatory Skill Section Order.
   - Include optional benchmarking string fields under the frontmatter `metadata` key:
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

5. **Create & Verify Category Symlink**:
   - Create a relative symlink from `skills/<language>/<category>/<short-name>` (stripping the `azure-` prefix and `-<language>` suffix) to `../../../.github/skills/<full-skill-name>` and verify target resolution:
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

     # Verify the symlink:
     ls -la skills/python/foundry/agents
     # Should show: agents -> ../../../.github/skills/azure-ai-agents-py
     ```

6. **Author Acceptance Criteria, Test Scenarios & Execute Harness**:
   - Create `tests/scenarios/<skill-name>/acceptance-criteria.md` inside the `tests/` tree (excluding placement beside `SKILL.md`) grounded in official Microsoft Learn docs, SDK source code, and bundled references:
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
   - Create `tests/scenarios/<skill-name>/scenarios.yaml` testing one specific feature per scenario with `expected_patterns`, `forbidden_patterns`, `mock_response`, and `tags` (covering at least one hero scenario and one non-hero scenario when supported by the SDK):
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
   - Execute the test harness to confirm a 100% scenario pass rate with zero false positives:
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

7. **Synchronize Catalog & Documentation Artifacts**:
   - Update `README.md`:
     + Increment total skill count (line ~73: `> N skills in...`) and Skill Explorer link count (line ~15: `Browse all N skills`).
     + Update the language count table (lines ~77–83), language section header count (e.g., `> N skills • suffix: -py`), and category count (e.g., `<summary><strong>Foundry & AI</strong> (N skills)</summary>`).
     + Insert the new skill row in alphabetical order within its category.
     + Update the test coverage summary (line ~622: `**N skills with N test scenarios**`) and test coverage table (skill count, scenario count, and top skills for the language).
   - Rebuild the Astro-based GitHub Pages documentation artifacts (`docs-site/src/data/skills.json` and `docs/`):
     ```bash
     (cd docs-site && npx tsx scripts/extract-skills.ts && npm run build)
     ```
   - Verify and synchronize the total skill count in `AGENTS.md`.

### Workflow B: Regenerating Existing Skills from Upstream Sources

1. **Resolve Authoritative Upstream Sources**:
   - Ground every snippet refresh in the canonical upstream source for the target language:
     + **Go**: `https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/<service>/<module>/README.md` and `https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/<service>/<module>/`
     + **Rust**: `https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/<service>/<crate>/README.md`, `https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/<service>/<crate>/examples/`, and `crates.io`
     + **.NET, Java, Python, TypeScript, Go**: Current Microsoft Learn package API references alongside official `Azure/azure-sdk-for-<language>` repositories

2. **Execute Surgical Content Refresh & Enforce Parity Gates**:
   - Update code snippets, constructor/method signatures, crate/package names, `## Best Practices`, and `## Reference Links` while preserving valid frontmatter and structural layout.
   - **API Surface Parity Gate**:
     1. Inventory every SDK symbol in snippets (clients, operation groups, model constructors, enum members, `begin_*` LRO methods).
     2. Verify each symbol and signature against the Microsoft Learn API reference (Python, .NET, Java, TypeScript, Go) or `Azure/azure-sdk-for-rust` and `crates.io` (Rust).
     3. Update snippets to match current upstream shapes (such as nested `properties=...` models, renamed methods, or `begin_*` pollers).
     4. Verify that every client and model import path matches the authoritative module hierarchy.
     5. Replace deprecated compatibility shortcuts in primary snippets with current canonical patterns.
   - **Scenario Coverage Gate**:
     1. Identify all hero scenarios from current upstream documentation and samples.
     2. Represent every hero scenario via copy-pastable snippets in `SKILL.md` (or linked bundled reference files when exceeding token ceilings).
     3. Update `tests/scenarios/<skill-name>/` so harness patterns validate all hero workflows.
     4. Include at least one concrete non-hero scenario (update/patch, delete/cleanup, export/import, advanced auth mode, paging/filtering, retries/error handling, or LRO monitoring) when supported by the SDK, presenting sync and async Python forms with equal priority.
     5. Structure `/references/` for Azure SDK skills with `references/capabilities.md` (concise hero/non-hero index excluding historical or migration narration), `references/non-hero-scenarios.md` (concrete non-hero code examples), and specialized deep-dive files (`references/*.md`).
     6. Include an operation-group table for broad/management SDKs that explicitly distinguishes snippet-covered groups from reference-only groups, stating that the skill targets hero workflows plus selected secondary scenarios rather than claiming full API surface coverage unless every major operation group is demonstrated.

3. **Validate Regenerated Skill Behavior**:
   - Run the mock test harness and Vally evaluation (when present):
     ```bash
     (cd tests && pnpm harness <skill-name> --mock --verbose)
     ```
   - For Rust skills, execute the mandatory ripgrep verification gate to confirm that the first two `## Best Practices` rules are present verbatim across all affected Rust skills:
     ```bash
     rg -n "Use `cargo add` to manage dependencies, never edit `Cargo.toml` directly|Add `azure_core` only when importing `azure_core` types directly" .github/plugins/azure-sdk-rust/skills/**/SKILL.md
     ```

4. **Regenerate Documentation Artifacts**:
   ```bash
   (cd docs-site && npx tsx scripts/extract-skills.ts && npm run build)
   ```

5. **Record Audit Trail in Commit / PR Notes**:
   - Document the upstream documentation URLs and examples consulted, the exact symbols and signatures corrected, and the test harness / Vally evaluation execution results.

#### Batch Regeneration Recipe: `azure-sdk-python` Plugin

Execute the following six-step sequence when regenerating all Python skills under `azure-sdk-python`:

1. **Enumerate Canonical Targets**: Treat `.github/plugins/azure-sdk-python/skills/` as the canonical source of truth:
   ```bash
   # Canonical source of truth for Python plugin skills
   ls .github/plugins/azure-sdk-python/skills/*/SKILL.md
   ```
2. **Refresh Against Authoritative Sources**: Query `microsoft-docs` MCP for each skill, inspect the installed package version via `pip show <package>`, and verify every symbol and signature against the installed package or official API reference (applying language-specific best-practice variants and omitting Azure auth callouts for non-Azure skills such as `fastapi-router-py` and `pydantic-models-py`).
3. **Enforce Python Structural & Lifecycle Rules**: Verify the Mandatory Skill Section Order, the verbatim `## Authentication & Lifecycle` callout block, `with` / `async with` context managers on every client example, the mandatory opening rules in `## Best Practices`, and the presence of `references/capabilities.md` plus `references/non-hero-scenarios.md`.
4. **Execute Batch Validation & Mock Harness**:
   ```bash
   # Fast frontmatter/structure validation for every Python skill
   python .github/skills/skill-creator/scripts/quick_validate.py .github/plugins/azure-sdk-python/skills/<skill-name>

   # Run Python skill harness in mock mode (all *-py scenarios)
   (cd tests && pwsh ./run-harness-by-language.ps1 -Language py -Mock)
   ```
5. **Synchronize Plugin Symlinks & Documentation Data**:
   ```bash
   # Ensure .github/skills links point at plugin canonical skills
   python .github/scripts/sync_skill_links.py --plugin azure-sdk-python --check
   python .github/scripts/sync_skill_links.py --plugin azure-sdk-python --apply

   # Refresh docs site data after content changes
   (cd docs-site && npx tsx scripts/extract-skills.ts && npm run build)
   ```
6. **Verify Batch Completion Criteria**: Confirm that every `.github/plugins/azure-sdk-python/skills/*/SKILL.md` file is updated or verified current, the `-py` mock harness passes with zero regressions, plugin symlinks are synchronized, and PR notes record all upstream sources, signature fixes, and validation results.

## Pre-Publication Validation & Audit Checklists

Execute the following verification gates before finalizing any created or regenerated skill:

### Efficiency & Vally Evaluation Gates

- [ ] **Token Budget Audit**: Measure section and total token counts via a token counter or model playground, extract sections exceeding maximum thresholds into `/references/`, and annotate `# SDK Name` with `<!-- Token Count: ~XXXX (target: 1100, max: 1500) -->`.
- [ ] **Anti-Pattern Audit**: Confirm 3–5 core methods in feature tables (no 50-method dumps), single primary solutions in `SKILL.md`, separation of advanced topics into `/references/`, code-first presentation linked to `microsoft-docs` MCP, and minimal prose.
- [ ] **Example Count Audit**: Confirm 1 complete runnable example per hero scenario in `SKILL.md` (counting paired Python `### Sync` + `### Async` snippets as one workflow), 3–5 core methods in feature tables, and at most 1 example per best-practice bullet.
- [ ] **Frontmatter Schema Audit**: Confirm `name` matches `.github/skills/<name>/SKILL.md`, `description` includes trigger keywords and stays within ~200 characters (1,024 max), and optional `benchmark_tokens_*` / `benchmark_quality_*` entries under `metadata` are flat strings.
- [ ] **Authentication Guidance Audit**: Verify credential guidance against current Microsoft Learn or upstream SDK docs; confirm `DefaultAzureCredential` for local dev and `AZURE_TOKEN_CREDENTIALS=prod` (or explicit production credentials) for production in Python/.NET/Java/TS/Go; confirm `DeveloperToolsCredential` (local dev) and `ManagedIdentityCredential` (production) in Rust; confirm links to `/references/auth-strategies.md` or official docs.
- [ ] **Vally Lint & Eval Execution** (for skills with a spec under `tests/scenarios/<skill-name>/vally/eval.yaml`; skip when no `vally/` spec exists):
  ```bash
  # If the eval spec uses the shared Rust custom grader plugin, build it first.
  (cd tests/scenarios/_shared/vally/grader-plugins/rust-cargo-build-failure && npm install && npm run build)

  vally lint --eval-spec tests/scenarios/<skill-name>/vally/eval.yaml \
    --grader-plugin tests/scenarios/_shared/vally/grader-plugins/rust-cargo-build-failure \
    --strict

  vally eval --eval-spec tests/scenarios/<skill-name>/vally/eval.yaml \
    --grader-plugin tests/scenarios/_shared/vally/grader-plugins/rust-cargo-build-failure
  ```
  + Confirm `vally lint` passes with zero errors and `vally eval` passes with zero error-severity findings when `COPILOT_TOKEN` is available (lint-only execution is acceptable when `COPILOT_TOKEN` is absent, matching `../../workflows/vally-evaluation.yml`).

### Final Delivery Audit Checklist

- [ ] **Prerequisites**: User supplied SDK package name or documentation URL; API patterns verified via `microsoft-docs` MCP; all snippet symbols and imports verified against current language-specific API references.
- [ ] **Skill Content**: Frontmatter `description` states both what and when; `SKILL.md` is under 500 lines; authentication and context managers follow language rules; core workflow includes cleanup/delete; `references/capabilities.md` and `references/non-hero-scenarios.md` are populated; operation-group coverage is explicit for broad SDKs; mandatory opening rules appear in `## Best Practices` for Python and Rust skills.
- [ ] **Categorization**: Skill resides at `.github/skills/<skill-name>/SKILL.md` and symlink at `skills/<language>/<category>/<short-name>` resolves to `../../../.github/skills/<skill-name>`.
- [ ] **Testing**: `tests/scenarios/<skill-name>/acceptance-criteria.md` and `tests/scenarios/<skill-name>/scenarios.yaml` cover at least one hero scenario and, when the SDK supports a distinct non-hero scenario, at least one non-hero scenario (otherwise explicitly note that none applies); all scenarios pass `pnpm harness <skill> --mock` at 100%.
- [ ] **Documentation**: `README.md` catalog counts/tables, `docs-site/src/data/skills.json`, `docs/`, and `AGENTS.md` are synchronized.
