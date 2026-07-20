# azure-monitor-opentelemetry-py capability coverage

**SDK/package**: `azure-monitor-opentelemetry`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Explicit Configuration`
- `With Flask`
- `With Django`
- `With FastAPI`

## Non-hero scenarios

- `Custom Traces`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#custom-traces`](non-hero-scenarios.md#custom-traces)
- `Custom Metrics`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#custom-metrics`](non-hero-scenarios.md#custom-metrics)
- `Custom Logs`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#custom-logs`](non-hero-scenarios.md#custom-logs)
- `Sampling`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#sampling`](non-hero-scenarios.md#sampling)
- `Cloud Role Name`: Set cloud role name for Application Map:  
  See: [`non-hero-scenarios.md#cloud-role-name`](non-hero-scenarios.md#cloud-role-name)
- `Disable Specific Instrumentations`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#disable-specific-instrumentations`](non-hero-scenarios.md#disable-specific-instrumentations)
- `Enable Live Metrics`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#enable-live-metrics`](non-hero-scenarios.md#enable-live-metrics)
- `Azure AD Authentication`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#azure-ad-authentication`](non-hero-scenarios.md#azure-ad-authentication)
- `Auto-Instrumentations Included`: | Library | Telemetry Type |  
  See: [`non-hero-scenarios.md#auto-instrumentations-included`](non-hero-scenarios.md#auto-instrumentations-included)
- `Configuration Options`: | Parameter | Description | Default |  
  See: [`non-hero-scenarios.md#configuration-options`](non-hero-scenarios.md#configuration-options)

## Related deep-dive references

- [`non-hero-scenarios.md`](non-hero-scenarios.md): Dedicated non-hero examples and implementation notes.

## API breadth checklist

- Verify client/auth mode for the environment before coding.
- Confirm operation-group/method names against current Microsoft Learn API reference.
- For Python SDKs with both sync and async clients, document both forms without a blanket preference.
- Include cleanup/delete paths for created resources in examples.
- Prefer idempotent create/update operations where available.
- Validate paging/LRO/error-handling patterns for production paths.
