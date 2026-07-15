# azure-identity-py capability coverage

**SDK/package**: `azure-identity`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `get_bearer_token_provider`
- `Credential Types`
- `Specific Credential Examples`
- `Getting Tokens Directly`

## Non-hero scenarios

- `Async Credentials`: Async credentials are in `azure.identity.aio`. Always close them or use `async with`:  
  See: [`non-hero-scenarios.md#async-credentials`](non-hero-scenarios.md#async-credentials)
- `Sovereign Clouds`: Use `AzureAuthorityHosts` or the `AZURE_AUTHORITY_HOST` env var:  
  See: [`non-hero-scenarios.md#sovereign-clouds`](non-hero-scenarios.md#sovereign-clouds)
- `Persistent Token Caching`: Opt-in disk-based caching with `TokenCachePersistenceOptions`:  
  See: [`non-hero-scenarios.md#persistent-token-caching`](non-hero-scenarios.md#persistent-token-caching)
- `Multi-Tenant Support`: Allow token acquisition for additional tenants beyond the configured one:  
  See: [`non-hero-scenarios.md#multi-tenant-support`](non-hero-scenarios.md#multi-tenant-support)
- `Error Handling`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#error-handling`](non-hero-scenarios.md#error-handling)
- `Logging`: Enable authentication logging for debugging:  
  See: [`non-hero-scenarios.md#logging`](non-hero-scenarios.md#logging)
- `Credential Selection Matrix`: | Environment | Recommended Credential |  
  See: [`non-hero-scenarios.md#credential-selection-matrix`](non-hero-scenarios.md#credential-selection-matrix)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
