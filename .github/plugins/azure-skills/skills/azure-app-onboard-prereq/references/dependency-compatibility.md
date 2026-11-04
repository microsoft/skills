Dependency compatibility checks for Azure. Part of the [deployability check](deployability-check.md).

## EOL / Unsupported Runtimes

| Verdict | Condition |
|---------|----------|
| 🔶 Major Migration | .NET Framework 4.x, ASP.NET Core 2.1, Python 2.x |
| ❌ FAIL or 🔶 | Node.js < 18, Java < 11 — config-only upgrade → ❌ FAIL (fixable), API changes needed → 🔶 |

> **Quick test:** ONE config value change, no import changes? → ❌ FAIL. Otherwise → 🔶.

**PHP:** the runtime is the PHP version of the image (`FROM php:`, or any image that embeds PHP); `require.php` is a constraint, not the runtime. A floating minor tag tracks the latest patch. WARN `W-PHP-EOL` (PHP2Shell, critical RCE — [advisory](https://techcommunity.microsoft.com/blog/azurenetworksecurityblog/addressing-php2shell-cve-2026-109618-and-cve-2026-109619-upgrade-guidance-and-az/4566623)), not a verdict from the table above, when that version is on an unsupported branch or below the patched releases (8.5.12, 8.4.27, 8.3.36, 8.2.35). If it can't be determined (for example a digest pin), WARN as unverified with `fixPhase: "post-deploy"`. **fix** (prereq only reports it; the scaffold approval gate offers and applies it, so a standalone scan edits nothing): floating minor tag on the nearest supported branch the app's `composer.json`/`composer.lock` PHP constraints allow, `fixPhase: "scaffold"`; if none is allowed, `fixPhase: "post-deploy"` naming the constraint. With no Dockerfile, warn only in that last case. Never `blocked`.

**Ecosystem-era check (Python):** ALL pinned deps pre-2018, no Python 3.10+ wheels → ❌ FAIL. Signals: `flask_script`, `werkzeug<1.0`, `itsdangerous<1.0`, imports from `werkzeug.contrib.*` / `flask.ext.*`.

## EOL / Unmaintained Frameworks

| Verdict | Condition |
|---------|-----------|
| 🔶 Major Migration | Flask < 2.0, Django < 3.2, Express < 4.0, Rails < 6.0, Spring Boot < 2.7 |
| ⚠️ WARN | React < 16, Angular < 14, Next.js < 13 |

## Archived / Abandoned Repositories

| Signal | Verdict |
|--------|--------|
| `archived: true` + EOL stack | 🔶 Major Migration |
| `archived: true` (current runtime) | ⚠️ WARN |
| README "deprecated"/"unmaintained" + EOL | 🔶 Major Migration |
| README "deprecated"/"unmaintained" (current) | ⚠️ WARN |

> **Remediation scope:** Fixing all blockers requires major upgrade OR >5 files → 🔶 Major Migration.

## Intentionally Vulnerable Applications

Detect via **code structure first**, metadata second. These apps are designed to be exploited — vulnerability IS the product.

**Code signals (check first):**
- Directory `vulnerabilities/` with subdirs like `sqli/`, `xss/`, `csrf/`, `fi/` (file inclusion)
- Security-level config toggling vulnerability severity (`default_security_level`, `security.level`, `difficulty`)
- Source files with intentionally unsanitized `$_GET`/`$_POST`/`$_REQUEST` passed to SQL queries, shell commands (`exec`, `shell_exec`, `system `), or `eval`/`include` -- that are systematic across 3+ files (not a single bug)
- `hackable/`/`exploit/` directories, or files with names like `command_injection.php`, `brute_force.php`

**Metadata signals (secondary check):**
- Project/package description or repo About containing: "deliberately vulnerable", "intentionally insecure", "vulnerable by design", "security training", "penetration testing", "do not deploy to production"
- README/License warning against internet-facing deployment

**Verdict:** ≥2 code signals OR 1 code + 1 metadata → 🛑 HALT. Single metadata only → ⚠️ WARN (could be a disclosure).

> ⛔ **🛑 HALT is a verdict, not an exit.** On 🛑 HALT your NEXT action MUST be the Step-4 write — persist all 3 artifacts (`prereq-output.json`, `context.json`, `readiness-report.md`) with `overallHealth: "blocked"` via the `create` tool, then read them back, BEFORE printing any halt summary to the user. A halt message with no `prereq-output.json` on disk is a failure — the deterministic `blocked` verdict must be persisted first, because the halt message can end the turn.

## Non-Azure Cloud SDK Dependencies

Functional cloud SDK deps → 🔶 blockers; classification and observability carve-out in [cloud-sdk-migration.md](cloud-sdk-migration.md). The redirect gate (SKILL.md Step 2) and the deploy-blocking stop (SKILL.md Step 8 Row 2) own all routing — no `routeToSkill` decision happens here.

## Platform-Specific Dependencies

| Dependency Type | Verdict |
|----------------|---------|
| Native OS binaries (`.so`, `.dll`) | ⚠️ WARN |
| Native Node.js addons on free/low-tier SKUs | ⚠️ WARN |
| GPU-required libraries (CUDA) | ⚠️ WARN |
| Local file system writes, file-based DBs | ⚠️ WARN — ephemeral on PaaS |
| BuildKit Dockerfile syntax (`--mount`, `# syntax=`) | ⚠️ WARN `W-BUILDKIT` — set `buildRequirements.hasBuildKitSyntax: true`. **ACR `az acr build` does NOT support BuildKit** — scaffold must generate `Dockerfile.azure`. **fix:** "Generate ACR-compatible Dockerfile.azure" **fixPhase:** `scaffold` |
| Jib container build (no Dockerfile) | ⚠️ WARN — note Jib path for scaffold |
| Redis client without TLS config | ⚠️ WARN `W-REDIS-TLS` — **fix:** "Add TLS config" **fixPhase:** `prereq`. **Config key registration:** if the app uses a config library that requires keys to be pre-registered before env var override (Go/Viper `Unmarshal()`, Spring `@ConfigurationProperties`), the config file must also declare the TLS key (e.g., add `tlsEnabled: false` to YAML) — otherwise the env var is silently ignored. Detection: grep for `viper.Unmarshal`, `mapstructure`, `@ConfigurationProperties`. |
| PostgreSQL client with SSL disabled | ⚠️ WARN `W-PG-SSL` — **fix:** "Set SSL mode env var" **fixPhase:** `scaffold` |
| MySQL client without TLS config | ⚠️ WARN `W-MYSQL-SSL` — **fix:** "Enable client TLS for Azure MySQL" **fixPhase:** `prereq`. Most MySQL drivers/ORMs need an in-code SSL option (no SSL env var like Postgres has), so this is a client-config change → prereq remediation batch (like `W-REDIS-TLS`), not IaC-only scaffold. Detection: MySQL in the plan (`mysql:*` in compose, or a MySQL driver/ORM — e.g. `mysql2`, `sequelize` dialect mysql, `typeorm`, `prisma`, `knex`) with no SSL/TLS option in the client config. |
| Go Viper without env key replacer | ⚠️ WARN `W-VIPER-ENV` — **fix:** "Add SetEnvKeyReplacer call" **fixPhase:** `prereq` |
| Licensed/proprietary SDKs | ⚠️ WARN |

## Hardcoded Localhost URLs

| Pattern | Verdict | ID | fixPhase |
|---|---|---|---|
| `localhost`, `127.0.0.1`, `0.0.0.0` in API base URLs, CORS origins, webhook URLs, service discovery | ⚠️ WARN | `W-LOCALHOST-URL` | `scaffold` |

> **Exclude:** database connection strings, dev-only files, test files.

## Dockerfile Analysis

| Pattern | Verdict | ID | fixPhase |
|---|---|---|---|
| `CMD.*uv run` / `ENTRYPOINT.*uv run` | ⚠️ WARN | `W-UV-RUN` | `prereq` |
| `CMD.*poetry run` / `ENTRYPOINT.*poetry run` | ⚠️ WARN | `W-POETRY-RUN` | `prereq` |

> Also check `docker-compose.yml` `command:` overrides.

## Native Module Detection

Static lockfile analysis only.

| Language | Signal | Where |
|----------|--------|-------|
| Node.js | `"node-gyp"` in lockfile | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` |
| Python | `numpy`, `pandas`, `grpcio`, `Pillow`, `bcrypt`, `psycopg2` (not `-binary`), `cryptography`, `lxml`, `scipy`, `scikit-learn` | `requirements.txt`, `pyproject.toml` |
| .NET | `[DllImport]`, `NativeLibrary.Load` | `.cs` files |
| Go | `import "C"` (cgo) | `.go` files |
| PHP | `ext-*` requirements | `composer.json` |

> ⛔ **Lockfile grep is the ONLY valid evidence.** Do NOT set `hasNativeModules` from package name alone. `prebuild-install` without `node-gyp` = prebuilt → `hasNativeModules: false`. Key: `bcrypt` ✅ native, `bcryptjs` ❌ JS. `psycopg2` ✅, `psycopg2-binary` ❌. `sharp` v0.33+ ❌ prebuilt. `canvas` ✅ always. No lockfile → `"unknown"`, ⚠️ WARN.

When `hasNativeModules: true`: `f1Viable: false`, `f1BlockReason: "native modules ({signal})"`.

## F1 Viability — Beyond Native Modules

| Condition | f1BlockReason |
|-----------|---------------|
| Large dep tree (Python >10, Node lockfile >500KB, .NET >20 NuGet) | `"large dependency tree"` |
| Build-time compilation (`tsconfig.json` + `"build"` script) | `"build-time compilation"` |
| WSGI/ASGI server (`gunicorn`/`uvicorn`/`daphne`) | `"WSGI/ASGI server"` |
| 🔶 Major Migration (>5 files) | `"major migration"` |

When `f1Viable: false`: prepare selects B1 (~$13/mo) minimum.

## First-Run Initialization

Detect init steps needed before first HTTP request — run automatically in dev but cause 500s on Azure.

| Framework | Signal | Init command |
|-----------|--------|-------------|
| Flask-Migrate/Alembic | `flask_migrate`/`alembic` + `migrations/` | `flask db upgrade` |
| Django | `django` + `manage.py` + `*/migrations/` | `python manage.py migrate` |
| Prisma | `@prisma/client` + `prisma/schema.prisma` | `npx prisma migrate deploy` |
| TypeORM | `typeorm` + `migrations/`/`ormconfig` | `npx typeorm migration:run` |
| Sequelize | `sequelize` + `migrations/` | `npx sequelize-cli db:migrate` |
| EF Core | `EntityFrameworkCore.Tools` in csproj | `dotnet ef database update` |

**Seed/bootstrap:** Flask `@app.cli.command('deploy')` → `flask deploy`. Django `fixtures/` → `manage.py loaddata`. Seed commands: `required: false`.

Migration framework + `migrations/` dir → ⚠️ WARN, write to `prereq-output.json.initCommands[]` (schema in [`prereq-schemas.ts`](prereq-schemas.ts)). ORM without `migrations/` dir → ✅ PASS. Prepare prepends required `initCommands` to `deployStrategy.startupCommand`; scaffold encodes in `appCommandLine`. Migrations are idempotent — safe on every cold start.

## Database & Storage

| Found | Assessment |
|-------|-----------|
| File-based DB (SQLite, LevelDB, DuckDB) | ⚠️ WARN — ephemeral on PaaS. Deploy as-is, suggest managed DB in `postDeployRecommendations[]` |
| Local file storage | Needs Azure Blob Storage |
| In-memory cache only | Consider Redis |
| Managed DB connection string | Ready — update connection |
