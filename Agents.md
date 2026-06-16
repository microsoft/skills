# Agent Skills

A repository of skills, prompts, and MCP configurations for AI coding agents working with Azure SDKs and Microsoft AI Foundry services.

## ⚠️ Fresh Information First

**Azure SDKs and Foundry APIs change constantly. Never work with stale knowledge.**

Before implementing anything with Azure/Foundry SDKs:

1. **Search official docs first** — Use the Microsoft Docs MCP (`microsoft-docs`) to get current API signatures, parameters, and patterns
2. **Verify SDK versions** — Check `pip show <package>` for installed versions; APIs differ between versions
3. **Don't trust cached knowledge** — Your training data is outdated. The SDK you "know" may have breaking changes.

```
# Always do this first
1. Search Microsoft Learn for current docs
2. Check Context7 for indexed Foundry documentation (updated daily)
3. Verify against actual installed package version
```

**If you skip this step and use outdated patterns, you will produce broken code.**

---

## Core Principles

These principles reduce common LLM coding mistakes. Apply them to every task.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

**The test:** Would a senior engineer say this is overcomplicated? If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

**The test:** Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution (TDD)

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

| Instead of... | Transform to... |
|---------------|-----------------|
| "Add validation" | "Write tests for invalid inputs, then make them pass" |
| "Fix the bug" | "Write a test that reproduces it, then make it pass" |
| "Refactor X" | "Ensure tests pass before and after" |

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Clean Architecture

Follow these layered boundaries when building features:

```
┌─────────────────────────────────────┐
│           Presentation              │  ← Routers, API endpoints
├─────────────────────────────────────┤
│           Application               │  ← Use cases, orchestration
├─────────────────────────────────────┤
│             Domain                  │  ← Entities, business rules
├─────────────────────────────────────┤
│          Infrastructure             │  ← Database, external APIs
└─────────────────────────────────────┘
```

**Rules:**

- Dependencies point inward (outer layers depend on inner layers)
- Domain layer has no external dependencies
- Infrastructure implements interfaces defined in inner layers
- Each layer should be testable in isolation

---

## SDK Quick Reference

| Package | Purpose | Install |
|---------|---------|---------|
| `azure-ai-projects` | Foundry project client, agents, evals, connections | `pip install azure-ai-projects` |
| `azure-ai-agents` | Standalone agents client (use via projects) | `pip install azure-ai-agents` |
| `azure-search-documents` | Azure AI Search SDK | `pip install azure-search-documents` |
| `azure-identity` | Authentication | `pip install azure-identity` |

### Authentication Pattern

Always use `DefaultAzureCredential` for production:

```python
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

credential = DefaultAzureCredential()
client = AIProjectClient(
    endpoint="https://<resource>.services.ai.azure.com/api/projects/<project>",
    credential=credential
)
```

### Environment Variables

```bash
AZURE_AI_PROJECT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>
AZURE_AI_MODEL_DEPLOYMENT_NAME=gpt-4o-mini
```

---

## Skills

Skills are domain-specific knowledge packages in `.github/skills/`. Each has a `SKILL.md` with:

- **YAML frontmatter** (`name`, `description`) — triggers skill loading
- **Markdown body** — loaded only when skill activates

> **⚠️ Temporary duplication note:** Skills in `.github/skills/` are duplicated from `.github/plugins/*/skills/` to support `npx skills add microsoft/skills` installation. The plugin directories remain the canonical source. This duplication is temporary until the skills installer supports symlinks/pointer files.

### Quick Start

```bash
# Install skills using skills.sh
npx skills add microsoft/skills
```

### Skill Catalog

