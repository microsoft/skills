# Azure Playwright Workspaces SDK Acceptance Criteria (TypeScript)

**SDK**: `@azure/playwright`
**Repository**: https://github.com/Azure/playwright-workspaces
**Purpose**: Skill testing acceptance criteria for validating generated code correctness

---

## 1. Correct Import Patterns

### 1.1 Service Configuration Imports

#### ✅ CORRECT: Core Imports (New Package)
```typescript
import { defineConfig } from "@playwright/test";
import { createAzurePlaywrightConfig, ServiceOS } from "@azure/playwright";
import { DefaultAzureCredential } from "@azure/identity";
```

#### ✅ CORRECT: Connect Options Import
```typescript
import { getConnectOptions } from "@azure/playwright";
```

#### ✅ CORRECT: With ServiceAuth Import
```typescript
import { createAzurePlaywrightConfig, ServiceOS, ServiceAuth } from "@azure/playwright";
```

#### ✅ CORRECT: Custom Credential Import
```typescript
import { ManagedIdentityCredential, AzureCliCredential } from "@azure/identity";
import { createAzurePlaywrightConfig } from "@azure/playwright";
```

### 1.2 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Old deprecated package
```typescript
// WRONG - old package is deprecated (retiring March 8, 2026)
import { getServiceConfig } from "@azure/microsoft-playwright-testing";
import { ServiceOS } from "@azure/microsoft-playwright-testing";
```

#### ❌ INCORRECT: Old function name
```typescript
// WRONG - getServiceConfig is from old package
import { getServiceConfig } from "@azure/playwright";
```

#### ❌ INCORRECT: Wrong package names
```typescript
// WRONG - incorrect package names
import { createAzurePlaywrightConfig } from "azure-playwright";
import { createAzurePlaywrightConfig } from "@azure/playwright-testing";
```

---

## 2. Service Configuration Patterns

### 2.1 ✅ CORRECT: Basic Service Config
```typescript
import { defineConfig } from "@playwright/test";
import { createAzurePlaywrightConfig, ServiceOS } from "@azure/playwright";
import { DefaultAzureCredential } from "@azure/identity";
import config from "./playwright.config";

export default defineConfig(
  config,
  createAzurePlaywrightConfig(config, {
    os: ServiceOS.LINUX,
    credential: new DefaultAzureCredential(),
  })
);
```

### 2.2 ✅ CORRECT: Full Configuration Options
```typescript
import { defineConfig } from "@playwright/test";
import { createAzurePlaywrightConfig, ServiceOS } from "@azure/playwright";
import { DefaultAzureCredential } from "@azure/identity";
import config from "./playwright.config";

export default defineConfig(
  config,
  createAzurePlaywrightConfig(config, {
    os: ServiceOS.LINUX,
    connectTimeout: 30000,
    exposeNetwork: "<loopback>",
    runName: "my-test-run",
    credential: new DefaultAzureCredential(),
  }),
  {
    reporter: [
      ["html", { open: "never" }],
      ["@azure/playwright/reporter"],
    ],
  }
);
```

### 2.3 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Using old getServiceConfig function
```typescript
// WRONG - getServiceConfig is from deprecated package
export default defineConfig(
  config,
  getServiceConfig(config, { os: ServiceOS.LINUX })
);
```

#### ❌ INCORRECT: Using old timeout option (renamed to connectTimeout)
```typescript
// WRONG - "timeout" was renamed to "connectTimeout"
createAzurePlaywrightConfig(config, {
  timeout: 30000,  // Use connectTimeout instead
})
```

#### ❌ INCORRECT: Using removed useCloudHostedBrowsers option
```typescript
// WRONG - useCloudHostedBrowsers was removed (always enabled now)
createAzurePlaywrightConfig(config, {
  useCloudHostedBrowsers: true,
})
```

#### ❌ INCORRECT: Missing defineConfig wrapper
```typescript
// WRONG - must use defineConfig
const config = createAzurePlaywrightConfig(baseConfig, { os: ServiceOS.LINUX });
export default config;
```

---

## 3. Authentication Patterns

### 3.1 ✅ CORRECT: Explicit DefaultAzureCredential
```typescript
import { DefaultAzureCredential } from "@azure/identity";
import { createAzurePlaywrightConfig } from "@azure/playwright";

export default defineConfig(
  config,
  createAzurePlaywrightConfig(config, {
    credential: new DefaultAzureCredential(),
  })
);
```

### 3.2 ✅ CORRECT: Custom Credential
```typescript
import { ManagedIdentityCredential } from "@azure/identity";
import { createAzurePlaywrightConfig } from "@azure/playwright";

export default defineConfig(
  config,
  createAzurePlaywrightConfig(config, {
    credential: new ManagedIdentityCredential(),
  })
);
```

### 3.3 ✅ CORRECT: AzureCliCredential for local dev
```typescript
import { AzureCliCredential } from "@azure/identity";
import { createAzurePlaywrightConfig } from "@azure/playwright";

export default defineConfig(
  config,
  createAzurePlaywrightConfig(config, {
    credential: new AzureCliCredential(),
  })
);
```

### 3.4 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Using old serviceAuthType option
```typescript
// WRONG - serviceAuthType is from deprecated package, use credential instead
serviceAuthType: ServiceAuth.ACCESS_TOKEN,
serviceAuthType: "ACCESS_TOKEN",
```

