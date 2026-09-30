---
mode: agent
description: Scaffold a new full-stack Azure AI Foundry application with React frontend, FastAPI backend, and azd infrastructure
---

# Scaffold Foundry App

Create a production-ready full-stack application for Azure AI Foundry.

## Variables

- `PROJECT_NAME`: Project directory name (kebab-case, e.g., `my-foundry-app`)
- `PROJECT_DESCRIPTION`: Brief description of the application
- `INCLUDE_AGENTS`: Whether to include Azure AI Agents setup (yes/no)
- `INCLUDE_SEARCH`: Whether to include Azure AI Search setup (yes/no)

## Tech Stack

### Frontend
- **Vite + React + TypeScript** with pnpm
- **Fluent UI v9** dark theme design system
- **Framer Motion** for animations
- **Tailwind CSS** for utility styles

### Backend
- **FastAPI** with async/await patterns
- **Pydantic v2** models (Base, Create, Update, Response, InDB)
- **pytest** with TDD approach
- **Ruff** for linting

### Infrastructure
- **Azure Developer CLI (azd)** with `remoteBuild: true`
- **Bicep** templates for Container Apps
- **Managed Identity** for authentication

## Directory Structure

```
${PROJECT_NAME}/
├── azure.yaml                    # azd config
├── .env.example                  # Foundry setup instructions
├── README.md                     # Setup guide
├── .pre-commit-config.yaml
├── .gitignore
├── infra/
│   ├── main.bicep
│   ├── main.parameters.json
│   └── modules/
│       ├── container-apps-environment.bicep
│       └── container-app.bicep
├── src/
│   ├── frontend/
│   │   ├── index.html                # Entry point with mobile meta tags
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   ├── .eslintrc.cjs
│   │   ├── public/
│   │   │   ├── favicon.ico
│   │   │   ├── favicon.svg
│   │   │   ├── apple-touch-icon.png
│   │   │   └── site.webmanifest
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       ├── index.css
│   │       ├── theme/
│   │       │   ├── brand.ts
│   │       │   └── dark-theme.ts
│   │       └── components/
│   │           └── Layout.tsx
│   └── backend/
│       ├── pyproject.toml
│       ├── Dockerfile
│       ├── app/
│       │   ├── __init__.py
│       │   ├── main.py
│       │   ├── config.py
│       │   ├── routers/
│       │   │   ├── __init__.py
│       │   │   └── health.py
│       │   ├── models/
│       │   │   └── __init__.py
│       │   └── services/
│       │       └── __init__.py
│       └── tests/
│           ├── __init__.py
│           └── test_health.py
└── .github/
    └── workflows/
        └── ci.yaml
```

## Steps

### 1. Create Project Root

Create the project directory and root configuration files.

#### azure.yaml
```yaml
name: ${PROJECT_NAME}
metadata:
  template: foundry-fullstack
services:
  frontend:
    project: ./src/frontend
    host: containerapp
    language: ts
    docker:
      path: ./Dockerfile
      remoteBuild: true
  backend:
    project: ./src/backend
    host: containerapp
    language: python
    docker:
      path: ./Dockerfile
      remoteBuild: true
hooks:
  postprovision:
    shell: sh
    run: |
      echo "Setting up RBAC for managed identity..."
      # Add RBAC assignments here
```

#### .env.example
```bash
# ===========================================
# Azure AI Foundry Configuration
# ===========================================
# Get these values from https://ai.azure.com
#
# 1. Go to ai.azure.com and sign in
# 2. Create or select a project
# 3. Go to Project Settings > Overview
# 4. Copy the endpoint URL
# ===========================================

# Required: Your Foundry project endpoint
# Format: https://<resource>.services.ai.azure.com/api/projects/<project>
AZURE_AI_PROJECT_ENDPOINT=

# Required: Model deployment name (e.g., gpt-4o-mini, gpt-4o)
AZURE_AI_MODEL_DEPLOYMENT_NAME=gpt-4o-mini

# ===========================================
# Local Development
# ===========================================
ENVIRONMENT=development
PORT=8000

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

#### .gitignore
```gitignore
# Dependencies
node_modules/
__pycache__/
*.pyc
.venv/
venv/

