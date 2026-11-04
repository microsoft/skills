# Dockerfile Generation

Generate Dockerfiles for components targeting Container Apps (or B1+ App Service) that have no existing Dockerfile. Read this when `iac-generation-rules.md` Step 6b applies.

## When to Generate

- Component targets Container Apps and has NO Dockerfile (and no `Dockerfile.azure`)
- Component targets App Service B1+ with `deployStrategy.containerized: true`
- ⛔ Do NOT generate for F1/D1 SKUs — use platform runtime stack instead
- ⛔ Do NOT overwrite an existing Dockerfile — create `Dockerfile.azure` only if BuildKit stripping is needed

## Principles

### Layer ordering

Copy dependency manifests and install BEFORE copying source (preserves layer cache):

```
COPY {manifest files} ./
RUN {install command}
COPY . .
```

### Base image selection

| Principle | Rule |
|-----------|------|
| Pin version | `node:{major}-slim`, NOT `node:latest` |
| Slim variants | `-slim` or `-alpine` for smaller images |
| Multi-stage | Go, .NET, Java, Rust: build in SDK image, copy binary to runtime |
| Match runtime | Read `engines`, `python_requires`, `go.mod`, `<TargetFramework>` |
| PHP security | Use a floating minor tag on the nearest supported branch the app's `composer.json`/`composer.lock` PHP constraints allow (if none, the newest they allow, with an `assumptions[]` note), never an old patch tag — a pinned patch bakes known RCE flaws into the image |

### Port alignment

`EXPOSE` port, app's listening port, and Container App `targetPort` must all match. Mismatch = silent health probe failure. Read app config for listening port, set `EXPOSE {port}`, add `ENV PORT={port}` if app reads `PORT` from env.

### Security defaults

- Non-root user — Debian/`-slim` base: `RUN groupadd -r app && useradd -r -g app app`; Alpine base: `RUN addgroup -S app && adduser -S app -G app`. Then `USER app`
- Never `COPY .env` or secrets — use `.dockerignore`
- Direct exec: `CMD ["node", "server.js"]` not `CMD ["npm", "start"]`

### .dockerignore

Always generate alongside Dockerfile. Exclude: `.git`, `node_modules`, `__pycache__`, `*.pyc`, `.env`, `.env.*`, `.azure`, `.copilot-azure`, `infra`, `*.md`.

### Common pitfalls

| Mistake | Fix |
|---------|-----|
| `COPY . .` before deps | Copy manifests first, install, then source |
| `npm install` in prod | `npm ci --omit=dev` |
| Wrong EXPOSE port | Read actual listening port from app source |

### Next.js multi-container build args

`NEXT_PUBLIC_*` env vars are embedded in the client JS bundle at `npm run build` time — runtime Container App env vars have zero effect on client-side code. For multi-container deploys where a Next.js frontend references another component's API:

1. Dockerfile MUST include `ARG NEXT_PUBLIC_API_URL` before the `RUN npm run build` step
2. Deploy phase passes `--build-arg NEXT_PUBLIC_API_URL=https://{api-fqdn}` to `az acr build`

Detect from `.env*` files containing `NEXT_PUBLIC_*` pointing to another service (e.g., `NEXT_PUBLIC_API_URL=http://localhost:3001`).

### ACR Build Compatibility — `Dockerfile.azure` Generation

⛔ ACR `az acr build` uses the **classic Docker builder — NOT BuildKit**. Do NOT assume ACR supports BuildKit.

**When to generate `Dockerfile.azure`:** If `buildRequirements.hasBuildKitSyntax == true` OR the existing Dockerfile contains any BuildKit-only syntax, create `{component}/Dockerfile.azure` with all BuildKit syntax removed.

**BuildKit-only syntax** (strip all): `# syntax=` directives, `RUN --mount=...` (all types: cache, secret, bind, tmpfs), `RUN --network=...`, `RUN --security=...`, `COPY --link`, `COPY --chmod=...`, heredoc syntax (`RUN <<EOF`).

⛔ **Package manager pinning applies here too.** When stripping BuildKit from an existing Dockerfile, also replace `npm install -g {pm}@latest` with the exact version from the project's `packageManager` field in `package.json` (e.g., `pnpm@9.4.0`). The upstream Dockerfile's `@latest` may pull a version incompatible with the base image's Node.js version.

⛔ Handle multi-line continuations (`\`) — remove the BuildKit flag but preserve the actual command across all continuation lines. Never leave a bare `RUN` with no command.
