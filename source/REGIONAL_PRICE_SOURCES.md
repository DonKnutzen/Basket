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

## User's target cities: Kiel, Halifax and Dartmouth (2026-10-28)

The earlier Berlin sample was a general API coverage probe and **is not a target city**. Current private-use choices are **Kiel, Germany** and **Halifax or Dartmouth, NS**.

### Halifax/Dartmouth: permitted personal-list API, not a scraper

- **GroceryPulse.ca** publishes a no-key public personal shopper API with explicit third-party software use for *person-triggered* comparisons. Source: https://grocerypulse.ca/terms and https://grocerypulse.ca/agents .
- Catalog coverage is `halifax` (not a separately defined Dartmouth city). Dartmouth shows **Halifax-area chain medians** and never claims a specific Dartmouth shelf price.
- Six chains mapped: Walmart, No Frills, Atlantic Superstore, Sobeys, Giant Tiger, Wholesale Club. The provider covers 50 canonical reference products, not all groceries.
- Frontend makes **one user-initiated request per explicit list comparison** to Basket's authenticated `/api/shopper-prices` endpoint, which uses the provider's documented `POST /api/shopper/plan` from the server. Browser-origin requests to the provider are disallowed; do not call it directly from GitHub Pages.
- Each comparison is capped at 30 user-entered lines, six selected stores, 3,000 characters, with a four-hour client cache. It is never used to bulk-import product records, rebuild a database or create receipt history. Price source may rate-limit requests and return 429.
- An explicit live smoke test for `2% milk 4L\nlarge eggs 12 pack` returned exact matches, price observations (e.g. Giant Tiger 6.77 CAD for 4 L milk and Wholesale Club 7.09 CAD), original observation dates and store links. **These are observed prices dated 2026-10-22**, not guaranteed current branch stock/checkout prices.
- The API's `recommendation.status` and `totalScope` govern rankings; a subtotal is never relabelled a full-list total. The frontend shows individual prices only where returned, plus date, pack-size warning and sale flags.
- Comparison is opt-in for signed-in household members. The provider receives only the **shopping list content**, `halifax` market and selected chains, not the user's account identifiers or complete postal code. Its published privacy terms say list contents are not stored.

### Kiel: sparse Open Prices sightings, no live offer feed

- A bounded public `Open Prices` locations query showed **18 registered price locations** in Kiel, such as REWE, Netto, EDEKA and a health-food shop (2026-10-28). This does not mean active live prices.
- Among three sampled Kiel locations with stored records (IDs 634, 687, 773), **zero EUR prices** were found since 2026-09-28. We do not promote old prices as current or invent city-wide coverage.
- Open Prices entries are community-submitted under ODbL and are historical observations, not a supermarket live promotional feed. A curated, read-only historic lookup would be possible with a server gateway while retaining the licence/attribution, but is not equivalent to a current REWE or ALDI scraper.
- A targeted, single GET to REWE's public market page `https://www.rewe.de/marktseite/kiel/8544048/rewe-markt-holstenstr-1` on 2026-10-28 returned **HTTP 403 from the GitHub Actions runner**, even though the same page is accessible in a normal web browser. The path was not explicitly disallowed in the checked robots.txt, but that does **not** override the 403 or grant reuse rights. Basket does not bypass the block, use proxies, forge sessions, or repeatedly retry.
- Further authorized direct feeds remain blocked pending acceptable reuse terms. **Personal use alone does not void a site's terms**, and this publicly hosted GitHub Pages source is not the same as a local one-off personal script.

**Delivery status:** Backend `/api/shopper-prices` must be deployed to Basket's actual Cloudflare server before the public GitHub Pages client can reach it. Building the frontend by GitHub Actions does not deploy the backend. Do not advertise the feature as live until the endpoint and authentication work end-to-end.

### Next source-adapter work

1. Request and document authorized local-store price feeds for Atlantic Canada, in particular Walmart Canada, No Frills / Superstore, and Sobeys.
2. Check Awin/REWE advertiser approval, feed fields and legal uses for German market-specific pricing.
3. Only after evidence: add provider adapters and support branch identifiers and observed store-specific offer validity; keep each source independently disabled until approved.
