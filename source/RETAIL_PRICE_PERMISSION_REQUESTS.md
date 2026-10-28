# Retail price feed permissions: requests to send (2026-10-28)

**Not sent.** These requests do not constitute permission. Basket must not activate merchant-site scraping or licensed retailer feeds until an authorized merchant representative supplies verifiable terms covering the exact usage.

## Shared request: data usage scope

Basket (https://donknutzen.github.io/Basket/) is a bilingual (English/German) household shopping-list and receipt-history application with planned price comparison in Canada and Germany. We would like to display current **store-specific grocery prices and promotional prices within Basket**, without redirecting to your website as the primary user flow.

Please confirm in writing:
1. Whether you license retailer product/price datasets or offer a documented API/feed that includes store/location identifiers, product code/GTIN, description, package size, unit price, regular price, promo price, price-validity dates and any loyalty conditions.
2. Whether your authorization permits **automated collection or retrieval**, local caching, normalization, comparison against other retailers, and display in a separate third-party mobile web application (not only affiliate advertising).
3. Whether your authorization covers noncommercial testing and a later public/commercial release. Specify fees, required attribution, permitted branding, refresh cadence, limits, allowed users/territories and revocation terms.
4. Whether geographic availability can be determined by postal code or individual store ID; distinguish online/delivery/pickup prices from shelf prices.
5. Whether you allow storing historical observations separately from users' private receipt data.
6. Whether your company has the right to license all supplied data, and whether third-party/aggregator approval is required.

We will not use your images, logos, protected flyer layouts, login details, private endpoints, bypass protections, or present inferred offers as verified live deals. We will implement rate limits, remove expired offers and show update timestamps.

## Nova Scotia / Canada

### Sobeys / Foodland / FreshCo (Empire)
- Official terms: https://corporate.sobeys.com/terms-of-use
- Their terms expressly restrict copying/reuse and generally require **written permission**. **Status: permission not granted.**
- Request permission via the official corporate contact or commercial data-licensing channel. Ask specifically for Nova Scotia pickup and in-store prices; current consumer delivery pricing is **not** automatically a store-shelf price.
- Do not start robots/crawlers based solely on publicly viewable prices.

### No Frills / Atlantic Superstore (Loblaw)
- Corporate legal: https://www.loblaw.ca/en/legal/
- The general corporate site terms are personal/noncommercial and restrict content reuse; subsidiary terms may supersede those. **Status: permission not granted.**
- Request a product and store-price data agreement from Loblaw commercial partnerships/data licensing, including banners and Atlantic Canada branch IDs.

### Walmart Canada
- Consumer contact page: https://www.walmart.ca/help/contact-us
- The US Walmart Affiliates / Walmart I/O products and their usage permissions must **not** be treated as a licence for Walmart Canada store-price comparison. The Walmart Canada app restrictions also do not create scraping rights. **Status: permission not granted.**
- Request Walmart **Canada** API/approved-feed access specifically for province/store availability, pickup vs shelf price, third-party price comparison and redistribution.

## Germany

### REWE
- Official Awin advertiser programme: https://ui.awin.com/merchant-profile/11652?setLocale=de_DE
- Awin publisher feed guide: https://help.awin.com/developers/docs/product-feed-publisher-guide-intro
- Published REWE programme explicitly disallows **Handzettel/Prospekte** for advertising and browser extensions. Affiliate participation is not automatic permission for retail scraping or a store-specific price database. **Status: permission not granted.**
- REWE affiliate contact published in programme: rewe.de.awin@partnermail.info
- Ask whether approved publisher status provides product feeds and whether **regional PLZ-/Markt-ID-Preise, third-party price comparison, caching and historical presentation** are expressly authorized; request a separate agreement if necessary.

### Other German stores
- ALDI, Lidl, EDEKA, Penny, Kaufland and Netto: status **unreviewed/permission not demonstrated** for current use. Do not activate scraping or private app endpoints without their terms and consent.

## Open-data alternative (different product)

- Open Prices API: https://prices.openfoodfacts.org/api/docs
- Licence: ODbL https://openfoodfacts.github.io/open-prices/guides/data/
- Community-submitted, proof-supported prices at mapped locations; may support historical **observations**, **not** guaranteed current promotional prices.
- Any Open Prices adapter should display attribution and ODbL obligations clearly, keep the Open Prices dataset separate from private household records, avoid merging it into a closed derivative database, honor API limits, and label observation date and store identifier. Real-world coverage in Nova Scotia and Germany must be measured rather than assumed.

## Approval ledger (must be verified before feature activation)

| Source | Live store feed | Authorized in-app reproduction | Written permission | Review |
|---|---|---|---|---|
| Sobeys | Not obtained | No | No | Blocked |
| Loblaw | Not obtained | No | No | Blocked |
| Walmart Canada | Not obtained | No | No | Blocked |
| REWE | Not obtained | No | No | Blocked |
| Open Prices | Community API, not live retailer feed | ODbL (with duties) | Public data licence | Potential historical-only adapter |
| épiceries.ca | Weekly Québec observed prices | Third-party use with attribution indicated on API documentation | Provider public terms; upstream rights not independently confirmed | Provisional Québec adapter |

This is engineering/compliance due diligence, not a legal opinion. For production use and commercial scale, seek qualified legal review of the exact agreements and applicable Canadian, German and EU data/database rules.
