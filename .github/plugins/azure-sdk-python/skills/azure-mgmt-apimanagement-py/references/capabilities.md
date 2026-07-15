# azure-mgmt-apimanagement-py capability coverage

**SDK/package**: `azure-mgmt-apimanagement`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Create APIM Service`
- `Import API from OpenAPI`
- `Import API from URL`
- `List APIs`

## Non-hero scenarios

- `Create Product`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#create-product`](non-hero-scenarios.md#create-product)
- `Add API to Product`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#add-api-to-product`](non-hero-scenarios.md#add-api-to-product)
- `Create Subscription`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#create-subscription`](non-hero-scenarios.md#create-subscription)
- `Set API Policy`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#set-api-policy`](non-hero-scenarios.md#set-api-policy)
- `Create Named Value (Secret)`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#create-named-value-secret`](non-hero-scenarios.md#create-named-value-secret)
- `Create Backend`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#create-backend`](non-hero-scenarios.md#create-backend)
- `Create User`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#create-user`](non-hero-scenarios.md#create-user)
- `Operation Groups`: | Group | Purpose |  
  See: [`non-hero-scenarios.md#operation-groups`](non-hero-scenarios.md#operation-groups)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
