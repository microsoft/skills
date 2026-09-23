# Cost Query Dimensions

Use only dimensions accepted by the Azure Resource Manager MCP whitelist.

## Dimensions supported at all scopes

`ServiceName`, `ServiceTier`, `ChargeType`, `PublisherType`, `PricingModel`,
`BenefitName`, `BenefitId`, `Frequency`, `CostAllocationRuleName`,
`MarkupRuleName`, `SubscriptionName`, `SubscriptionId`, `PartNumber`,
`BillingPeriod`, `BillingPeriodId`, `InvoiceNumber`, `ReservationId`,
`ReservationName`, `DepartmentName`, `EnrollmentAccountName`, `CustomerName`,
`BillingAccountName`, `BillingProfileName`, and `InvoiceSectionName`.

Agreement-specific upstream rules still apply. For example, department and
enrollment dimensions apply to Enterprise Agreement (EA), while billing profile
and invoice section dimensions apply to Microsoft Customer Agreement (MCA).

## Subscription or resource-group scope only

`ResourceGroupName`, `ResourceGroup`, `ResourceType`, `ResourceId`,
`ResourceLocation`, `ResourceGuid`, `MeterCategory`, `MeterSubCategory`, and
`Meter`.

## Aliases accepted by the tool

| Alias | Canonical dimension |
|---|---|
| `rg`, `resourcegroup` | `ResourceGroupName` |
| `subscription`, `sub` | `SubscriptionName` |
| `location`, `region` | `ResourceLocation` |
| `service` | `ServiceName` |
| `department` | `DepartmentName` |
| `resource` | `ResourceId` |
| `chargetype` | `ChargeType` |
| `pricingmodel` | `PricingModel` |

Tags, `TagKey`, `Product`, and `ServiceFamily` are not accepted by
`query_costs`. Use `list_dimensions` to discover canonical values for filtering.
