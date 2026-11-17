# Documented Copilot CLI Azure tool setup

Sources reviewed November 5, 2026. Documentation establishes a setup route,
not a tested installation for this plugin. Verify the actual CLI version and
organization policy. Do not copy VS Code configuration into CLI.

## Reuse before adding

Check the host's available tool descriptions and enabled servers. Reuse an
authorized Azure integration that supplies the required metadata and telemetry
operations. A visible router needs actual schema discovery when permitted.
Denied source access needs access review, not another installation.

## Offer setup and request approval

Read [GitHub's CLI MCP setup guide](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers)
and Microsoft's [Azure MCP setup reference](https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/get-started/tools/visual-studio-code)
before proposing a command. The latter publishes the local server launch as
`npx -y @azure/mcp@latest server start`; its VS Code JSON is not CLI JSON.
Review the current publisher requirements, including an available compatible
Node.js/npm runtime for that route. Do not install dependencies implicitly.

Explain that adding/starting this local server can download and execute code,
persists configuration, and exposes Azure operations. Obtain approval for the
selected server definition and destination; existing entries must be preserved.
The published `latest` launch is not a reproducible version pin: record the
resolved Azure MCP version for the test and review updates before retesting.

If the host exposes a supported configuration operation, use its actual schema
after approval. Otherwise guide the developer through `/mcp add`: select a local
stdio server and use the published Azure server launch. Review tool exposure
for the approved task; do not instruct blanket tool/action auto-approval.
Do not execute the interactive slash command as a shell command.

Use the current GitHub guide for the actual CLI configuration location and
format. Do not create configuration by guessing a filename. Server startup and
authentication remain applicable approval gates. Reuse the supported Azure
identity without reading credential files; sign-in behavior depends on the
server/version and must not be promised universally.

## Verify and resume

Check actual tool availability after setup; preserve confirmed scope if a fresh
session is needed. Inspect required schemas only when permitted, then separately
approve a bounded source read. Setup success does not prove authorization,
telemetry linkage, freshness or health.

If setup is denied, fails or is policy-blocked, report the specific outcome.
Offer permitted supplied-evidence analysis without claiming live access.
Never switch identity, grant roles or use another installer to evade a denial.
Record CLI/server versions and actual operations separately from VS Code results.
