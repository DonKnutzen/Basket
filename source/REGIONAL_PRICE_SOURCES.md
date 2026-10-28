# Regional price sources and permission audit — 2026-10-28

## Production policy

Basket **does not scrape** retailer websites, bypass bot protections, use undocumented APIs, or copy retailer images. Price observations from third parties must not be stored as purchases, included in household budgets, or inserted into receipt price history. Every offer/price provider requires a source, territory, observation time, matching caveat, and evidence of permitted reuse.

| Source | Coverage | Permission / evidence | Basket status |
| --- | --- | --- | --- |
| [épiceries.ca API](https://epiceries.ca/developers) | Québec: Walmart, Maxi, IGA, Super C, Metro, Provigo | Public read-only API explicitly permits third-party browser use (CORS), requests attribution on republication, asks for caching/few requests per second. Provider records prices weekly. Exact branch/stock not guaranteed. The upstream retailer rights are not independently established. | **Integrated provisionally** for QC *price observations*, not scraped live flyers or guaranteed branch offers. |
| [Open Prices](https://prices.openfoodfacts.org/api/docs) | Community-contributed international observations | ODbL attribution/share-alike duties. Live public API probe found **no Halifax locations**, 149 Berlin locations, and historical observations; no browser CORS header was returned by checked endpoints. Cannot claim live offers. | Not connected; potential separate historic-only backend integration |
| [Awin feeds](https://help.awin.com/developers/docs/product-feed-publisher-guide-intro) | Individual approved partner programmes | Product feeds may provide price and discounts for authorized publishers. Individual advertiser partnership, store-level data and rights still need verification. | Not connected |
| [Walmart Canada affiliate program](https://www.walmart.ca/default/cp/affiliate-program/6000208941216) | Walmart products, partner scope | Advertised affiliate partnership, but this alone does not authorize automated retail price crawling, feed access or redistribution in Basket. | Not connected |
| [REWE](https://www.rewe.de) | Germany | Public website and post-code/market selection are not independently sufficient permission for automated collection/republication. Obtain an authorized feed or written permission first. | Not connected |
| No Frills, Atlantic Superstore, Sobeys, FreshCo, Giant Tiger, ALDI, Lidl, EDEKA, PENNY, Kaufland | CA / DE | Terms and explicit data-reuse permission have not been established for this implementation. | Not connected |

### Scope and accuracy

- Users can select Canada or Germany, province (Canada), a postal code and preferred store chains. Settings remain **on the device**. The code never sends the postal code to the Québec provider; the provider does **not** implement branch-specific prices.
- Only **CA + QC** with at least one supported chain queries épiceries.ca. Nova Scotia and Germany correctly show that no permitted feed is connected; selecting Walmart in NS does **not** request Québec prices.
- No direct retailer scraping or affiliate cookies. No paid services, accounts, keys or backend database migration.
- Up to two documented product searches and at most one product detail fetch per requested list item, with sequential scheduling, a small inter-query delay and six-hour local caching. A failed request is shown as unavailable; no fictitious prices.
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


## Direct Open Prices coverage probe (2026-10-28, GitHub Actions)

The repository's `scripts/check-open-prices-coverage.mjs` requested four public documented read-only API endpoints, with an 12-second deadline each. Result (point-in-time, not evidence of all future coverage):

| Query | Result |
| --- | --- |
| Locations with city **Halifax**, Nova Scotia | **0** (no store data returned) |
| Locations with city **Berlin**, Germany | **149** (example stores Netto and Aldi) |
| Price observations in CAD since 2026-10-01 (all of Canada) | **29** (examples were from Québec, not Nova Scotia) |
| Price observations in EUR since 2026-10-01 (all locations) | **5,693** (Germany examples; not verified current promotions) |

The checked responses did not include `Access-Control-Allow-Origin` (reported `null`). A browser-hosted static GitHub Pages app should **not** assume direct cross-origin access. A reviewed backend data-access gateway would be necessary before promising any browser integration. A public list endpoint with historical price reports is **not** a live branch-specific catalogue.

**Conclusion:** this does not close the Nova Scotia or Germany live-price requirement. The coverage probe intentionally leaves those integrations disabled instead of inventing store prices or unauthorized scraping.

### Next source-adapter work

1. Request and document authorized local-store price feeds for Atlantic Canada, in particular Walmart Canada, No Frills / Superstore, and Sobeys.
2. Check Awin/REWE advertiser approval, feed fields and legal uses for German market-specific pricing.
3. Only after evidence: add provider adapters and support branch identifiers and observed store-specific offer validity; keep each source independently disabled until approved.
