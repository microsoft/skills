# Skill Evaluation Test Harness

## Quick Start

```bash
cd tests
pnpm install
pnpm harness --list                              # List available skills
pnpm harness azure-ai-projects-py --mock --verbose # Run evaluation
pnpm test                                        # Run unit tests
```

## Overview

A TypeScript test framework for evaluating AI-generated code against acceptance criteria defined in skill files. Powered by the [GitHub Copilot SDK](https://github.com/github/copilot-sdk).

**Workflow:**

1. Load acceptance criteria from `tests/scenarios/<skill>/acceptance-criteria.md`
2. Run test scenarios from `tests/scenarios/<skill>/scenarios.yaml`
3. Generate code using [GitHub Copilot SDK](https://github.com/github/copilot-sdk) (or mock responses)
4. Evaluate code against correct/incorrect patterns
5. Report results via console, markdown, or JSON

## Architecture

```
tests/
├── harness/
│   ├── types.ts              # Type definitions
│   ├── criteria-loader.ts    # Parses acceptance-criteria.md
│   ├── evaluator.ts          # Validates code against patterns
│   ├── copilot-client.ts     # Wraps Copilot SDK (with mock fallback)
│   ├── runner.ts             # Main CLI runner
│   ├── ralph-loop.ts         # Iterative improvement loop
│   ├── feedback-builder.ts   # LLM-actionable feedback generator
│   ├── index.ts              # Package exports
│   └── reporters/
│       ├── console.ts        # Pretty console output
│       └── markdown.ts       # Markdown report generation
│
├── scenarios/
│   └── <skill-name>/
│       └── scenarios.yaml    # Test scenarios for the skill
│
├── fixtures/                 # Test fixtures
├── package.json              # Dependencies (pnpm)
├── tsconfig.json             # TypeScript config
└── vitest.config.ts          # Test configuration
```

## CLI Usage

```bash
# Basic usage
pnpm harness <skill-name>

# Options
pnpm harness azure-ai-projects-py \
    --mock                  # Use mock responses (no Copilot SDK)
    --verbose               # Show detailed output
    --filter basic          # Filter scenarios by name/tag
    --output json           # Output format (text/json)
    --output-file report.json

# Ralph Loop (iterative improvement)
pnpm harness azure-ai-projects-py \
    --ralph                 # Enable iterative improvement
    --max-iterations 5      # Max iterations per scenario
    --threshold 80          # Quality threshold (0-100)
```

## Ralph Loop

The Ralph Loop enables iterative code improvement by re-generating code until quality thresholds are met:

```
Generate → Evaluate → Analyze → Re-generate (with feedback)
    ↑                                    │
    └────────────────────────────────────┘
         (Loop until threshold met)
```

**Stop conditions:**

- Quality threshold met (default: 80)
- Perfect score (100)
- Max iterations reached (default: 5)
- No improvement between iterations
- Score regression

## Programmatic Usage

```typescript
import {
  AcceptanceCriteriaLoader,
  CodeEvaluator,
  SkillEvaluationRunner,
  RalphLoopController,
  createRalphConfig,
} from './harness';

// Simple evaluation
const loader = new AcceptanceCriteriaLoader();
const criteria = loader.load('azure-ai-projects-py');
const evaluator = new CodeEvaluator(criteria);

const result = evaluator.evaluate(code, 'my-test');
console.log(`Score: ${result.score}`);

// Full runner
const runner = new SkillEvaluationRunner({ useMock: true });
const summary = await runner.run('azure-ai-projects-py');

// With Ralph Loop
const ralphSummary = await runner.runWithLoop('azure-ai-projects-py', undefined, {
  maxIterations: 5,
  qualityThreshold: 80,
});
```

## Adding Tests for a New Skill

### 1. Create Acceptance Criteria

Create `tests/scenarios/<skill-name>/acceptance-criteria.md`:

```markdown
# Acceptance Criteria: skill-name

## Imports

### ✅ Correct
\`\`\`python
from azure.ai.mymodule import MyClient
\`\`\`

### ❌ Incorrect
\`\`\`python
from azure.ai.mymodule.models import MyClient  # Wrong location
\`\`\`
```

### 2. Create Test Scenarios

Create `tests/scenarios/<skill-name>/scenarios.yaml`:

```yaml
config:
  model: gpt-4
  max_tokens: 2000
  temperature: 0.3

scenarios:
  - name: basic_usage
    prompt: |
      Create a basic example using the SDK.
    expected_patterns:
      - "DefaultAzureCredential"
    forbidden_patterns:
      - "hardcoded-endpoint"
    tags:
      - basic
    mock_response: |
      from azure.identity import DefaultAzureCredential
      # ... working example
```

### 3. Run Tests

```bash
pnpm harness <skill-name> --mock --verbose
pnpm test
```

## Vally Evals (Coexisting Convention)

Use this convention so Vally evals can live beside harness scenarios without changing existing harness behavior.

For full setup, execution commands, scenario structure, and troubleshooting, see `tests/scenarios/README.md`.

### Folder Layout

```text
tests/
  scenarios/
    <skill-name>/
      acceptance-criteria.md
      scenarios.yaml
      vally/
        eval.yaml                 # Canonical Vally entrypoint for this skill
        eval-nobuild.yaml         # Optional variants
        tools/                    # Program graders and helper scripts
        workspace/                # Seed workspace files for Vally runs
```

### Rules

1. Keep Vally files inside `tests/scenarios/<skill-name>/vally/` so ownership stays per skill.
2. Keep harness files unchanged: `acceptance-criteria.md` and `scenarios.yaml` remain the CI source for existing workflows.
3. Use `eval.yaml` as the canonical Vally file and keep alternatives (`eval-old.yaml`, `eval-nobuild.yaml`) optional.
4. In Vally specs, set skill paths relative to `tests/scenarios/<skill-name>/vally/`.

### Path Example

For `tests/scenarios/azure-storage-blob-rust/vally/eval.yaml`, reference the skill as:

```yaml
environment:
  skills:
    - ../../../../.github/plugins/azure-sdk-rust/skills/azure-storage-blob-rust
```

## Evaluation Scoring

| Factor | Impact |
|--------|--------|
| Syntax error | -100 |
| Incorrect pattern found | -15 each |
| Error finding | -20 each |
| Warning finding | -5 each |
| Correct pattern matched | +5 each |

A result **passes** if it has no error-severity findings.

## Test Coverage

**123 skills with 1114 test scenarios**

| Language | Skills | Scenarios |
|----------|--------|-----------|
| Core | 5 | 51 |
| Python | 41 | 333 |
| .NET | 28 | 286 |
| TypeScript | 23 | 249 |
| Java | 26 | 195 |

```bash
pnpm harness --list  # See all available skills
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No skills found | Check `acceptance-criteria.md` exists in `references/` |
| Copilot SDK unavailable | Use `--mock` flag or set up PAT authentication (see below) |
| Tests fail with real Copilot | Mock responses are hand-crafted; review criteria flexibility |

## Real SDK Evaluation

The harness supports two authentication methods for real Copilot SDK evaluation:

### Local Development (Copilot CLI)

1. Install Copilot CLI: `npm install -g @github/copilot`
2. Run `copilot` and authenticate via `/login`
3. Run without `--mock`: `pnpm harness azure-ai-projects-py --verbose`

### CI/CD (PAT Authentication)

For automated pipelines, use a Personal Access Token:

1. Create a fine-grained PAT at <https://github.com/settings/personal-access-tokens/new>
2. Add the **"Copilot Requests"** permission
3. Set the token as environment variable `GH_TOKEN` or `GITHUB_TOKEN`

```bash
export GH_TOKEN="your-pat-with-copilot-requests-permission"
pnpm harness azure-ai-projects-py --verbose
```

### GitHub Actions Workflows

| Workflow | Trigger | Mode | Purpose |
|----------|---------|------|---------|
| `test-harness.yml` | PR, push to main | Mock | Fast, deterministic CI |
| `skill-evaluation.yml` | Nightly, manual | Real SDK | Quality measurement |

To enable real SDK evaluation in GitHub Actions:

1. Create repository secret `COPILOT_TOKEN` with PAT (Copilot Requests permission)
2. Set repository variable `ENABLE_REAL_EVAL=true`
3. Trigger manually via Actions tab, or wait for nightly run
