# DevTunnels Setup for MCP Servers

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
  - [`.env.local` File Structure](#envlocal-file-structure)
- [Automated Setup Script (Named Tunnel)](#automated-setup-script-named-tunnel)
  - [`scripts/setup-devtunnel.sh`](#scriptssetup-devtunnelsh)
  - [`scripts/setup-devtunnel.ps1` (Windows)](#scriptssetup-devtunnelps1-windows)
- [package.json Scripts](#packagejson-scripts)
  - [Root package.json](#root-packagejson)
  - [mcp-server/package.json](#mcp-serverpackagejson)
- [MCP Server Environment Integration](#mcp-server-environment-integration)
  - [Load Environment Variables](#load-environment-variables)
  - [Use Environment for CSP](#use-environment-for-csp)
  - [Add dotenv Dependency](#add-dotenv-dependency)
- [Development Workflow](#development-workflow)
  - [Terminal 1: Start MCP Server](#terminal-1-start-mcp-server)
  - [Terminal 2: Start DevTunnel](#terminal-2-start-devtunnel)
  - [After First-Time Setup](#after-first-time-setup)
- [Why Named Tunnels?](#why-named-tunnels)
- [Troubleshooting](#troubleshooting)

Automated setup for exposing localhost MCP servers via Azure DevTunnels using **named tunnels** for stable URLs.

## Prerequisites

- [Azure DevTunnels CLI](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started) installed
- Node.js installed
- MCP server running on localhost (default port: 3001)
- **First-time setup**: `devtunnel user login -g -d` (GitHub auth with device code). Azure AD device code auth (`devtunnel user login -d`) is blocked by tenant Conditional Access policy on managed devices — use GitHub auth as the default.

## Environment Configuration

### `.env.local` File Structure

Add these variables to `env/.env.local`:

```bash
# DevTunnel configuration
DEVTUNNEL_PORT=3001
DEVTUNNEL_NAME=my-mcp-agent

# Auto-populated by devtunnel setup script (run npm run tunnel):
MCP_SERVER_URL=
MCP_SERVER_DOMAIN=
```

## Automated Setup Script (Named Tunnel)

Uses **named tunnels** so the URL stays the same across restarts. The script creates the tunnel on first run and reuses it on subsequent runs — no need to update `.env.local` or re-provision the agent after a tunnel restart.

### `scripts/setup-devtunnel.sh`

```bash
#!/bin/bash
set -e

ENV_FILE="env/.env.local"
PORT="${DEVTUNNEL_PORT:-3001}"
TUNNEL_NAME="${DEVTUNNEL_NAME:-mcp-agent}"

# Auto-login check: ensure devtunnel is authenticated
if ! devtunnel user show &>/dev/null; then
  echo "DevTunnel not logged in. Authenticating via GitHub..."
  devtunnel user login -g -d
fi

# Create named tunnel if it doesn't exist
if ! devtunnel show "$TUNNEL_NAME" &>/dev/null; then
  echo "Creating named tunnel '$TUNNEL_NAME'..."
  devtunnel create -a "$TUNNEL_NAME"
  devtunnel port create "$TUNNEL_NAME" -p "$PORT"
  echo "Named tunnel '$TUNNEL_NAME' created on port $PORT."
else
  echo "Reusing existing tunnel '$TUNNEL_NAME'."
fi

echo "Starting DevTunnel '$TUNNEL_NAME'..."
echo ""

# Host the named tunnel and capture output
devtunnel host "$TUNNEL_NAME" 2>&1 | while IFS= read -r line; do
  echo "$line"

  # Extract URL when it appears (only updates .env.local on first run or URL change)
  if [[ "$line" =~ (https://[a-zA-Z0-9.-]+\.devtunnels\.ms[^ ]*) ]]; then
    TUNNEL_URL="${BASH_REMATCH[1]}"
    TUNNEL_DOMAIN=$(echo "$TUNNEL_URL" | sed -E 's|https?://||' | sed 's|/.*||')

    # Check if .env.local already has the correct URL
    CURRENT_URL=$(grep "^MCP_SERVER_URL=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2-)
    if [ "$CURRENT_URL" = "$TUNNEL_URL" ]; then
      echo ""
      echo "Environment already configured (URL unchanged):"
      echo "   MCP_SERVER_URL=$TUNNEL_URL"
      echo "   MCP_SERVER_DOMAIN=$TUNNEL_DOMAIN"
      echo ""
    else
      echo ""
      echo "Updating $ENV_FILE..."

      # Update MCP_SERVER_URL
      if grep -q "^MCP_SERVER_URL=" "$ENV_FILE"; then
        sed -i "s|^MCP_SERVER_URL=.*|MCP_SERVER_URL=$TUNNEL_URL|" "$ENV_FILE"
      else
        echo "MCP_SERVER_URL=$TUNNEL_URL" >> "$ENV_FILE"
      fi

      # Update MCP_SERVER_DOMAIN
      if grep -q "^MCP_SERVER_DOMAIN=" "$ENV_FILE"; then
        sed -i "s|^MCP_SERVER_DOMAIN=.*|MCP_SERVER_DOMAIN=$TUNNEL_DOMAIN|" "$ENV_FILE"
      else
        echo "MCP_SERVER_DOMAIN=$TUNNEL_DOMAIN" >> "$ENV_FILE"
      fi

      echo ""
      echo "Environment configured:"
      echo "   MCP_SERVER_URL=$TUNNEL_URL"
      echo "   MCP_SERVER_DOMAIN=$TUNNEL_DOMAIN"
      echo ""
      echo "NOTE: First-time setup — run 'npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local' to deploy the agent."
      echo ""
    fi
  fi
done
```

### `scripts/setup-devtunnel.ps1` (Windows)

```powershell
$envFile = "env\.env.local"
$port = if ($env:DEVTUNNEL_PORT) { $env:DEVTUNNEL_PORT } else { "3001" }
$tunnelName = if ($env:DEVTUNNEL_NAME) { $env:DEVTUNNEL_NAME } else { "mcp-agent" }

# Auto-login check: ensure devtunnel is authenticated
try {
    devtunnel user show 2>&1 | Out-Null
} catch {
    Write-Host "DevTunnel not logged in. Authenticating via GitHub..."
    devtunnel user login -g -d
}

# Create named tunnel if it doesn't exist
$tunnelExists = $false
try {
    devtunnel show $tunnelName 2>&1 | Out-Null
    $tunnelExists = $true
    Write-Host "Reusing existing tunnel '$tunnelName'."
} catch {
    Write-Host "Creating named tunnel '$tunnelName'..."
    devtunnel create -a $tunnelName
    devtunnel port create $tunnelName -p $port
    Write-Host "Named tunnel '$tunnelName' created on port $port."
}

Write-Host "Starting DevTunnel '$tunnelName'..."
Write-Host ""

# Host the named tunnel and process output
devtunnel host $tunnelName 2>&1 | ForEach-Object {
    Write-Host $_

    # Extract URL when it appears
    if ($_ -match "(https://[a-zA-Z0-9.-]+\.devtunnels\.ms[^ ]*)") {
        $tunnelUrl = $Matches[1]
        $tunnelDomain = $tunnelUrl -replace "https?://", "" -replace "/.*", ""

        # Check if .env.local already has the correct URL
        $content = Get-Content $envFile -ErrorAction SilentlyContinue
        $currentUrl = ($content | Where-Object { $_ -match "^MCP_SERVER_URL=" }) -replace "^MCP_SERVER_URL=", ""

        if ($currentUrl -eq $tunnelUrl) {
            Write-Host ""
            Write-Host "Environment already configured (URL unchanged):"
            Write-Host "   MCP_SERVER_URL=$tunnelUrl"
            Write-Host "   MCP_SERVER_DOMAIN=$tunnelDomain"
            Write-Host ""
        } else {
            Write-Host ""
            Write-Host "Updating $envFile..."

            $content = $content -replace "^MCP_SERVER_URL=.*", "MCP_SERVER_URL=$tunnelUrl"
            $content = $content -replace "^MCP_SERVER_DOMAIN=.*", "MCP_SERVER_DOMAIN=$tunnelDomain"
            $content | Out-File -FilePath $envFile -Encoding UTF8

            Write-Host ""
            Write-Host "Environment configured:"
            Write-Host "   MCP_SERVER_URL=$tunnelUrl"
            Write-Host "   MCP_SERVER_DOMAIN=$tunnelDomain"
            Write-Host ""
            Write-Host "NOTE: First-time setup - run 'npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local' to deploy the agent."
            Write-Host ""
        }
    }
}
```

## package.json Scripts

### Root package.json

```json
{
  "scripts": {
    "tunnel": "bash scripts/setup-devtunnel.sh",
    "tunnel:win": "powershell scripts/setup-devtunnel.ps1",
    "dev:server": "cd mcp-server && npm run dev",
    "install:server": "cd mcp-server && npm install"
  }
}
```

### mcp-server/package.json

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "tunnel": "bash ../scripts/setup-devtunnel.sh",
    "tunnel:win": "powershell ../scripts/setup-devtunnel.ps1"
  }
}
```

## MCP Server Environment Integration

### Load Environment Variables

```typescript
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local from project root
config({ path: path.resolve(__dirname, "../../env/.env.local") });

const port = Number(process.env.DEVTUNNEL_PORT ?? process.env.PORT ?? 3001);
const serverUrl = process.env.MCP_SERVER_URL ?? `http://localhost:${port}`;
const serverDomain = process.env.MCP_SERVER_DOMAIN ?? "localhost";

console.log(`Server URL: ${serverUrl}`);
console.log(`Server Domain: ${serverDomain}`);
```

### Use Environment for CSP

```typescript
// Resource metadata with dynamic CSP from environment
function resourceMeta() {
  const domain = process.env.MCP_SERVER_DOMAIN ?? "localhost";
  const url = process.env.MCP_SERVER_URL ?? `http://localhost:${port}`;

  return {
    "openai/widgetDomain": url,
    "openai/widgetCSP": {
      connect_domains: [url, `https://${domain}`],
      resource_domains: [url, `https://${domain}`],
    },
  };
}

// Tool metadata with dynamic widget URL
function toolMeta(widgetPath: string) {
  return {
    "openai/outputTemplate": `ui://widget/${widgetPath}`,
    "openai/widgetAccessible": true,
  };
}
```

### Add dotenv Dependency

```bash
npm install dotenv
```

## Development Workflow

### Terminal 1: Start MCP Server

```bash
cd mcp-server
npm install
npm run dev
```

### Terminal 2: Start DevTunnel

```bash
# From project root
npm run tunnel
# Or on Windows:
npm run tunnel:win
```

The script will:
1. Create a named tunnel (first run only) or reuse the existing one
2. Start hosting the tunnel on the configured port
3. Update `env/.env.local` with `MCP_SERVER_URL` and `MCP_SERVER_DOMAIN` (first run only — URL is stable)
4. Continue hosting the tunnel

### After First-Time Setup

On the **first run**, deploy the agent once:

```bash
npx -y --package @microsoft/m365agentstoolkit-cli atk provision --env local
```

On **subsequent runs**, the tunnel URL is the same — just restart the tunnel and MCP server. No re-provisioning needed unless you change the agent manifest (mcpPlugin.json, declarativeAgent.json, etc.).

## Why Named Tunnels?

Random tunnels (`devtunnel host -p 3001`) generate a new URL every time. This creates a cascading update problem:

1. New tunnel → new URL
2. `.env.local` must be updated → MCP server must restart (new CSP headers)
3. Agent manifest has old URL → must re-provision with `npx -y --package @microsoft/m365agentstoolkit-cli atk provision`

With named tunnels, the URL is **stable across restarts**. Create once, reuse forever:

```bash
# One-time setup (handled by the script automatically):
devtunnel create -a my-mcp-agent
devtunnel port create my-mcp-agent -p 3001

# Every time you develop (URL stays the same):
devtunnel host my-mcp-agent
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `devtunnel: command not found` | Install Azure DevTunnels CLI |
| CSP errors in Copilot | Verify `MCP_SERVER_DOMAIN` matches tunnel domain in `.env.local` |
| Server not accessible through tunnel | Ensure MCP server is running before starting tunnel |
| Permission denied on script | Run `chmod +x scripts/setup-devtunnel.sh` |
| Agent not updated after manifest change | Bump version in manifest.json and redeploy with `npx -y --package @microsoft/m365agentstoolkit-cli atk provision` |
| `EADDRINUSE` port conflict | Previous server instance still running. Windows: `taskkill //PID <pid> //F`. Linux/Mac: `lsof -ti:<port> \| xargs kill -9` |
| DevTunnel login fails with CA policy error | Tenant Conditional Access blocks device code auth on managed devices. Use GitHub auth: `devtunnel user login -g -d` |
| Named tunnel already exists with wrong config | Delete and recreate: `devtunnel delete <name>` then re-run the setup script |
| Tunnel process dies between sessions | Use `detach: true` when running via agent, or `Start-Process -WindowStyle Hidden` on Windows. The URL remains stable — just restart the tunnel |