# Environment
.env
.env.local
.env.*.local

# Build
dist/
build/
*.egg-info/

# IDE
.idea/
.vscode/
*.swp
*.swo

# Azure
.azure/
azd-env/

# Testing
.coverage
htmlcov/
.pytest_cache/

# OS
.DS_Store
Thumbs.db
```

#### .pre-commit-config.yaml
```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.3.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: local
    hooks:
      - id: eslint
        name: eslint
        entry: pnpm --filter frontend lint
        language: system
        files: \.(ts|tsx)$
        pass_filenames: false
```

### 2. Create Frontend

#### src/frontend/package.json
```json
{
  "name": "${PROJECT_NAME}-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "@fluentui/react-components": "^9.54.0",
    "@fluentui/react-icons": "^2.0.245",
    "framer-motion": "^11.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.1.0"
  }
}
```

#### src/frontend/src/theme/brand.ts
```typescript
import type { BrandVariants } from "@fluentui/react-components";

export const brandVariants: BrandVariants = {
  10: "#020305",
  20: "#111723",
  30: "#16263D",
  40: "#193253",
  50: "#1B3F6A",
  60: "#1B4C82",
  70: "#18599B",
  80: "#1267B4",
  90: "#3174C2",
  100: "#4F82C8",
  110: "#6790CF",
  120: "#7D9ED5",
  130: "#92ACDC",
  140: "#A6BBE2",
  150: "#BAC9E9",
  160: "#CDD8EF",
};
```

#### src/frontend/src/theme/dark-theme.ts
```typescript
import { createDarkTheme, type Theme } from "@fluentui/react-components";
import { brandVariants } from "./brand";

const baseDarkTheme = createDarkTheme(brandVariants);

export const darkTheme: Theme = {
  ...baseDarkTheme,
  colorNeutralBackground1: "#0a0a0a",
  colorNeutralBackground2: "#141414",
  colorNeutralBackground3: "#1e1e1e",
  colorNeutralBackground4: "#282828",
  colorNeutralBackground5: "#323232",
  colorNeutralBackground6: "#3c3c3c",
};
```

#### src/frontend/src/main.tsx
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { darkTheme } from "./theme/dark-theme";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FluentProvider theme={darkTheme}>
      <App />
    </FluentProvider>
  </StrictMode>
);
```

#### src/frontend/src/App.tsx
```tsx
import { motion } from "framer-motion";
import { Title1, Text } from "@fluentui/react-components";
import Layout from "./components/Layout";

function App() {
  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center justify-center min-h-[80vh] gap-4"
      >
        <Title1>${PROJECT_NAME}</Title1>
        <Text>${PROJECT_DESCRIPTION}</Text>
      </motion.div>
    </Layout>
  );
}

export default App;
```

#### src/frontend/src/components/Layout.tsx
```tsx
import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--colorNeutralBackground1)] text-[var(--colorNeutralForeground1)]">
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
```

#### src/frontend/src/index.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: dark;
}

body {
  margin: 0;
  min-height: 100vh;
}
```

#### src/frontend/vite.config.ts
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

#### src/frontend/index.html
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    
    <!-- Favicons -->
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    
    <!-- Theme color for mobile browser chrome -->
    <meta name="theme-color" content="#0a0a0a" />
    
    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${PROJECT_NAME}" />
    <meta property="og:description" content="${PROJECT_DESCRIPTION}" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    
    <title>${PROJECT_NAME}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### src/frontend/public/site.webmanifest
```json
{
  "name": "${PROJECT_NAME}",
  "short_name": "${PROJECT_NAME}",
  "icons": [
    { "src": "/favicon.ico", "sizes": "32x32", "type": "image/x-icon" },
    { "src": "/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" }
  ],
  "theme_color": "#0a0a0a",
  "background_color": "#0a0a0a",
  "display": "standalone"
}
```

#### src/frontend/tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Mobile: safe area insets for notched devices
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      // Mobile: minimum touch target sizes (44px per Apple/Google guidelines)
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [],
};
```

