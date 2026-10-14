# Agent Integration with Skills

How AI agents discover, load, and use skills from this repository.

## Skill Discovery Mechanism

Agents discover skills through a two-phase process:

### Phase 1: Directory Scanning

At startup, agents scan configured skill directories (typically `.github/skills/`) for folders containing a `SKILL.md` file:

```
.github/skills/
├── azure-cosmos-db-py/
│   └── SKILL.md          # Valid skill
├── azure-ai-agents-ts/
│   └── SKILL.md          # Valid skill
├── mcp-builder/
│   └── SKILL.md          # Valid skill
└── some-folder/
    └── README.md         # NOT a skill (no SKILL.md)
```

### Phase 2: Metadata Extraction

For each discovered skill, agents parse only the YAML frontmatter:

```yaml
---
name: azure-cosmos-db-py
description: Build Azure Cosmos DB NoSQL services with Python/FastAPI following production-grade patterns.
---
```

This metadata is loaded into the agent's context at startup, using ~50-100 tokens per skill.

## VS Code / GitHub Copilot Discovery

GitHub Copilot and VS Code agents discover skills via:

1. **Workspace scanning**: Skills in `.github/skills/` are automatically detected
2. **Copilot instructions**: The `.github/copilot-instructions.md` file references available skills
3. **Agent personas**: Files in `.github/agents/` (e.g., `backend.agent.md`) can specify which skills to load

### Copilot Configuration Example

In `.github/copilot-instructions.md`:

```markdown
## Available Skills

For Azure Cosmos DB work, load the `azure-cosmos-db-py` skill.
For FastAPI endpoints, load the `fastapi-router-py` skill.
```

## Autohand Code Discovery

Autohand Code discovers skills from user-level and project-level skill directories:

```text
~/.autohand/skills/<skill>/
<project>/.autohand/skills/<skill>/
```

Use the cataloged overview skill when you want high-level Microsoft SDK grounding:

```bash
autohand --skill-install microsoft-skills
autohand --skill-install microsoft-skills --project
```

For a specific repository skill, copy or symlink only the skill directories relevant to the current project:

```bash
git clone https://github.com/microsoft/skills.git microsoft-skills
mkdir -p your-project/.autohand/skills
cp -r microsoft-skills/.github/skills/azure-cosmos-db-py your-project/.autohand/skills/
```

## Progressive Disclosure

Skills use a three-tier loading strategy to manage context efficiently:

| Tier | Content | When Loaded | Token Cost |
|------|---------|-------------|------------|
| **1. Metadata** | `name` + `description` from frontmatter | Startup | ~50-100 per skill |
| **2. Instructions** | Full `SKILL.md` body | On activation | ~500-2000 |
| **3. Resources** | Files in `scripts/`, `references/`, `assets/` | On demand | Variable |

### Example: Skill Activation Flow

```
User: "Create a Cosmos DB service for user data"

Agent thinks:
  → Scans loaded metadata for relevant skills
  → Finds: "azure-cosmos-db-py: Build Azure Cosmos DB NoSQL services..."
  → Activates skill by reading full SKILL.md
  → Follows instructions to implement the service
```

## Skill Loading by Agent Type

### Claude Code / Copilot CLI

Filesystem-based agents load skills via shell commands:

```bash
cat /path/to/skills/azure-cosmos-db-py/SKILL.md
```

The skill's `location` field in the available skills prompt tells the agent where to find it.

### Tool-Based Agents

Agents without filesystem access use dedicated tools:

```python
# Agent calls a skill-loading tool
result = load_skill("azure-cosmos-db-py")
```

## Selective Loading Best Practice

**Never load all skills at once.** This causes context rot:

- Diluted attention across unrelated domains
- Wasted tokens on irrelevant instructions
- Conflated patterns from different SDKs

**Do this instead:**

```
User request: "Add a blob storage endpoint"

Agent should:
1. Identify task domain: Azure Storage + API endpoint
2. Load ONLY: azure-storage-blob-py, fastapi-router-py
3. Ignore: azure-cosmos-db-py, react-flow-node-ts, etc.
```

## Adding Skills to Your Project

### Via npx (recommended)

```bash
npx skills add microsoft/agent-skills
# Select skills from interactive wizard
```

### Manual Installation

```bash
# Copy specific skills
cp -r agent-skills/.github/skills/azure-cosmos-db-py your-project/.github/skills/

# Copy specific skills for Autohand Code
mkdir -p your-project/.autohand/skills
cp -r agent-skills/.github/skills/azure-cosmos-db-py your-project/.autohand/skills/

# Or symlink for multi-project setups
ln -s /path/to/agent-skills/.github/skills/mcp-builder /path/to/your-project/.github/skills/mcp-builder
ln -s /path/to/agent-skills/.github/skills/mcp-builder /path/to/your-project/.autohand/skills/mcp-builder
```

## Skill Naming Convention

Skills use language suffixes for automatic categorization:

| Suffix | Language | Example |
|--------|----------|---------|
| `-py` | Python | `azure-cosmos-db-py` |
| `-dotnet` | .NET/C# | `azure-ai-inference-dotnet` |
| `-ts` | TypeScript | `azure-ai-agents-ts` |
| `-java` | Java | `azure-cosmos-java` |
| (none) | Cross-language | `mcp-builder`, `skill-creator` |

This allows agents to filter skills by the project's technology stack.
