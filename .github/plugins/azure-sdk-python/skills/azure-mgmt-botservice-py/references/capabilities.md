# azure-mgmt-botservice-py capability coverage

**SDK/package**: `azure-mgmt-botservice`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Create a Bot`
- `Get Bot Details`
- `List Bots in Resource Group`
- `List All Bots in Subscription`

## Non-hero scenarios

- `Update Bot`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#update-bot`](non-hero-scenarios.md#update-bot)
- `Delete Bot`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#delete-bot`](non-hero-scenarios.md#delete-bot)
- `Configure Channels`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#configure-channels`](non-hero-scenarios.md#configure-channels)
- `Get Channel Details`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#get-channel-details`](non-hero-scenarios.md#get-channel-details)
- `List Channel Keys`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#list-channel-keys`](non-hero-scenarios.md#list-channel-keys)
- `Bot Connections (OAuth)`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#bot-connections-oauth`](non-hero-scenarios.md#bot-connections-oauth)
- `Client Operations`: | Operation | Method |  
  See: [`non-hero-scenarios.md#client-operations`](non-hero-scenarios.md#client-operations)
- `SKU Options`: | SKU | Description |  
  See: [`non-hero-scenarios.md#sku-options`](non-hero-scenarios.md#sku-options)
- `Channel Types`: | Channel | Class | Purpose |  
  See: [`non-hero-scenarios.md#channel-types`](non-hero-scenarios.md#channel-types)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
