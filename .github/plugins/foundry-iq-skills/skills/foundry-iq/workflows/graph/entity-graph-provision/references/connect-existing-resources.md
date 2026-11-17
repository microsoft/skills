# Connect existing resources

## Quick starts

- "Check whether my existing Search, Storage, and OpenAI resources are ready for Entity Graph."
- "Connect Entity Graph to the resources in resource group `<rg>`."

## Use this path

Use this path when the user already has a Search service, a Storage account, and an Azure OpenAI or Foundry account.
Run commands through the [runtime setup](../../graph-guide/references/install-and-checks.md#plugin-and-clis) launcher.

## Flow

1. Confirm the tenant and subscription (`az account show --query "{subscription:name, id:id, tenant:tenantId}" -o json`). Ask by name: "You're signed in to **<subscription>**. Use it for the models? (yes / pick another)". Tier 1 runs only if the user wants another subscription: `entity-graph-provision discover --tenant-id <tenant>` lists every subscription you can see; ask for one by name. Tier 2: `discover --tenant-id <tenant> --subscription-id <sub>` (or the `--sub-row <S> --discovery-id <id>` command tier 1 prints) lists usable chat and embedding deployments by model and region; `--all` adds every `OpenAI` and `AIServices` account. Show its table verbatim and ask which model to use for embedding, chat/extraction and, if different, KB answers, by name; never refer to row numbers. Never pick or guess a subscription or row for the user.
2. For each chosen model run `discover --tenant-id <tenant> --subscription-id <sub> --row <N> --discovery-id <id> --role <embedding|chat|kb>` and use the `args.entity` flags it prints. To create a new deployment instead, run `discover --models-for <account-id> --role <role>` and pass the user's choice as `--<role>-model`, `--<role>-model-version`, `--<role>-sku` and, for a non-TPM SKU, `--<role>-capacity`. If the corpus has PDFs, Office files or images, tier 2 also lists `content_understanding.candidates`: `AIServices` accounts whose endpoint is `https://<subdomain>.services.ai.azure.com`. Show them by name and ask which to use; never pick one, even when only one is listed. Use the chosen entry's `args.connect` flag. If the user gives an endpoint instead, pass `--content-understanding-endpoint <url>`; it wins over the account.
3. Run connect with Search and Storage names or IDs, a dedicated `StorageV2` cache account, the `args.entity` flags (`--embedding-openai-resource-id`, `--chat-openai-resource-id`, `--kb-openai-resource-id` and their deployments) and, if chosen, the Content Understanding flag (`--content-understanding-resource-id`, or `--content-understanding-name` for an account in `--resource-group`). Connect reads that account once and blocks if it isn't `AIServices` or has no custom subdomain. Search uses its system-assigned identity (`--use-system-identity`); pass `--search-identity-resource-id <id>` only if the user opts in to a user-assigned identity. For Search in another subscription or resource group, add `--search-subscription-id` and `--search-resource-group`, or `--search-resource-id`. Add `--documents <n>` for a throttle estimate:

   ```bash
   entity-graph-provision connect --tenant-id <tenant> --subscription-id <sub> --resource-group <rg> --search-name <search> --storage-name <storage> --cache-storage-name <cache> --storage-container <container> <args.entity flags> --json
   ```
4. `incomplete` lists missing inputs. Without a cache flag it lists `candidates.cache_storage`: ask the user to choose and re-run with `--cache-storage-name`; never fall back to the source account. `blocked` lists failed checks (Free tier, key-only auth, public container).
5. Review `capacity` and `roles`. A role held through a group counts and is never re-granted. If group membership couldn't be read, say so; don't propose a grant yourself.
6. `needs_setup` returns one `setup_plan` for a missing Search identity, container, deployment or roles. Show its `approval_card` verbatim and ask one Approve/Stop question; never ask the user to type an ID. Then run `entity-graph-provision connect-apply` with the same flags plus `--plan-id <id> --confirm-writes`. It refuses on drift and never retries.
7. `ready` saves the `entity-graph-build` target flags to the file it prints as `build_args_file`, including `--content-understanding-endpoint` when one was bound; later commands take `--build-args <file>`.

Connect doesn't prove service-to-service access; build verifies it. Never copy data or change the user's sources.

In the graph demo, Act 2 (Documents) continues with that `build_args_file`.

## Return

State the connect status, failed checks, and the one safe next action.
