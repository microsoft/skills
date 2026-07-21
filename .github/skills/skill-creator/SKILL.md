---
name: skill-creator
description: Guide for creating effective skills for AI coding agents working with Azure SDKs and Microsoft Foundry services. Use when creating new skills or updating existing skills.
---

# Skill Creator

Guide for creating skills that extend AI agent capabilities, with emphasis on Azure SDKs and Microsoft Foundry.

> **Required Context:** When creating SDK or API skills, users MUST provide the SDK package name, documentation URL, or repository reference for the skill to be based on.

## About Skills

Skills are modular knowledge packages that transform general-purpose agents into specialized experts:

1. **Procedural knowledge** — Multi-step workflows for specific domains
2. **SDK expertise** — API patterns, authentication, error handling for Azure services
3. **Domain context** — Schemas, business logic, company-specific patterns
4. **Bundled resources** — Scripts, references, templates for complex tasks

---

## Core Principles

### 1. Concise is Key

The context window is a shared resource. Challenge each piece: "Does this justify its token cost?"

**For domain/procedural skills**: Agents are already capable. Only add what they don't already know.

**For SDK/API skills**: Users MUST provide SDK package name, documentation URL, or repository reference. The skill cannot be created without this context.

### 2. Fresh Documentation First

**Azure SDKs change constantly.** Skills should instruct agents to verify documentation:

```markdown
## Before Implementation

Search `microsoft-docs` MCP for current API patterns:

- Query: "[SDK name] [operation] python"
- Verify: Parameters match your installed SDK version
```

### 3. Degrees of Freedom

Match specificity to implementation constraints. High freedom when approaches vary; low freedom when precise execution is required:

| Freedom    | When                             | Example          |
| ---------- | -------------------------------- | ---------------- |
| **High**   | Multiple valid approaches        | Text guidelines  |
| **Medium** | Preferred pattern with variation | Pseudocode       |
| **Low**    | Must be exact                    | Specific scripts |

### 4. Progressive Disclosure

Skills load in three levels:

1. **Metadata** (~100 words) — Always in context
2. **SKILL.md body** (<5k words) — When skill triggers
3. **References** (unlimited) — As needed

**Keep SKILL.md under 500 lines.** Split into reference files when approaching this limit.

---

## Skill Structure

**Quick reference:**

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

For Azure SDK skills, follow the **Skill Section Order** below. For domain skills, use your judgment to organize logically.

### SKILL.md Essentials

- **Frontmatter**: `name` and `description` (description triggers the skill)
- **Body**: Keep under 500 lines; split large skills into reference files

### Bundled Resources (Optional)

| Type          | When to Include                          | Examples                                                   |
| ------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `scripts/`    | Reused code patterns                     | Auth setup, CLI scripts                                    |
| `references/` | Feature deep-dives and overflow examples | `capabilities.md` index, `non-hero-scenarios.md`, API docs |
| `assets/`     | Output templates                         | Boilerplate code, images                                   |

---

## Creating Azure SDK Skills

When creating skills for Azure SDKs, follow these patterns consistently.

### Token Budget Guidelines (REQUIRED)

Every Azure SDK skill MUST stay within these token limits:

| Section                       | Target           | Absolute Max     |
| ----------------------------- | ---------------- | ---------------- |
| Installation + Env Vars       | 100 tokens       | 150              |
| Authentication & Lifecycle    | 200 tokens       | 300              |
| Core Workflow (1 example)     | 300 tokens       | 400              |
| Feature Tables                | 200 tokens       | 300              |
| Best Practices (6-8 items)    | 200 tokens       | 250              |
| References (reference/ links) | 100 tokens       | 150              |
| **Total SKILL.md**            | **~1100 tokens** | **~1500 tokens** |

**Enforcement**:

- Exceeding max limit → refactor into `/references/` subdirectories
- When approaching 500 lines → move entire sections to reference files
- Annotate with `<!-- Token Count: ~XXXX (target: 1100, max: 1500) -->` immediately below the skill's H1

---

### Reference Extraction Guide (REQUIRED)

Decide what goes in SKILL.md vs. `/references/` using these signals:

| Signal         | Move to `/references/`              | Keep in SKILL.md       |
| -------------- | ----------------------------------- | ---------------------- |
| Use frequency  | <20% of typical use                 | ~80%+ of workflows     |
| Cognitive load | Advanced patterns, multiple options | Single happy path      |
| Example length | >10 lines, multiple paths           | 1-5 lines, single path |

**Content extraction rules:**

- **Batch operations** → `/references/batch-operations.md`
- **Error handling** (beyond try-except) → `/references/error-handling.md`
- **Performance tuning** → `/references/performance.md`
- **Alternative workflows** → `/references/workflows-comparison.md`
- **Streaming/events** → `/references/streaming.md`
- **Advanced auth** → `/references/auth-strategies.md`
- **Tool integration** → `/references/tools.md`
- **Breaking changes** → `/references/migration.md`

**Decision:** Keep common case in SKILL.md, move edge cases to `/references/`.

---

### Core Workflow Discipline (REQUIRED)

Every Azure SDK skill must clarify which workflow(s) it documents.

**Case 1: Single clear "core workflow"** (majority of services)

If one pattern handles ~80% of use cases:

1. Designate it as the core workflow
2. Show ONLY this workflow in SKILL.md (one complete, runnable example)
3. Defer alternatives to `/references/`:
   - Batch operations → `/references/batch-operations.md`
   - Error handling → `/references/error-handling.md`
   - Performance tuning → `/references/performance.md`
   - Alternative workflows → `/references/workflows-comparison.md`

**Example**: Azure Key Vault Secrets (core workflow: retrieve a secret using managed identity). Alternative authentication workflows in `/references/`: local development with `DefaultAzureCredential`, workload identity, and service-principal credentials (client secret or certificate).

