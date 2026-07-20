# azure-mgmt-apicenter-py capability coverage

**SDK/package**: `azure-mgmt-apicenter`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Create API Center`
- `List API Centers`
- `Register an API`
- `Create API Version`

## Non-hero scenarios

- `Add API Definition`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#add-api-definition`](non-hero-scenarios.md#add-api-definition)
- `Import API Specification`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#import-api-specification`](non-hero-scenarios.md#import-api-specification)
- `List APIs`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#list-apis`](non-hero-scenarios.md#list-apis)
- `Create Environment`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#create-environment`](non-hero-scenarios.md#create-environment)
- `Create Deployment`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#create-deployment`](non-hero-scenarios.md#create-deployment)
- `Define Custom Metadata`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#define-custom-metadata`](non-hero-scenarios.md#define-custom-metadata)
- `Client Types`: | Client | Purpose |  
  See: [`non-hero-scenarios.md#client-types`](non-hero-scenarios.md#client-types)
- `Operations`: | Operation Group | Purpose |  
  See: [`non-hero-scenarios.md#operations`](non-hero-scenarios.md#operations)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