#### src/frontend/postcss.config.js
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

#### src/frontend/tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### src/frontend/Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3. Create Backend

#### src/backend/pyproject.toml
```toml
[project]
name = "${PROJECT_NAME}-backend"
version = "0.1.0"
description = "${PROJECT_DESCRIPTION}"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "pydantic>=2.6.0",
    "pydantic-settings>=2.1.0",
    "azure-identity>=1.15.0",
    "azure-ai-projects>=1.0.0b1",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=4.1.0",
    "httpx>=0.27.0",
    "ruff>=0.3.0",
]

[tool.ruff]
target-version = "py311"
line-length = 88

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

#### src/backend/app/main.py
```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title="${PROJECT_NAME}",
    description="${PROJECT_DESCRIPTION}",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
```

#### src/backend/app/config.py
```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "development"
    port: int = 8000
    frontend_url: str = "http://localhost:5173"

    # Azure AI Foundry
    azure_ai_project_endpoint: str = ""
    azure_ai_model_deployment_name: str = "gpt-4o-mini"

    class Config:
        env_file = ".env"


settings = Settings()
```

#### src/backend/app/routers/health.py
```python
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy"}
```

#### src/backend/app/routers/__init__.py
```python
from app.routers import health

__all__ = ["health"]
```

#### src/backend/tests/test_health.py
```python
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
```

#### src/backend/Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml ./
RUN uv pip install --system -e .

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 4. Create Infrastructure

#### infra/main.bicep
```bicep
targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment (e.g., dev, staging, prod)')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

param frontendExists bool = false
param backendExists bool = false

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module containerAppsEnvironment './modules/container-apps-environment.bicep' = {
  name: 'container-apps-environment'
  scope: rg
  params: {
    name: '${abbrs.appManagedEnvironments}${resourceToken}'
    location: location
    tags: tags
  }
}

module frontend './modules/container-app.bicep' = {
  name: 'frontend'
  scope: rg
  params: {
    name: '${abbrs.appContainerApps}frontend-${resourceToken}'
    location: location
    tags: union(tags, { 'azd-service-name': 'frontend' })
    containerAppsEnvironmentName: containerAppsEnvironment.outputs.name
    targetPort: 80
    exists: frontendExists
  }
}

module backend './modules/container-app.bicep' = {
  name: 'backend'
  scope: rg
  params: {
    name: '${abbrs.appContainerApps}backend-${resourceToken}'
    location: location
    tags: union(tags, { 'azd-service-name': 'backend' })
    containerAppsEnvironmentName: containerAppsEnvironment.outputs.name
    targetPort: 8000
    exists: backendExists
    env: [
      { name: 'ENVIRONMENT', value: environmentName }
      { name: 'FRONTEND_URL', value: 'https://${frontend.outputs.fqdn}' }
    ]
  }
}

output AZURE_LOCATION string = location
output FRONTEND_URL string = 'https://${frontend.outputs.fqdn}'
output BACKEND_URL string = 'https://${backend.outputs.fqdn}'
```

#### infra/main.parameters.json
```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environmentName": {
      "value": "${AZURE_ENV_NAME}"
    },
    "location": {
      "value": "${AZURE_LOCATION}"
    }
  }
}
```

#### infra/modules/container-apps-environment.bicep
```bicep
param name string
param location string = resourceGroup().location
param tags object = {}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${name}-logs'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

