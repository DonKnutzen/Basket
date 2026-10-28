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

**Nova Scotia**: No verified, reusable, no-key, branch-specific live flyer API was identified. The CA/NS setting retains the user's selection and explicitly says that there is **no connected verified offer feed**. Neither historical Open Prices entries nor annual/regional averages are presented as a current sale. NoshUp has current Canadian flyer tools through a free connected account via OAuth, but a direct integration into Basket requires an authorized user connection, not a guessed public URL or embedded token.

## License and implementation separation

Personal/noncommercial use does not universally authorize automated extraction, and robots.txt allowance is not a blanket licence to republish. Basket uses the third-party documented interfaces only. Data from those interfaces is **not** saved into the receipt history or household budgets and is never sold or exported.

No merchant permission request is required to continue developing the frontend, the matcher or tests; still, a compliant data feed and tested response are necessary to activate a source.

## Verification

`cd source && pnpm install --frozen-lockfile && pnpm test && pnpm exec tsc --noEmit && pnpm run build:pages --out ..`

The project test suite includes coverage of one-item/two-request limits, no call for unsupported regions, store filters, promotion validation, stale/expired source rejection, translation of common product terms, and source URL safety. The compiled GitHub Pages assets are generated on the feature branch only; **production remains on main** until a real source is validated.
