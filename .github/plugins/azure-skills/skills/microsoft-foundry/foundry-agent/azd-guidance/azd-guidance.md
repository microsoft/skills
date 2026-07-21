# Foundry azd Guidance

Read this skill before running any Foundry agent workflow that uses azd. Also use it for direct questions about Foundry-specific azd commands.

## Shared Rules

1. Always set `AZURE_DEV_USER_AGENT=microsoft_foundry_skill` when running azd commands, for example:

   ```bash
   AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd ai agent init
   AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd ai agent run --no-client
   AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd provision
   AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd deploy
   AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd ai agent invoke
   ```

Set it inline only (as shown above). Never persist it into code or committed config (for example, `azd env set`, `.env`, or `azure.yaml`). It is a local-development-only setting.

2. If an azd command or flag is unclear, run the relevant `azd ... --help` command and follow its output.
3. Unless the user explicitly asks to open a client, run `azd ai agent run --no-client`.
4. If the needed azd guidance is not covered here or remains unclear, read [azd ai CLI Reference](references/azd-ai-cli.md).
