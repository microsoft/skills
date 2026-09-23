# AI Service Cost Analysis

Use Cost Management billing dimensions for Azure AI and Foundry spend. Do not
claim token-level attribution unless a separate supported metric source returns
token usage for the same resource and period.

## Attribution Order

1. Confirm scope, period, currency, service, and the requested attribution:
   service, account/resource, meter or product, deployment, project, model, or
   token usage.
2. Query `ServiceName` first, then narrow with separate bounded queries by
   `ResourceId`, `MeterCategory`, `MeterSubCategory`, and `Meter`. Reuse exact
   returned values as filters.
3. Treat `ServiceName` and `ResourceId` as direct billing attribution. Treat
   meter-to-model interpretation as indirect unless the returned meter
   unambiguously names the model and price shape.
4. Cost Management does not expose native deployment, project, request, input
   token, or output token dimensions. Do not invent them. Resource tags may
   help map a resource to an owner or project, but they do not prove that all
   cost belongs to that tag value.

## Correlate Usage

5. If a supported metrics source returns requests, tokens, throughput units, or
   deployment usage for the same resource and period, report it separately from
   billing cost. Derive unit cost only when the numerator and denominator have
   matching scope, time grain, and completeness.
6. Keep shared account charges, provisioned throughput, fine-tuning, storage,
   content safety, and other meters separate. Do not allocate shared charges to
   one deployment without a supported allocation source.
7. Preserve currency and period. If rows reach `top`, increase it to at most
   5000 or narrow scope and label the result incomplete.

## Report

Present the measured cost by service, resource, and meter; the requested
attribution level; direct versus inferred mappings; any matching usage metrics;
unallocated charges; confidence; and evidence gaps.

For future spend or planned model pricing, hand off to `cost-estimation`.
A dedicated Microsoft Foundry workflow should be added only when supported
model, deployment, project, and account attribution is established.
