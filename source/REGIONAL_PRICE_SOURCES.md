# Regional price sources and permission audit — 2026-10-28

## Production policy

Basket **does not scrape** retailer websites, bypass bot protections, use undocumented APIs, or copy retailer images. Price observations from third parties must not be stored as purchases, included in household budgets, or inserted into receipt price history. Every offer/price provider requires a source, territory, observation time, matching caveat, and evidence of permitted reuse.

| Source | Coverage | Permission / evidence | Basket status |
| --- | --- | --- | --- |
| [épiceries.ca API](https://epiceries.ca/developers) | Québec: Walmart, Maxi, IGA, Super C, Metro, Provigo | Public read-only API explicitly permits third-party browser use (CORS), requests attribution on republication, asks for caching/few requests per second. Provider records prices weekly. Exact branch/stock not guaranteed. The upstream retailer rights are not independently established. | **Integrated provisionally** for QC *price observations*, not scraped live flyers or guaranteed branch offers. |
| [Open Prices](https://prices.openfoodfacts.org/api/docs) | Community-contributed international observations | Open-data API; licence and attribution requirements must be preserved. Coverage/recency not suitable to claim current local specials without additional validation. | Not connected |
| [Awin feeds](https://help.awin.com/developers/docs/product-feed-publisher-guide-intro) | Individual approved partner programmes | Product feeds may provide price and discounts for authorized publishers. Individual advertiser partnership, store-level data and rights still need verification. | Not connected |
| [Walmart Canada affiliate program](https://www.walmart.ca/default/cp/affiliate-program/6000208941216) | Walmart products, partner scope | Advertised affiliate partnership, but this alone does not authorize automated retail price crawling, feed access or redistribution in Basket. | Not connected |
| [REWE](https://www.rewe.de) | Germany | Public website and post-code/market selection are not independently sufficient permission for automated collection/republication. Obtain an authorized feed or written permission first. | Not connected |
| No Frills, Atlantic Superstore, Sobeys, FreshCo, Giant Tiger, ALDI, Lidl, EDEKA, PENNY, Kaufland | CA / DE | Terms and explicit data-reuse permission have not been established for this implementation. | Not connected |

### Scope and accuracy

- Users can select Canada or Germany, province (Canada), a postal code and preferred store chains. Settings remain **on the device**. The code never sends the postal code to the Québec provider; the provider does **not** implement branch-specific prices.
- Only **CA + QC** with at least one supported chain queries épiceries.ca. Nova Scotia and Germany correctly show that no permitted feed is connected; selecting Walmart in NS does **not** request Québec prices.
- No direct retailer scraping or affiliate cookies. No paid services, accounts, keys or backend database migration.
- One product search and at most one product detail fetch per requested list item, with sequential scheduling, a small inter-query delay and six-hour local caching. A failed request is shown as unavailable; no fictitious prices.
- Offers are **not verified live flyer specials**: the data's `discounted` field is only labelled “marked discounted”; there is no expiry date, pickup pricing, membership requirement, or guaranteed availability.
- Stale price observations (older than 14 days) are excluded. Source metadata and observation dates are shown. Results are labelled **possible matches** with the source product's original brand and pack size; no automatic savings are asserted across incomparable products.
- Prices are CAD only in Québec and are never mixed with EUR or saved receipt lines.
- We use no retailer product images or logos. Third-party provider attribution is displayed in the comparison.
- Review original source terms again before any commercial deployment or broader reuse, especially the chain-data provenance and authorization.

### Testing and deployment

Run from `source/`:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm exec tsc --noEmit
pnpm run build:pages --out ..
```

The `regional-prices.test.ts` tests use mocked HTTP responses and cover geography/permissions, translation, price normalization, stale data, and safety against irrelevant search results. Live end-to-end testing of the actual third-party API and branch-specific availability is **not** provided by those tests. The GitHub Pages build must regenerate the repository-root `index.html` and `account-complete.html` before publishing.

### Next source-adapter work

1. Request and document authorized local-store price feeds for Atlantic Canada, in particular Walmart Canada, No Frills / Superstore, and Sobeys.
2. Check Awin/REWE advertiser approval, feed fields and legal uses for German market-specific pricing.
3. Only after evidence: add provider adapters and support branch identifiers and observed store-specific offer validity; keep each source independently disabled until approved.