output name string = containerAppsEnvironment.name
output id string = containerAppsEnvironment.id
```

#### infra/modules/container-app.bicep
```bicep
param name string
param location string = resourceGroup().location
param tags object = {}

param containerAppsEnvironmentName string
param targetPort int = 80
param exists bool = false
param env array = []

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' existing = {
  name: containerAppsEnvironmentName
}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
      }
    }
    template: {
      containers: [
        {
          name: 'main'
          image: exists ? 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest' : 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: env
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
      }
    }
  }
}

output fqdn string = containerApp.properties.configuration.ingress.fqdn
output name string = containerApp.name
output id string = containerApp.id
output identityPrincipalId string = containerApp.identity.principalId
```

### 5. Create CI/CD

#### .github/workflows/ci.yaml
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: src/frontend
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
      - uses: pnpm/action-setup@a3252b78c470c02df07e9d59298aecedc3ccdd6d # v3.0.0
        with:
          version: 9
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 20
          cache: pnpm
          cache-dependency-path: src/frontend/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm build

  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: src/backend
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
      - uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5.6.0
        with:
          python-version: "3.11"
      - run: pip install uv
      - run: uv pip install --system -e ".[dev]"
      - run: ruff check .
      - run: ruff format --check .
      - run: pytest --cov=app tests/
```

### 6. Create README

#### README.md
```markdown
# ${PROJECT_NAME}

${PROJECT_DESCRIPTION}

## Prerequisites

- [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli) (v2.50+)
- [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd) (v1.5+)
- [Node.js](https://nodejs.org/) (v20+) with pnpm
- [Python](https://python.org/) (v3.11+) with uv
- An Azure subscription with access to [Azure AI Foundry](https://ai.azure.com)

## Quick Start

### 1. Clone and Configure

\`\`\`bash
# Copy environment template
cp .env.example .env

# Edit .env with your Foundry project endpoint
# Get this from https://ai.azure.com > Project Settings
\`\`\`

### 2. Local Development

\`\`\`bash
# Backend
cd src/backend
uv sync
uv run fastapi dev app/main.py

# Frontend (new terminal)
cd src/frontend
pnpm install
pnpm dev
\`\`\`

Open http://localhost:5173

### 3. Deploy to Azure

\`\`\`bash
# Login
az login
azd auth login

# Deploy
azd up
\`\`\`

## Project Structure

\`\`\`
├── azure.yaml              # azd configuration
├── infra/                  # Bicep infrastructure
├── src/
│   ├── frontend/           # React + Fluent UI + Vite
│   └── backend/            # FastAPI + Pydantic
└── .github/workflows/      # CI/CD
\`\`\`

## Development

### Backend

\`\`\`bash
cd src/backend
uv run pytest                    # Run tests
uv run ruff check . --fix        # Lint
uv run ruff format .             # Format
\`\`\`

### Frontend

\`\`\`bash
cd src/frontend
pnpm lint                        # Lint
pnpm build                       # Build
\`\`\`

## Deployment

\`\`\`bash
azd up        # Full deployment
azd deploy    # Deploy app changes only
azd down      # Tear down resources
\`\`\`

## Skills Used

This project was scaffolded using these agent skills:
- `frontend-ui-dark-ts` - Dark theme UI with Tailwind CSS + Framer Motion
- `fastapi-router-py` - FastAPI router patterns
- `pydantic-models-py` - Pydantic model patterns
\`\`\`

## Checklist

- [ ] Project root created with azure.yaml, .env.example, .gitignore
- [ ] Frontend scaffolded with Vite, React, Fluent UI, Tailwind, Framer Motion
- [ ] Backend scaffolded with FastAPI, Pydantic, pytest
- [ ] Infrastructure created with Bicep for Container Apps
- [ ] CI/CD workflow created
- [ ] README with setup instructions
- [ ] Run `pnpm install` in frontend
- [ ] Run `uv sync` in backend
- [ ] Verify `pnpm dev` and `fastapi dev` work locally
