# Pricing Estimate

1. Confirm service, SKU, region, OS, tier, usage quantity, and billing period.
   Ask only for missing details needed to disambiguate a meter.
2. Call `get_retail_prices`. Compare options with separate calls when needed.
   Preserve `productName`, `skuName`, `armSkuName`, price type, unit, region,
   and currency so the selected row is auditable. The tool requests up to 5000
   rows. If `Count` reaches that limit or `NextPageLink` is present, narrow the
   filters and disclose that the result set was truncated; do not invoke the
   returned URL directly.
3. Exclude Spot, Dev/Test, Windows, Reservation, or Savings Plan meters unless
   they match the request. If multiple plausible meters remain, ask for the
   minimum missing detail or show a short candidate table containing
   `productName`, `skuName`, `armSkuName`, meter name, and price type. Never
   silently choose among multiple meter shapes.
4. Show `unit price x usage = estimated period cost` and list every assumption.
   Reservation prices are term purchase totals; normalize one-year prices by 12
   and three-year prices by 36. Savings Plan and consumption prices are hourly
   meter rates and may be multiplied by expected hours.
5. For negotiated rates, confirm the Enterprise Agreement (EA) or Microsoft
   Customer Agreement (MCA) billing scope. Call
   `start_pricesheet_download`, then poll `get_pricesheet_status` using its
   retry interval. Label retail and negotiated values separately.
   If a pricing operation is unavailable, use the mapped API from
   [tool fallback](tool-fallback.md).
6. Pricesheet downloads return a short-lived ZIP URL. The MCP server does not
   download or parse it. Return the URL and ask the user to download and provide
   the file for comparison; do not claim a negotiated-price analysis before the
   file is available.

Retail estimates are not bills or realized savings. If the user provides an
existing scope and wants current spend, hand off to `cost-analysis`.
