# Basket – targeted, on-demand supermarket offers (28 October 2026)

## What the shopping list does

Basket's primary use case is **weekly specials for the product just added**, not harvesting base prices. When a user successfully adds or reopens an existing checked-off product, the new `OffersForItem` checks **only that item**. Existing items have an optional **Check offers** action. Results are cached locally for one hour, serialised and throttled; no crawling of retail websites, no reverse engineering of private APIs, no bypass of login/CAPTCHA/anti-bot and no paid service.

A result is displayed **only when all of the following can be verified by the provider's response**:
- matching item/product (not an arbitrary search result, e.g. milk chocolate ≠ milk);
- retailer explicitly identified and permitted by the user's selected stores;
- positive offer price and a clear discount over regular price or an explicit promotional flag;
- explicit `valid_from`, `valid_until` covering today in the selected region;
- an observation/update date within the last seven days;
- province-appropriate source, currency, and a safe HTTPS source link.

No expiry date = **not displayed**. No provider response or HTTP 403 = **source unavailable**, not 'no offers.' A successful, empty result means no verified offers found **in that source**; it does not prove the retailer has none. Prices and availability may differ by branch; selected retailers are chains, not verified individual shops. No comparison of unrelated pack sizes, percentage-savings inference or user purchase-history writes.

## Sources reviewed

**Bidou (Canada, Québec/Ontario)**: [public JSON API documentation](https://bidou.store/en/api) advertises read-only unauthenticated shopper-oriented API, open browser CORS, attribution with price date, and province-aware product search and prices. Basket uses only a targeted GET /api/v1/products?q=... and GET /api/v1/prices/{upc}; it refuses to call any hidden retailer API or collect an entire catalogue. Ontario is restricted to No Frills / Real Canadian Superstore, Québec to named provincial chains.

**Important validation limit:** The independent GitHub Actions live probe of all requested documented Bidou endpoints (including RSS) on 28 October 2026 returned **HTTP 403**. The API parser has defensive tests with fixture responses, but a successful real end-to-end result has **not** been established. User browsers may behave differently, but do not assume the source works; do not merge and advertise it as a functioning live feature based on mocks alone. If Bidou's actual schema lacks explicit promotional dates, the strict parser deliberately displays no offers. Review provider's authorization and source provenance before public roll-out.

**Allelebensmittel.de (Germany)**: [public shopping assistant tools](https://cfw.allelebensmittel.de/agents) document product/retailer comparisons for an assistant helping a person shop, not general-purpose data export. GitHub Actions received HTTP 403 / Cloudflare challenge on public endpoints, so there is **no active German offer adapter**, and no effort to bypass protections.

**Nova Scotia — now connected (partial coverage):** [aubaine.ca weekly grocery basket](https://aubaine.ca/en/weekly-grocery-basket/nova-scotia.csv) is an explicitly published reusable **CSV dataset** (the source's weekly basket pages state figures and datasets may be reused with credit and reading week). GitHub Actions confirmed HTTP **200**, `Content-Type: text/csv`, `Access-Control-Allow-Origin: *` and ~18 KB of real Nova Scotia supermarket observations for **2026-10-22 through 2026-10-28**, with 19 distinct staple categories and 11 matching grocery banners, including Sobeys, No Frills and Atlantic Superstore. These are **regional retailer flyer reference prices**, **not verified per-branch checkout prices** and **not guaranteed markdowns**. No explicit source observation timestamp exists in this CSV: Basket must not invent one. Instead it shows exact week validity and a source link; only rows whose dated week includes the viewer's Halifax-local calendar date are displayed. Prices for next week are never inferred from last week's data. The CSV is fetched at most once per three hours, then each requested product is matched locally by an allowlisted generic category (e.g. 'Milch' / 'milk' => `lait`). A specific variant or 2 L milk is **not** silently equated with '2 L or 4 L' flyer groups; family packs can vary. There is no mass retail scraping or storage of private shopping lists by the provider. Supported categories include milk, eggs, bread, butter, apples, potatoes, rice, sugar, yogurt, cooking oil, pasta, cheddar cheese, coffee, flour, toilet paper, chicken, ground beef, orange juice and carrots. The Aubaine dataset contains no Walmart rows for NS: Walmart is therefore not shown as covered by this source. Report the difference between a flyer reference price and a verified actual promotion prominently.

**Second open source assessed:** [Lowtein Open Data](https://lowtein.com/data) offers CC BY 4.0 CSV downloads, with credit, and a [Halifax deal view](https://lowtein.com/ca/ns/halifax). GitHub Actions confirmed `ca-prices.csv` HTTP 200, but its 4 KB table holds nationwide **best deals per category**, without Halifax-specific rows, so it cannot safely prove that the displayed national best price is available in Nova Scotia. We did not mislabel national prices as local.

**Further sources:** NoshUp offers free ChatGPT flyer search through a user-authorized OAuth connection but direct access from scripts/other clients requires an eligible plan. Flipp's app terms prohibit republishing app content. Neither is silently harvested by Basket.

## License and implementation separation

Personal/noncommercial use does not universally authorize automated extraction, and robots.txt allowance is not a blanket licence to republish. Basket uses the third-party documented interfaces only. Data from those interfaces is **not** saved into the receipt history or household budgets and is never sold or exported.

No merchant permission request is required to continue developing the frontend, the matcher or tests; still, a compliant data feed and tested response are necessary to activate a source.

## Verification

`cd source && pnpm install --frozen-lockfile && pnpm test && pnpm exec tsc --noEmit && pnpm run build:pages --out ..`

The project test suite includes coverage of one-item/two-request limits, no call for unsupported regions, store filters, promotion validation, stale/expired source rejection, translation of common product terms, and source URL safety. The compiled GitHub Pages assets are generated on the feature branch only; **production remains on main** until a real source is validated.

## Germany: Kiel selection and official weekly-flyer fallback (28 October 2026)

Germany now has a visible **Region: Kiel (Schleswig-Holstein)** selector. Older German selections default to Kiel. The retailer chips link to REWE, EDEKA, Lidl, ALDI Nord, PENNY and Kaufland. After the shopper taps **Check official flyers** on an item, Basket shows official website links only. No item name, household data or session data is sent to any retailer.

- REWE and EDEKA links use specific example Kiel market pages; shoppers must confirm their store.
- Lidl, ALDI Nord, PENNY and Kaufland links open the official offer pages, where the exact branch may need selection.
- **No licensed, automated Germany weekly-offer feed is connected.** Basket does not invent or display German deal prices. The Germany provider remains unavailable and the Canada integration is unchanged.
- Open Prices (ODbL) offers historical public price observations, including discounted sightings, but a sighting does not demonstrate a currently valid weekly offer. A separate observation feature would require Kiel coverage and CORS validation.
- Allelebensmittel.de assistant shopping tools are expressly not a general-purpose data API; request explicit reuse permission before powering an app feed.