> Location: `.github/skills/` • 133 skills • See [README.md#skill-catalog](README.md#skill-catalog)

| Language | Skills | Suffix | Examples |
|----------|--------|--------|----------|
| **Core** | 6 | — | `mcp-builder`, `skill-creator`, `copilot-sdk` |
| **Python** | 41 | `-py` | `azure-ai-projects-py`, `azure-cosmos-py`, `azure-ai-ml-py` |
| **.NET** | 30 | `-dotnet` | `azure-ai-projects-dotnet`, `azure-storage-blob-dotnet`, `azure-security-keyvault-keys-dotnet` |
| **TypeScript** | 25 | `-ts` | `azure-ai-projects-ts`, `azure-storage-blob-ts`, `aspire-ts` |
| **Java** | 26 | `-java` | `azure-ai-projects-java`, `azure-cosmos-java`, `azure-eventhub-java` |

### Skill Selection

Only load skills relevant to the current task. Loading all skills causes context rot — diluted attention and conflated patterns.

### Creating New Skills

> **Detailed guide:** Load the `/skill-creator` skill for comprehensive instructions.

**Prerequisites:** User MUST provide SDK context:

- SDK package name (e.g., `azure-ai-agents`)
- Documentation URL or GitHub repository
- Target language (py/dotnet/ts/java)

**Quick workflow:**

1. **Create skill** in `.github/skills/<skill-name>/SKILL.md`

   ```
   # Naming: azure-<service>-<language>
   # Example: azure-ai-agents-py
   ```

2. **Categorize with symlink** in `skills/<language>/<category>/`

   ```bash
   cd skills/python/foundry
   ln -s ../../../.github/skills/azure-ai-agents-py agents
   ```

3. **Create tests**
   - `tests/scenarios/<skill>/acceptance-criteria.md` — correct/incorrect patterns
   - `tests/scenarios/<skill>/scenarios.yaml` — test scenarios

4. **Verify**

   ```bash
   cd tests && pnpm harness <skill-name> --mock --verbose
   ```

5. **Update README.md** — Add to skill catalog

**Product area categories:**

| Category | Skills |
|----------|--------|
| `foundry` | AI agents, projects, inference, search |
| `data` | Storage, Cosmos DB, Tables |
| `messaging` | Event Hubs, Service Bus, Event Grid |
| `monitoring` | OpenTelemetry, App Insights |
| `identity` | Authentication, credentials |
| `security` | Key Vault |
| `integration` | API Management, App Configuration |

---

## MCP Servers

Pre-configured Model Context Protocol servers in `.vscode/mcp.json` provide additional capabilities:

### Documentation & Search

| MCP | Purpose |
|-----|---------|
| `microsoft-docs` | **Search Microsoft Learn** — Official Azure/Foundry docs. Use this FIRST. |
| `context7` | Indexed Foundry documentation with semantic search (updated daily via GitHub workflow) |
| `deepwiki` | Ask questions about GitHub repositories |

### Development Tools

| MCP | Purpose |
|-----|---------|
| `github` | GitHub API operations |
| `playwright` | Browser automation and testing |
| `terraform` | Infrastructure as code |
| `eslint` | JavaScript/TypeScript linting |

### Utilities

| MCP | Purpose |
|-----|---------|
| `sequentialthinking` | Step-by-step reasoning for complex problems |
| `memory` | Persistent memory across sessions |
| `markitdown` | Convert documents to markdown |

**Usage:** MCPs are available when configured in your editor. Use `microsoft-docs` to search official documentation before implementing Azure SDK code.

---

## Conventions

### Code Style

- Prefer `async/await` for all Azure SDK I/O
- Use context managers: `with client:` or `async with client:`
- Close clients explicitly or use context managers
- Use `create_or_update_*` for idempotent operations
- Use type hints on all function signatures

### Git & GitHub

- Always use `gh` CLI for GitHub operations (PRs, issues, etc.) — never the MCP `github-create_pull_request` tool
- Use `gh pr create` for pull requests, `gh issue create` for issues

### Clean Code Checklist

Before completing any code change:

- [ ] Functions do one thing
- [ ] Names are descriptive and intention-revealing
- [ ] No magic numbers or strings (use constants)
- [ ] Error handling is explicit (no empty catch blocks)
- [ ] No commented-out code
- [ ] Tests cover the change

### Testing Patterns

```python
# Arrange
service = ProjectService()
expected = Project(id="123", name="test")

# Act  
result = await service.get_project("123")

# Assert
assert result == expected
```

For Azure SDK tests:

- Use `pytest-asyncio` for async tests
- Mock Azure clients at the service boundary
- Test both success and error paths

---

## Workflow: Adding a Feature

1. **Clarify** — Understand the requirement. Ask if unclear.
2. **Test First** — Write a failing test that defines success.
3. **Implement** — Write minimum code to pass the test.
4. **Refactor** — Clean up while tests stay green.
5. **Verify** — Run full test suite, check types, lint.

```bash
# Example workflow
pytest tests/test_feature.py -v     # Run specific tests
mypy src/                           # Type check
ruff check src/                     # Lint
```

---

## Do's and Don'ts

### Do

- ✅ Use `DefaultAzureCredential` for authentication
- ✅ Use async/await for all Azure SDK operations
- ✅ Write tests before or alongside implementation
- ✅ Keep functions small and focused
- ✅ Match existing patterns in the codebase
- ✅ Use `gh` CLI for all GitHub operations (PRs, issues, releases)

### Don't

- ❌ Hardcode credentials or endpoints
- ❌ Suppress type errors (`as any`, `@ts-ignore`, `# type: ignore`)
- ❌ Leave empty exception handlers
- ❌ Refactor unrelated code while fixing bugs
- ❌ Add dependencies without justification
- ❌ Use GitHub MCP tools for write operations (enterprise token restrictions)

---

## Success Indicators

These principles are working if you see:

- Fewer unnecessary changes in diffs
- Fewer rewrites due to overcomplication
- Clarifying questions come before implementation (not after mistakes)
- Clean, minimal PRs without drive-by refactoring
- Tests that document expected behavior