**Case 2: Multiple equally-valid "core workflows"** (e.g., authentication strategies, deployment targets)

If no single pattern dominates:

1. Include every hero scenario in SKILL.md, even when that means multiple equally valid workflows
2. Show one complete, runnable example for each hero scenario in SKILL.md
3. Use `/references/workflows-comparison.md` for trade-offs, secondary variations, and deeper context that would otherwise bloat the main file
4. Do NOT treat valid alternatives as "advanced" when they are core to real usage — they're equally valid, just different contexts

**Example**: Azure Identity SDK has several hero scenarios. Keep the primary local-development and production-safe credential flows in SKILL.md, then use `/references/credential-types.md` for deeper comparisons across `AzureCliCredential`, workload identity, service principal variants, and other secondary credential choices.

**Decision rule**: If you're unsure, ask: "Would a user choosing the other approach call what I wrote wrong?" If yes, it's another hero scenario and belongs in SKILL.md. If no, it can be summarized and linked from `/references/`.

---

### Skill Section Order

Follow this structure (based on existing Azure SDK skills):

1. **Title** — `# SDK Name`
2. **Installation** — `pip install`, `npm install`, etc.
3. **Environment Variables** — Required configuration, with an inline comment explaining when it's required. If using `DefaultAzureCredential` in production, include `AZURE_TOKEN_CREDENTIALS` (set to `prod` or `<specific_credential>`)
4. **Authentication & Lifecycle** — For Python skills, prefer `DefaultAzureCredential`: use it as-is for local development, and constrain it for production by setting `AZURE_TOKEN_CREDENTIALS` to `prod` (or a specific target credential name). A specific Microsoft Entra Token credential such as `ManagedIdentityCredential` or `WorkloadIdentityCredential` may be used directly instead. **For Python skills, this section MUST start with the standard callout block** (see [Required Authentication & Lifecycle Callout (Python)](#required-authentication--lifecycle-callout-python) below).
5. **Core Workflow** — Minimal viable example (per core workflow discipline above)
6. **Feature Tables** — Clients, methods, tools
7. **Best Practices** — Numbered list
8. **Reference Links** — Table linking to `/references/*.md` (for Azure SDK skills, include `capabilities.md` + `non-hero-scenarios.md`)

### Required Authentication & Lifecycle Callout (Python)

> **Scope:** Python skills (`-py` suffix) only. Other languages may follow their own idioms.

Every Python Azure SDK skill MUST open its `## Authentication & Lifecycle` section with the following callout block, **verbatim**, before any code samples. This makes the two non-negotiable rules visible to users before they read or copy any client setup code.

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

**Placement rules:**

- Insert immediately under the `## Authentication & Lifecycle` heading, before the first code sample.
- Do not paraphrase or restructure the wording — the consistency across skills is the point.
- If the SDK does not support Entra ID at all (rare — e.g. some legacy speech REST endpoints, websocket APIs that require subscription keys), keep rule #2 (context managers) and replace rule #1 with a single sentence noting the SDK requires API-key auth and explaining why Entra is not yet available.
- If the SDK is async-only (e.g. `azure-ai-voicelive`), keep both rules but show only the async form in the bullets.
- Skip the callout entirely for non-Azure Python skills with no client lifecycle (e.g. `pydantic-models-py`).

**Code sample enforcement.** Every client construction in the skill body must demonstrate both rules:

- Show `with` / `async with` on every client instantiation in usage examples (not just the auth section).
- Show `DefaultAzureCredential` in the primary auth example. **Do not delete API-key examples for SDKs where keys are still officially supported** — many existing users (especially in regulated environments still completing their Entra rollout) need a copy-pastable working sample. Demote the keyed snippet into a clearly-labeled `### Legacy: API Key (existing keyed deployments)` subsection placed _after_ the primary `DefaultAzureCredential` block in the same `## Authentication & Lifecycle` section. Include a one-line note that new code should use `DefaultAzureCredential` and that the keyed path is for existing deployments. Also add the `<SERVICE>_KEY` env var back to the Environment Variables block with a `# Only required for the legacy API-key auth path below` comment.
- A handful of services have key-specific quirks worth calling out in the Legacy subsection (e.g. `azure-ai-translation-text` requires a `region=` parameter when using a key against the global endpoint, because token-credential auth requires a custom subdomain endpoint). Surface these in the demoted block rather than dropping the example.
- For async examples, wrap `DefaultAzureCredential` from `azure.identity.aio` in `async with credential:` alongside the client.

### Authentication Pattern (All Languages)

For local development, use `DefaultAzureCredential` which supports multiple auth methods. For production, use a specific credential type or configure `DefaultAzureCredential` with environment variable `AZURE_TOKEN_CREDENTIALS` set to `prod` or specify the target credential.

If configuring a Rust skill, use `DeveloperToolsCredential` for local development and `ManagedIdentityCredential` for production. The Rust SDK does not support `DefaultAzureCredential`, so explicitly use the appropriate credential in each environment.

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

**Never hardcode credentials. Use environment variables.**

### Anti-Patterns: What NOT to Do (REQUIRED Reading)

**These patterns cause bloat and inefficiency. Every skill author must review this section before writing.**

#### Anti-Pattern 1: "Exhaustive API Reference"

- ❌ **Don't**: List all 50 SDK methods in a feature table with code samples for every variant
- ✅ **Do**: Show 3-5 core methods in a table; link to official Azure API reference for exhaustive list
- **Token cost**: Listing all methods + examples = 400-600 tokens wasted
- **User impact**: Overwhelming cognitive load; users don't know what to use

#### Anti-Pattern 2: "Multiple Ways to Solve One Problem"

- ❌ **Don't**: "Here's approach A, B, C, and D to paginate results" in the main body
- ✅ **Do**: "Use `ItemPaged` for sync pagination" (primary example); link alternatives to `/references/`
- **Token cost**: Each alternate approach = 50-100 tokens; 5 approaches = skill becomes inefficient
- **User impact**: Decision paralysis; users re-read everything

#### Anti-Pattern 3: "Beginner + Intermediate + Advanced in One Skill"

- ❌ **Don't**: Skill that goes from "what is a client?" to "custom retry policies" to "circuit breaker patterns"
- ✅ **Do**: Core workflow covers 80% use case; advanced patterns in `/references/`
- **Token cost**: Every skill level adds 200-300 tokens; three levels = 600-900 extra tokens
- **User impact**: Experts bored, beginners overwhelmed; nobody gets what they need

#### Anti-Pattern 4: "Restating Official Documentation"

- ❌ **Don't**: "The CosmosClient constructor takes an endpoint (string) and credential (TokenCredential). The endpoint identifies the Azure Cosmos resource..."
- ✅ **Do**: Show code: `client = CosmosClient(endpoint, credential)`. Link to official docs: `microsoft-docs` MCP.
- **Token cost**: Verbose explanation = 50-100 tokens per parameter; large APIs waste 300+ tokens
- **User impact**: Redundant; official docs are authoritative, skill should show usage not repeat them

#### Anti-Pattern 5: "Verbose Explanation When Example Suffices"

- ❌ **Don't**: "To create a client, you first instantiate the class using the constructor, passing the endpoint and credential parameters. The endpoint is a string that identifies your resource..."
- ✅ **Do**: Show code immediately: `with CosmosClient(endpoint, credential) as client:`

---

### Efficiency Validation (REQUIRED - Phase 2)

**During authoring, validate skill efficiency manually, then run the Vally eval if the skill has one under `tests/scenarios/<skill-name>/vally/`.**

**1. Measure token count:**

Use a token counter or model playground to measure each section. Compare to the Token Budget Guidelines targets above. If any section exceeds max, move content to `/references/`.

**2. Run anti-pattern checklist:**

- [ ] No exhaustive API reference (show 3-5 core methods, not 50)
- [ ] No multiple solutions to one problem in SKILL.md
- [ ] No beginner+intermediate+advanced mixed
- [ ] No restating official docs (code first, link to microsoft-docs)
- [ ] No verbose prose (examples first, minimal text)

**3. Example count audit:**

- [ ] 1 complete example per hero scenario / core workflow documented in SKILL.md. For Python SDKs that support both sync and async, the paired sync + async examples for the same workflow count as one workflow, not two.
- [ ] Feature table includes 3-5 core methods (not comprehensive API)
- [ ] Max 1 example per best practice bullet

**4. Frontmatter validation:**

- [ ] `name` matches `.github/skills/<name>/SKILL.md`
- [ ] `description` includes trigger keywords
- [ ] `description` is concise (~200 chars is a good target; schema max is 1,024 chars)
- [ ] If included, optional `benchmark_tokens_*` and `benchmark_quality_*` metadata fields are flat strings under `metadata`

**4b. Authentication guidance validation** (critical for all credentials):

- [ ] If skill uses Azure Identity credentials, verify guidance against the current official credential docs for that language/package (Microsoft Learn where available; otherwise the upstream SDK repo or package docs)
- [ ] For Python skills, development guidance may recommend `DefaultAzureCredential` (supports multiple dev credential types)
- [ ] For Python skills, production guidance: `DefaultAzureCredential` alone (unconstrained) is not sufficient; require either `AZURE_TOKEN_CREDENTIALS=prod` (or a specific target credential) to constrain the chain, or a specific credential (e.g., `ManagedIdentityCredential`) used directly
- [ ] For Rust skills, development/production guidance reflects the actual supported credentials (`DeveloperToolsCredential` for local dev; a specific production credential such as `ManagedIdentityCredential` for production)
- [ ] Link to `/references/auth-strategies.md` or official docs for production credential selection

**4c. Run Vally lint/eval (if the skill has a spec under `tests/scenarios/<skill-name>/vally/`):**

```bash
# If the eval spec uses the shared Rust custom grader plugin, build it first.
(cd tests/scenarios/_shared/vally/grader-plugins/rust-cargo-build-failure && npm install && npm run build)

vally lint --eval-spec tests/scenarios/<skill-name>/vally/eval.yaml \
  --grader-plugin tests/scenarios/_shared/vally/grader-plugins/rust-cargo-build-failure \
  --strict

vally eval --eval-spec tests/scenarios/<skill-name>/vally/eval.yaml \
  --grader-plugin tests/scenarios/_shared/vally/grader-plugins/rust-cargo-build-failure
```

- [ ] `vally lint` passes with no errors
- [ ] `vally eval` passes (no error-severity findings) when `COPILOT_TOKEN` is available; otherwise lint-only is acceptable, matching the [`Vally Evaluation`](../../workflows/vally-evaluation.yml) workflow behavior
- [ ] Skills without a `vally/` spec skip this step — it is optional per skill, not required for every skill

**5. Spot check:**

- [ ] Can a user copy the core workflow and run it immediately?
- [ ] Do all examples follow best practices (context managers, appropriate credentials)?
- [ ] Are all environment variables documented?

**Output:** After validation, annotate the skill header with measured token count:

```markdown
# Azure Service SDK

<!-- Token Count: ~1180 (target: 1100, max: 1500) -->
```

---

### Standard Verb Patterns

Azure SDKs use consistent verbs across all languages:

| Verb     | Behavior                     |
| -------- | ---------------------------- |
| `create` | Create new; fail if exists   |
| `upsert` | Create or update             |
| `get`    | Retrieve; error if missing   |
| `list`   | Return collection            |
| `delete` | Succeed even if missing      |
| `begin`  | Start long-running operation |

### Language-Specific Patterns

See `references/azure-sdk-patterns.md` for detailed patterns including:

- **Python**: `ItemPaged`, `LROPoller`, context managers, Sphinx docstrings. When the SDK provides both sync and async clients, present both forms as first-class options; do not express a preference for either. When the SDK is sync-only or async-only, document the available mode only. Do not mix sync and async within a single code example. Always show `with` / `async with` context managers.
- **.NET**: `Response<T>`, `Pageable<T>`, `Operation<T>`, mocking support
- **Java**: Builder pattern, `PagedIterable`/`PagedFlux`, Reactor types
- **TypeScript**: `PagedAsyncIterableIterator`, `AbortSignal`, browser considerations
- **Go**: `context.Context` as first arg, `runtime.Pager[T]` via `New*Pager()` + `More()/NextPage(ctx)`, `runtime.Poller[T]` via `Begin*` + `PollUntilDone(ctx, nil)`, `to.Ptr(...)` helpers, and typed `*azcore.ResponseError`
- **Rust**: Installation via `cargo add`, dependency rule for `azure_core`, `Response<T>`, `Pager<T>`, `RequestContent::from()`, `.into_model()`, explicit credential types, RBAC roles for Entra ID authentication

### Required Best Practices in Every Skill (User-Facing)

#### Python, .NET, Java, TypeScript, and Go languages

**These two rules are not just authoring conventions for the skill itself — they MUST be explicitly written into every generated skill's `## Best Practices` section so end users who follow the skill apply them in their own code.**

Add both items verbatim (adapted only for language/SDK specifics) as the **first two items** of the Best Practices list. Do not assume users will infer them from examples.

**Standard wording (Python; adapt for other languages):**

```markdown
1. **Do not mix sync and async clients in the same call path.** Use either `azure.xxx` sync clients or `azure.xxx.aio` async clients within a single call path — do not combine both.
2. **Always use context managers for clients and async credentials.** Wrap every client in `with Client(...) as client:` (sync) or `async with Client(...) as client:` (async). For async `DefaultAzureCredential` from `azure.identity.aio`, also use `async with credential:` so tokens and transports are cleaned up.
3. **Use `DefaultAzureCredential`** for code that runs locally. For code that runs in Azure, either constrain `DefaultAzureCredential` with `AZURE_TOKEN_CREDENTIALS=prod` (or a specific target credential) or use a specific token credential directly (e.g. `ManagedIdentityCredential`, `WorkloadIdentityCredential`).
```

**Variants to apply when the SDK shape differs:**

| Skill type                                                                    | Adjust item #1 to                                                                                                                   | Adjust item #2 to                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Async-only SDK (e.g. voicelive)                                               | "This SDK is async-only; use the `.aio` namespace throughout."                                                                      | keep standard                                                                                                                                                                                                                  |
| Framework guidance that is async-oriented (for example some agent frameworks) | "Use the framework's documented async patterns where required, but do not claim async is globally preferred for Azure Python SDKs." | keep standard                                                                                                                                                                                                                  |
| Provider-pattern (OpenTelemetry exporters/distro)                             | keep standard                                                                                                                       | "Call `provider.shutdown()` / `flush()` at process exit to flush telemetry — providers are not context managers."                                                                                                              |
| REST-over-httpx skills                                                        | keep standard                                                                                                                       | "Use `with httpx.Client(...) as client:` (sync) or `async with httpx.AsyncClient(...) as client:` (async) so connections pool and close deterministically."                                                                    |
| Identity skill                                                                | keep standard                                                                                                                       | "Use credentials as context managers (`with DefaultAzureCredential() as credential:`) when they own token caches / HTTP transports you want cleaned up; for async, use `async with` on credentials from `azure.identity.aio`." |
| FastAPI (non-Azure)                                                           | "Pick `def` or `async def` per endpoint based on whether you call async I/O; do not mix sync and blocking calls in one handler."    | "Manage long-lived resources (DB pools, HTTP clients) in `lifespan` and inject via `Depends`; use `with`/`async with` for per-request resources."                                                                              |
| Pure model/schema skill (no I/O, e.g. pydantic)                               | **skip both** — not applicable                                                                                                      | **skip**                                                                                                                                                                                                                       |

**Enforcement in code examples.** Every code example inside the skill must itself obey both rules, so the skill demonstrates what it prescribes:

- Do not interleave sync and async calls within a single example. When the SDK provides both sync and async clients, show each mode in its own complete, self-contained example — a `### Sync` subsection and an `### Async` subsection — giving both equal prominence. When the SDK is sync-only or async-only, show only the available mode.
- Every client instantiation in every example must be wrapped in `with` / `async with`. The only permitted exception is the mandatory Authentication snippet (which illustrates the credential + client construction pattern) and framework lifespan patterns where a client is owned by the app (e.g. FastAPI `lifespan`).
- When async credentials from `azure.identity.aio` appear in an example, wrap them in `async with credential:` alongside the client.

#### Rust Language

**These rules MUST be explicitly written into every Rust skill's `## Best Practices` section as the first items:**

1. **Use `cargo add` to manage dependencies, never edit `Cargo.toml` directly.** Always use `cargo add <crate>` or `cargo remove <crate>` instead of manually modifying the manifest file. Official crates are published on crates.io and should be added via cargo.

2. **Add `azure_core` to `Cargo.toml` only when you import `azure_core` types directly.** If your code imports types like `azure_core::http::Url`, `azure_core::http::RequestContent`, or `azure_core::error::ErrorKind`, explicitly add `azure_core` to your dependencies. If you only use types re-exported by service crates (e.g., via `use azure_storage_blob::BlobClient`), a direct `azure_core` dependency is optional.

3. **Use `DeveloperToolsCredential` for local development and `ManagedIdentityCredential` for production.** The Rust SDK does not support `DefaultAzureCredential`, so explicitly use the appropriate credential in each environment.

4. **Use `RequestContent::from()` to wrap upload data.** When uploading data (e.g., blobs), wrap the content in `RequestContent::from(your_data)` to ensure proper handling by the SDK.

5. **Assign appropriate RBAC roles for Entra ID auth.** For production authentication using Entra ID, ensure the identity has the necessary RBAC role assigned (e.g., "Storage Blob Data Contributor" for blob write access).

6. **Always verify package versions using crates.io.** Before using a package, check its version on [crates.io](https://crates.io/) to ensure you are using a stable and supported release.

### Example Effective Skills (Benchmark Only Structure-Compliant Skills)

**Only benchmark Azure SDK skills that already use the required `references/` layout** (`references/capabilities.md` plus `references/non-hero-scenarios.md`). Older skills that predate that structure can still be useful for style ideas, but do not mirror them directly until they are brought into compliance.

**A valid benchmark skill should**:

1. Stay at or under the 1,500-token absolute max (see Token Budget Guidelines above)
2. Cover the hero workflow (CRUD or primary operations), not every feature variant
3. Show 1-2 examples per concept, not 3-5
4. Use tables for API summary (credential types, RBAC roles, client hierarchy)
5. Link to official docs via `microsoft-docs` MCP instead of duplicating
6. Move advanced patterns to `/references/`
7. Include `references/capabilities.md` and `references/non-hero-scenarios.md`

**Before writing your skill**: Apply the checklist above directly, then mirror only the structure patterns that fit your use case.

---

### Handling Deprecated or Rebranded SDKs

When an Azure SDK has been deprecated or rebranded, update skills to guide users toward the current package while maintaining backward compatibility:

**1. Add a migration notice at the top of the skill:**

```markdown
> **⚠️ MIGRATION NOTICE**: The [Old Service Name] has been rebranded to **[New Service Name]**. While the package `old-package-name` remains available for compatibility, **new projects should use `new-package-name`** which provides the latest features and updates.
>
> **For new projects**: Use the `new-package-name` package instead.
>
> **This skill remains valid** for existing projects using `old-package-name`, but be aware you're using the legacy package name. The API patterns shown here are compatible with both packages.
```

**2. Show both installation options:**

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

**3. When to create a new skill vs. update existing:**

- **Update existing skill** if the API is largely compatible (same or similar class/method names)
- **Create new skill + migration guide** if the API changed significantly (use `references/migration.md`)
- **Always cross-reference** between old and new skills

**Examples:**

- `azure-ai-formrecognizer-java` → `azure-ai-documentintelligence` (rebranded service)
- `azure-communication-callingserver-java` → `azure-communication-callautomation` (deprecated, with migration guide)

### Example: Azure SDK Skill Structure

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

## Skill Creation Process

1. **Gather SDK Context** — User provides SDK/API reference (REQUIRED)
2. **Understand** — Research SDK patterns from official docs
3. **Plan** — Identify reusable resources and product area category
4. **Create** — Write SKILL.md in `.github/skills/<skill-name>/`
5. **Categorize** — Create symlink in `skills/<language>/<category>/`
6. **Test** — Create acceptance criteria and test scenarios
7. **Document** — Update README.md skill catalog
8. **Iterate** — Refine based on real usage

### Step 1: Gather SDK Context (REQUIRED)

**Before creating any SDK skill, the user MUST provide:**

| Required                  | Example                                                   | Purpose                  |
| ------------------------- | --------------------------------------------------------- | ------------------------ |
| **SDK Package**           | `azure-ai-agents`, `Azure.AI.OpenAI`, `azblob`            | Identifies the exact SDK |
| **Documentation URL**     | `https://learn.microsoft.com/en-us/azure/ai-services/...` | Primary source of truth  |
| **Repository** (optional) | `Azure/azure-sdk-for-python`, `Azure/azure-sdk-for-go`    | For code patterns        |

**Prompt the user if not provided:**

```
To create this skill, I need:
1. The SDK package name (e.g., azure-ai-projects)
2. The Microsoft Learn documentation URL or GitHub repo
3. The target language (py/dotnet/ts/java/go)
```

**Search official docs first:**

```bash
# Use microsoft-docs MCP to get current API patterns
# Query: "[SDK name] [operation] [language]"
# Verify: Parameters match the latest SDK version
```

### Step 2: Understand the Skill

Gather concrete examples:

- "What SDK operations should this skill cover?"
- "What triggers should activate this skill?"
- "What errors do developers commonly encounter?"

| Example Task               | Reusable Resource              |
| -------------------------- | ------------------------------ |
| Same auth code each time   | Code example in SKILL.md       |
| Complex streaming patterns | `references/streaming.md`      |
| Tool configurations        | `references/tools.md`          |
| Error handling patterns    | `references/error-handling.md` |

### Step 3: Plan Product Area Category

Skills are organized by **language** and **product area** in the `skills/` directory via symlinks.

**Product Area Categories:**

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

**Determine the category** based on:

1. Azure service family (Storage → `data`, Event Hubs → `messaging`)
2. Primary use case (AI agents → `foundry`)
3. Existing skills in the same service area

### Step 4: Create the Skill

**Location:** `.github/skills/<skill-name>/SKILL.md`

**Naming convention:**

- `azure-<service>-<subservice>-<language>`
- Examples: `azure-ai-agents-py`, `azure-cosmos-java`, `azure-storage-blob-ts`, `azure-storage-blob-go`
- For Go skills in documentation prose, use the short package name (for example `azblob`).
- Use the full module import path only in code/import examples (for example `github.com/Azure/azure-sdk-for-go/sdk/storage/azblob`).

**For Azure SDK skills:**

1. Search `microsoft-docs` MCP for current API patterns
2. Verify against installed SDK version
3. Follow the section order above
4. Include cleanup code in examples
5. Add feature comparison tables

**Write bundled resources first**, then SKILL.md.

**Quality assurance before finalizing:**

1. Measure section token counts as you write (use model playground token counter)
2. Compare to Token Budget Guidelines targets
3. Validate against anti-patterns checklist (see Anti-Patterns section)
4. Extract to `/references/` if section exceeds max tokens
5. Run Efficiency Validation checklist, including `vally lint`/`vally eval` if the skill has a spec (see Efficiency Validation)
6. Optionally add `benchmark_tokens_*` and `benchmark_quality_*` fields under the frontmatter's `metadata` mapping (flat string values)
7. Add token count comment to skill header for future maintenance

**Frontmatter (Enhanced with Benchmarking Metadata):**

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

**Metadata fields:** (all values are strings, per the Agent Skills `metadata` spec — string keys mapped to string values)

- `benchmark_tokens_estimated` — Actual measured token count
- `benchmark_tokens_target` — Target efficiency (typically 1100)
- `benchmark_tokens_max` — Absolute ceiling (1500; split if exceeded)
- `benchmark_quality_*` — Individual anti-pattern checks, each a `"true"`/`"false"` string (e.g., `benchmark_quality_single_core_workflow`)

### Step 5: Categorize with Symlinks

After creating the skill in `.github/skills/`, create a symlink in the appropriate category:

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

**Symlink naming:**

- Use short, descriptive names (e.g., `agents`, `cosmos`, `blob`)
- Remove the `azure-` prefix and language suffix
- Match existing patterns in the category

**Verify the symlink:**

```bash
ls -la skills/python/foundry/agents
# Should show: agents -> ../../../.github/skills/azure-ai-agents-py
```

### Step 6: Create Tests

**Every skill MUST have acceptance criteria and test scenarios.**

#### 6.1 Create Acceptance Criteria

**Location:** `tests/scenarios/<skill-name>/acceptance-criteria.md`

> Keep acceptance criteria in the `tests/` tree (never beside `SKILL.md` inside the skill folder).

**Source materials** (in priority order):

1. Official Microsoft Learn docs (via `microsoft-docs` MCP)
2. SDK source code from the repository
3. Existing reference files in the skill

**Format:**

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

**Critical patterns to document:**

- Import paths (these vary significantly between Azure SDKs)
- Authentication patterns
- Client initialization
- Async variants (`.aio` modules)
- Common anti-patterns

#### 6.2 Create Test Scenarios

**Location:** `tests/scenarios/<skill-name>/scenarios.yaml`

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

**Scenario design principles:**

- Each scenario tests ONE specific pattern or feature
- `expected_patterns` — patterns that MUST appear
- `forbidden_patterns` — common mistakes that must NOT appear
- `mock_response` — complete, working code that passes all checks
- `tags` — for filtering (`basic`, `async`, `streaming`, `tools`)

#### 6.3 Run Tests

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

**Success criteria:**

- All scenarios pass (100% pass rate)
- No false positives (mock responses always pass)
- Patterns catch real mistakes

### Step 7: Update Documentation

After creating the skill:

1. **Update README.md** — Add the skill to the appropriate language section in the Skill Catalog
   - Update total skill count (line ~73: `> N skills in...`)
   - Update Skill Explorer link count (line ~15: `Browse all N skills`)
   - Update language count table (lines ~77-83)
   - Update language section count (e.g., `> N skills • suffix: -py`)
   - Update category count (e.g., `<summary><strong>Foundry & AI</strong> (N skills)</summary>`)
   - Add skill row in alphabetical order within its category
   - Update test coverage summary (line ~622: `**N skills with N test scenarios**`)
   - Update test coverage table — update skill count, scenario count, and top skills for the language

2. **Regenerate GitHub Pages data** — Run the extraction script and rebuild the docs site from one scoped directory change

   ```bash
   (cd docs-site && npx tsx scripts/extract-skills.ts && npm run build)
   ```

   This updates `docs-site/src/data/skills.json` which feeds the Astro-based docs site, then rebuilds the site into `docs/`, which is served by GitHub Pages.

3. **Verify AGENTS.md** — Ensure the skill count is accurate

---

### Step 8: Regenerate Existing Skills from Latest SDK Sources

Use this workflow when an existing skill has stale examples, outdated API signatures,
or changed package guidance.

1. **Identify canonical source files first**

For Azure SDK language skills, use official upstream source docs and examples as the source of truth:

- Go: `https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/<service>/<module>/README.md`
- Go examples: `https://github.com/Azure/azure-sdk-for-go/tree/main/sdk/<service>/<module>/`
- Rust: `https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/<service>/<crate>/README.md`
- Rust examples: `https://github.com/Azure/azure-sdk-for-rust/tree/main/sdk/<service>/<crate>/examples/`
- .NET/Java/Python/TS/Go: use current Microsoft Learn package docs + official SDK repos

2. **Refresh skill content surgically**

- Update code snippets to match current constructor/method signatures
- Keep crate/package names aligned with official publisher guidance
- Preserve skill structure/frontmatter unless intentionally changing behavior
- Update "Best Practices" and "Reference Links" when upstream recommendations change
- For Rust, if code uses `azure_core` types/imports directly, ensure `azure_core` is present in `Cargo.toml`; if only service-crate re-exports are used, direct `azure_core` dependency is optional

### API Surface Parity Gate (required for every regenerated skill)

Use the language-specific authoritative source as the contract for every snippet in the regenerated skill:

- **Python, .NET, Java, TypeScript, Go**: Treat the current Microsoft Learn API reference as the contract.
- **Rust**: Treat the official SDK repository (`https://github.com/Azure/azure-sdk-for-rust`) and crates.io documentation as the contract; Rust packages do not have Learn API-reference pages.

Before finalizing any regenerated skill:

1. Identify each SDK type/method shown in snippets (clients, operation groups, model constructors, enum members, long-running methods like `begin_*`).
2. Verify each symbol and signature against the authoritative source for that language/package (see above).
3. If the authoritative source shows a different shape (for example nested `properties=...` models, renamed methods, `begin_*` LRO methods), update the snippet to match.
4. Re-check imports so model/client modules match the authoritative source exactly.
5. Do not keep compatibility shortcuts that contradict authoritative examples in primary snippets.

### Scenario Coverage Gate (required for every regenerated skill, all languages)

Regeneration is not complete when snippets compile — it is complete when the skill demonstrates real usage breadth.

Before finalizing any regenerated skill:

1. Identify **hero scenarios** from the current authoritative docs/samples for that SDK (Microsoft Learn where available; otherwise the upstream SDK repo and package documentation).
2. Ensure each hero scenario is represented in the skill with copy-pastable snippets (or an explicit link to a bundled reference file when too large).
3. Add/refresh test scenarios so hero flows are validated by harness patterns.
4. Add at least **one important non-hero scenario** (for example: update/patch, delete/cleanup, export/import, advanced auth mode, paging/filtering, retries/error handling, or LRO monitoring) when supported by the SDK. For Python SDKs that support both sync and async clients, present both forms with equal priority; do not treat either as universally preferred.
5. For Azure SDK skills, structure `references/` as:
   - `references/capabilities.md` as a concise index that records each hero scenario and where it is covered (`SKILL.md` or a bundled reference), plus links to deeper non-hero references, with no historical/migration narration.
   - `references/non-hero-scenarios.md` for concrete non-hero examples that are intentionally kept out of the main `SKILL.md`.
   - Additional `references/*.md` files for specialized deep-dives (operation groups, tools, evaluator matrices, etc.).
6. If the SDK has broad operation-group coverage (common in management SDKs), include an operation-group table and explicitly call out which groups are covered in snippets vs. referenced only.
7. Never claim "full API surface" unless the skill genuinely demonstrates all major operation groups; otherwise state that the skill is optimized for hero workflows plus selected secondary scenarios.

### Regeneration Workflow Step 3: Validate Regenerated Skill Behavior

```bash
(cd tests && pnpm harness <skill-name> --mock --verbose)
```

If the skill has a Vally scenario, run that eval as well (locally or in CI) before finalizing.

**Rust regeneration gate (required for Rust skills):**

When regenerating any Rust skill, verify the generated `## Best Practices` section contains these exact first two rules:

1. `Use cargo add to manage dependencies, never edit Cargo.toml directly`
2. `Add azure_core only when importing azure_core types directly`

Use a content check before finalizing:

```bash
rg -n "Use `cargo add` to manage dependencies, never edit `Cargo.toml` directly|Add `azure_core` only when importing `azure_core` types directly" .github/plugins/azure-sdk-rust/skills/**/SKILL.md
```

The regeneration is not complete unless both lines are present in each affected Rust skill.

### Regeneration Workflow Step 4: Regenerate Docs Artifacts After Refresh

```bash
(cd docs-site && npx tsx scripts/extract-skills.ts && npm run build)
```

### Regeneration Workflow Step 5: Record What Changed

In the PR/commit notes, include:

- Which upstream docs/examples were used
- Which snippets/signatures were corrected
- Which tests/evals were run and their outcomes

#### Python plugin batch recipe: `azure-sdk-python`

Use this when the request is "regenerate all Python skills under azure-sdk-python."

1. **Scope the exact targets first**

```bash
# Canonical source of truth for Python plugin skills
ls .github/plugins/azure-sdk-python/skills/*/SKILL.md
```

- Treat `.github/plugins/azure-sdk-python/skills/` as canonical.
- Keep `.github/skills/<name>` links in sync after edits (symlink check/fix step below).

2. **For each skill, refresh from authoritative sources**

- Always use `microsoft-docs` MCP first for current Microsoft Learn API guidance.
- Verify the installed package version with `pip show <package>`, then inspect the installed package or official API reference to verify every symbol and signature used in snippets.
- For Azure SDK skills, prefer package overview + official SDK repo examples.
- For non-Azure Python skills in this plugin (for example `fastapi-router-py`, `pydantic-models-py`), keep language-specific best-practice variants and skip Azure-specific auth callouts when lifecycle/auth is not applicable.

3. **Apply Python enforcement rules consistently**

- Keep the standard section order for Azure SDK Python skills.
- Ensure `## Authentication & Lifecycle` starts with the required callout block (verbatim) when applicable.
- Ensure every client example uses `with` / `async with` lifecycle patterns.
- Ensure `## Best Practices` starts with the two required user-facing rules (or the documented variant for async-only/provider-pattern skills).
- Ensure each regenerated Azure SDK Python skill has `references/capabilities.md` (index) and `references/non-hero-scenarios.md` (concrete non-hero examples).
- Keep existing references/assets/scripts unless stale or incorrect.

4. **Validate all regenerated Python skills**

```bash
# Fast frontmatter/structure validation for every Python skill
python .github/skills/skill-creator/scripts/quick_validate.py .github/plugins/azure-sdk-python/skills/<skill-name>

# Run Python skill harness in mock mode (all *-py scenarios)
(cd tests && pwsh ./run-harness-by-language.ps1 -Language py -Mock)
```

5. **Sync skill links and docs artifacts**

```bash
# Ensure .github/skills links point at plugin canonical skills
python .github/scripts/sync_skill_links.py --plugin azure-sdk-python --check
python .github/scripts/sync_skill_links.py --plugin azure-sdk-python --apply

# Refresh docs site data after content changes
(cd docs-site && npx tsx scripts/extract-skills.ts && npm run build)
```

6. **Completion criteria for batch regeneration**

- Every targeted `.github/plugins/azure-sdk-python/skills/*/SKILL.md` is updated or explicitly confirmed current.
- Harness mock run for `-py` skills passes without regressions.
- Skill links are in sync for `azure-sdk-python`.
- PR notes include upstream docs used, signature corrections, and validation outcomes.

---

## Progressive Disclosure Patterns

### Pattern 1: High-Level Guide with References

```markdown
# SDK Name

## Quick Start

[Minimal example]

## Advanced Features

- **Streaming**: See [references/streaming.md](references/streaming.md)
- **Tools**: See [references/tools.md](references/tools.md)
```

### Pattern 2: Language Variants

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

### Pattern 3: Feature Organization

```
azure-ai-agents/
├── SKILL.md (core workflow)
└── references/
    ├── tools.md
    ├── streaming.md
    ├── async-patterns.md
    └── error-handling.md
```

---

## Design Pattern References

| Reference                          | Contents                             |
| ---------------------------------- | ------------------------------------ |
| `references/workflows.md`          | Sequential and conditional workflows |
| `references/output-patterns.md`    | Templates and examples               |
| `references/azure-sdk-patterns.md` | Language-specific Azure SDK patterns |

---

## Anti-Patterns

| Don't                                                                          | Why                                                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Create skill without SDK context                                               | Users must provide package name/docs URL                                            |
| Put "when to use" in body                                                      | Body loads AFTER triggering                                                         |
| Hardcode credentials                                                           | Security risk                                                                       |
| Skip authentication section                                                    | Agents will improvise poorly                                                        |
| Use outdated SDK patterns                                                      | APIs change; search docs first                                                      |
| Include README.md                                                              | Agents don't need meta-docs                                                         |
| Deeply nest references                                                         | Keep one level deep                                                                 |
| Skip acceptance criteria                                                       | Skills without tests can't be validated                                             |
| Skip symlink categorization                                                    | Skills won't be discoverable by category                                            |
| Use wrong import paths                                                         | Azure SDKs have specific module structures                                          |
| Omit sync/async + context-manager bullets from Best Practices in Python skills | End users won't follow rules that aren't written down; examples alone aren't enough |
| Mix sync and async in the same Python example                                  | Demonstrates the anti-pattern the skill is supposed to prevent                      |
| Ship regenerated skills with zero test scenarios                               | Hero workflows and regressions cannot be validated                                  |
| Claim full API coverage from a single happy-path sample                        | Hides operation-group and non-hero gaps users need for production                   |
| Omit `references/*.md` coverage for non-hero capabilities                      | Forces advanced capabilities out of context and leaves API breadth undocumented     |

---

## Checklist

Before completing a skill:

**Prerequisites:**

- [ ] User provided SDK package name or documentation URL
- [ ] Verified SDK patterns via `microsoft-docs` MCP
- [ ] Verified every snippet's API surface against the current official language-specific API reference for that SDK (Microsoft Learn where available, otherwise the upstream SDK repo — see canonical sources above)

**Skill Creation:**

- [ ] Description includes what AND when (trigger phrases)
- [ ] SKILL.md under 500 lines
- [ ] Authentication follows language rules (`DefaultAzureCredential` for Python/.NET/Java/TS/Go local dev; `DeveloperToolsCredential` local dev + `ManagedIdentityCredential` production for Rust)
- [ ] Includes cleanup/delete in examples
- [ ] References organized by feature (`capabilities.md` index + dedicated deep-dive files)
- [ ] Hero scenarios from the current authoritative docs/samples for that SDK are explicitly covered in snippets and tests
- [ ] At least one high-value non-hero scenario is included when the SDK supports a distinct non-hero scenario (otherwise note that no distinct non-hero scenario applies)
- [ ] For Azure SDK skills, `references/capabilities.md` indexes hero/non-hero coverage and links to dedicated non-hero docs
- [ ] For Azure SDK skills, `references/non-hero-scenarios.md` contains concrete non-hero examples distinct from hero snippets
- [ ] For broad SDKs (especially management SDKs), operation-group coverage is explicit (covered in snippets vs. reference-only)
- [ ] **(Python skills only) Best Practices section contains the two user-facing rules** (sync-or-async consistency + context managers for clients and async credentials), using the variant matched to the skill type
- [ ] For Rust skills: `## Best Practices` starts with cargo dependency rule + `azure_core` direct-import rule

**Categorization:**

- [ ] Skill created in `.github/skills/<skill-name>/`
- [ ] Symlink created in `skills/<language>/<category>/<short-name>`
- [ ] Symlink points to `../../../.github/skills/<skill-name>`

**Testing:**

- [ ] `tests/scenarios/<skill-name>/acceptance-criteria.md` created with correct/incorrect patterns
- [ ] `tests/scenarios/<skill-name>/scenarios.yaml` created
- [ ] At least one hero scenario and one non-hero scenario are test-covered (when the SDK supports both)
- [ ] All scenarios pass (`pnpm harness <skill> --mock`)
- [ ] Import paths documented precisely

**Documentation:**

- [ ] README.md skill catalog updated
- [ ] Instructs to search `microsoft-docs` MCP for current APIs
