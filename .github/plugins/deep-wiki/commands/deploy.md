---
description: Generate a GitHub Actions workflow to deploy the VitePress wiki site to GitHub Pages
---

# Deep Wiki: Deploy to GitHub Pages

Generate a `.github/workflows/deploy-wiki.yml` GitHub Actions workflow that builds and deploys the VitePress wiki to GitHub Pages.

## Step 1: Check Prerequisites

Before generating the workflow:

1. **Verify wiki exists**: Check that `wiki/` directory and `wiki/package.json` exist
   - If not, tell the user: _"Run `/deep-wiki:build` first to scaffold the VitePress site."_
2. **Check for existing deployment workflows**: Search for ANY existing GitHub Pages workflow:
   ```bash
   # Check for exact file
   ls .github/workflows/deploy-wiki.yml 2>/dev/null
   # Check for any pages-related workflow
   grep -rl "deploy-pages\|pages-artifact\|github-pages" .github/workflows/ 2>/dev/null
   ```
   - If `deploy-wiki.yml` exists → **STOP**. Tell the user: _"A deployment workflow already exists at `.github/workflows/deploy-wiki.yml`. No changes needed."_
   - If a DIFFERENT pages workflow exists → **ASK the user**: _"I found an existing GitHub Pages workflow at `{path}`. Should I skip creating a new one, or create `deploy-wiki.yml` alongside it?"_
   - If no pages workflow exists → proceed with generation

## Step 2: Generate Workflow File

Create `.github/workflows/deploy-wiki.yml`:

```yaml
name: Deploy Wiki to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'wiki/**'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
        with:
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: wiki/package-lock.json

      - name: Setup Pages
        uses: actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b # v5.0.0

      - name: Install dependencies
        run: npm ci
        working-directory: wiki

      - name: Build with VitePress
        run: npm run build
        working-directory: wiki

      - name: Upload artifact
        uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa # v3.0.1
        with:
          path: wiki/.vitepress/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4.0.5
```

### Workflow Details

| Setting | Value | Why |
|---------|-------|-----|
| **Trigger** | Push to `main` on `wiki/**` paths | Only rebuilds when wiki content changes |
| **Manual trigger** | `workflow_dispatch` | Allows manual re-deployment |
| **Node version** | 20 | LTS, required for VitePress 1.x |
| **Cache** | npm with `wiki/package-lock.json` | Speeds up subsequent builds |
| **Concurrency** | `pages` group, no cancel | Prevents parallel deploys |
| **Permissions** | `contents: read`, `pages: write`, `id-token: write` | Minimum required for Pages deployment |

## Step 3: Update VitePress Config for GitHub Pages

Check if `wiki/.vitepress/config.mts` needs a `base` path. GitHub Pages serves from:

- **User/org site** (`username.github.io`): `base: '/'` (default, no change needed)
- **Project site** (`username.github.io/repo-name`): `base: '/repo-name/'`

Detect which case applies:

```bash
# Get the repo name
REPO_NAME=$(basename $(git remote get-url origin) .git)
OWNER=$(git remote get-url origin | sed -E 's|.*[:/]([^/]+)/[^/]+\.git|\\1|')
```

If the repo is NOT named `{owner}.github.io`, add the base path to `config.mts`:

```typescript
export default defineConfig({
  base: '/{repo-name}/',
  // ... rest of config
})
```

## Step 4: Generate package-lock.json

If `wiki/package-lock.json` doesn't exist (required for `npm ci` in CI):

```bash
cd wiki && npm install
```

This generates the lock file. Remind the user to commit it.

## Step 5: Commit and Report

After generating the workflow, output:

```
## GitHub Pages Deployment Setup ✅

### Files Created
- `.github/workflows/deploy-wiki.yml` — GitHub Actions workflow

### Files Modified
- `wiki/.vitepress/config.mts` — Added `base: '/{repo-name}/'` (if project site)

### What You Need To Do

> ⚠️ IMPORTANT: GitHub Pages will NOT work until you complete step 2.

1. **Commit the workflow file:**
   ```bash
   git add .github/workflows/deploy-wiki.yml wiki/package-lock.json
   git commit -m "ci: add GitHub Pages deployment for wiki"
   git push
   ```

2. **Enable GitHub Pages (REQUIRED — deployments will fail without this):**
   - Go to your repo on GitHub → **Settings** → **Pages**
   - Under **Build and deployment**, change **Source** to **"GitHub Actions"**
   - Click **Save**
   - Without this step, the workflow runs but the site is NOT published

3. **Your wiki will be live at:**
   - `https://{owner}.github.io/{repo-name}/` (project site)
   - OR `https://{owner}.github.io/` (if repo is named `{owner}.github.io`)

### Triggering Deployments
- **Automatic**: Every push to `main` that changes `wiki/**` files
- **Manual**: Go to Actions → "Deploy Wiki to GitHub Pages" → "Run workflow"
```

## Troubleshooting Guidance

If the user reports issues, suggest checking:

| Issue | Solution |
|-------|----------|
| 404 on deployed site | Verify `base` path in `config.mts` matches repo name |
| Build fails on `npm ci` | Ensure `wiki/package-lock.json` is committed |
| Pages not enabled | Go to Settings → Pages → Source → select "GitHub Actions" |
| Workflow not triggering | Check that changes are in `wiki/**` and pushed to `main` |
| Mermaid diagrams missing | Ensure `mermaid` and `vitepress-plugin-mermaid` are in `package.json` |

$ARGUMENTS