#### ❌ INCORRECT: Hardcoded access token
```typescript
// WRONG - never hardcode tokens, use credential with DefaultAzureCredential
accessToken: "hardcoded-token-12345",
accessToken: "my-secret-token",
```

---

## 4. Reporter Configuration Patterns

### 4.1 ✅ CORRECT: With Azure Reporter
```typescript
export default defineConfig(
  config,
  createAzurePlaywrightConfig(config, {
    credential: new DefaultAzureCredential(),
  }),
  {
    reporter: [
      ["html", { open: "never" }],
      ["@azure/playwright/reporter"],
    ],
  }
);
```

### 4.2 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Old reporter path
```typescript
// WRONG - old reporter path from deprecated package
reporter: [["@azure/microsoft-playwright-testing/reporter"]]
```

---

## 5. Manual Browser Connection Patterns

### 5.1 ✅ CORRECT: Manual Connection
```typescript
import playwright, { test, expect, BrowserType } from "@playwright/test";
import { getConnectOptions } from "@azure/playwright";

test("manual connection", async ({ browserName }) => {
  const { wsEndpoint, options } = await getConnectOptions();
  const browser = await (playwright[browserName] as BrowserType).connect(wsEndpoint, options);
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://example.com");
  await expect(page).toHaveTitle(/Example/);

  await browser.close();
});
```

### 5.2 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Old package import for getConnectOptions
```typescript
// WRONG - use @azure/playwright instead of deprecated package
import { getConnectOptions } from "@azure/microsoft-playwright-testing";
```

**Note:** Manual connections MUST call `browser.close()` to release cloud resources.

---

## 6. Environment Variables

### 6.1 ✅ CORRECT: Required Variables
```typescript
// PLAYWRIGHT_SERVICE_URL is required
// New format: wss://eastus.api.playwright.microsoft.com/playwrightworkspaces/{workspace-id}/browsers
```

### 6.2 ❌ INCORRECT: Old URL format
```typescript
// WRONG - old URL format with /accounts/
const wsEndpoint = "wss://eastus.api.playwright.microsoft.com/accounts/12345/browsers";
// CORRECT format uses /playwrightworkspaces/
```

### 6.3 ❌ INCORRECT: Hardcoded service URL
```typescript
// WRONG - should use environment variable
const wsEndpoint = "wss://eastus.api.playwright.microsoft.com/playwrightworkspaces/12345/browsers";
```

---

## 7. CI/CD Integration Patterns

### 7.1 ✅ CORRECT: GitHub Actions Workflow
```yaml
name: playwright-ts
on: [push, pull_request]

permissions:
  id-token: write
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0

      - name: Azure Login
        uses: azure/login@7184910d9eb2b1c5e48f7073824a90609bb9b6d6 # v2.3.1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - run: npm ci
      
      - name: Run Tests
        env:
          PLAYWRIGHT_SERVICE_URL: ${{ secrets.PLAYWRIGHT_SERVICE_URL }}
        run: npx playwright test -c playwright.service.config.ts --workers=20
```

### 7.2 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Missing Azure login
```yaml
# WRONG - missing Azure authentication step
jobs:
  test:
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
      - run: npm ci
      - run: npx playwright test -c playwright.service.config.ts
```

---

## 8. Running Tests

### 8.1 ✅ CORRECT: Run with Service Config
```bash
npx playwright test --config=playwright.service.config.ts --workers=20
```

### 8.2 ✅ CORRECT: Run with Specific Workers
```bash
npx playwright test -c playwright.service.config.ts --workers=20
```

### 8.3 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Using default config for cloud testing
```bash
# WRONG - must use service config for cloud browsers
npx playwright test
```

---

## 9. Migration Patterns

### 9.1 ✅ CORRECT: Migrated Configuration

**Before (Old - Deprecated):**
```typescript
import { getServiceConfig, ServiceOS } from "@azure/microsoft-playwright-testing";

export default defineConfig(
  config,
  getServiceConfig(config, {
    os: ServiceOS.LINUX,
    timeout: 30000,
    useCloudHostedBrowsers: true,
  }),
  {
    reporter: [["@azure/microsoft-playwright-testing/reporter"]],
  }
);
```

**After (New - Correct):**
```typescript
import { createAzurePlaywrightConfig, ServiceOS } from "@azure/playwright";
import { DefaultAzureCredential } from "@azure/identity";

export default defineConfig(
  config,
  createAzurePlaywrightConfig(config, {
    os: ServiceOS.LINUX,
    connectTimeout: 30000,
    credential: new DefaultAzureCredential(),
  }),
  {
    reporter: [
      ["html", { open: "never" }],
      ["@azure/playwright/reporter"],
    ],
  }
);
```

### 9.2 Key Migration Changes

| Old (Deprecated) | New (Correct) |
|------------------|---------------|
| `@azure/microsoft-playwright-testing` | `@azure/playwright` |
| `getServiceConfig()` | `createAzurePlaywrightConfig()` |
| `timeout` | `connectTimeout` |
| `runId` | `runName` |
| `useCloudHostedBrowsers` | Removed (always enabled) |
| Implicit credential | Explicit `credential` parameter |
| `@azure/microsoft-playwright-testing/reporter` | `@azure/playwright/reporter` |
