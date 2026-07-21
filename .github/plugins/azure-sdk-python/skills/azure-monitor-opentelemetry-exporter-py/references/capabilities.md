# azure-monitor-opentelemetry-exporter-py capability coverage

**SDK/package**: `azure-monitor-opentelemetry-exporter`

This index maps hero scenarios in `SKILL.md` and links non-hero scenarios documented in dedicated reference files.

## Hero scenarios covered in SKILL.md

- `Trace Exporter`
- `Metric Exporter`
- `Log Exporter`
- `From Environment Variable`

## Non-hero scenarios

- `Azure AD Authentication`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#azure-ad-authentication`](non-hero-scenarios.md#azure-ad-authentication)
- `Sampling`: Use `ApplicationInsightsSampler` for consistent sampling:  
  See: [`non-hero-scenarios.md#sampling`](non-hero-scenarios.md#sampling)
- `Offline Storage`: Configure offline storage for retry:  
  See: [`non-hero-scenarios.md#offline-storage`](non-hero-scenarios.md#offline-storage)
- `Disable Offline Storage`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#disable-offline-storage`](non-hero-scenarios.md#disable-offline-storage)
- `Sovereign Clouds`: Dedicated example and implementation notes.  
  See: [`non-hero-scenarios.md#sovereign-clouds`](non-hero-scenarios.md#sovereign-clouds)
- `Exporter Types`: | Exporter | Telemetry Type | Application Insights Table |  
  See: [`non-hero-scenarios.md#exporter-types`](non-hero-scenarios.md#exporter-types)
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
