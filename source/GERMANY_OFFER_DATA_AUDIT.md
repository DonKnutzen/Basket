# German grocery offers: source audit (28 October 2026)

**Target:** Kiel (Schleswig-Holstein), primarily REWE, ALDI Nord, Lidl, EDEKA, PENNY; eventual Kaufland. Personal household app, no paid subscriptions desired, and keep the legal/reuse position defensible.

| Source | What is available | Legal / operational caveat | Status |
| --- | --- | --- | --- |
| Open Prices / Open Food Facts (prices.openfoodfacts.org) | Public documented REST API, ODbL, crowdsourced dated price observations with retailer/location and discount flags. Free data. | **Not a live weekly flyer feed**; crowdsourced sightings may be old and Kiel coverage sparse. Honor ODbL source attribution and share-alike. | Good future add-on for dated observations; not current offers |
| parelo (parelo.de/daten/) | Free data export of Open Prices crowdsourced ALDI/Lidl/PENNY prices, updated regularly. | Website explicitly excludes prices it collected from merchant websites from open-data export. Same freshness limitations. | Secondary open dataset |
| German Supermarket Offers on Apify | Third-party scraper extracts the six weekly chains into common price/validity schema. | Paid from $2/1,000 entries, unofficial; a vendor's paid service does not grant permission to republish retailer data. No independently verified agreement. | Technically plausible, **disabled** |
| Marktguru parse.bot adapter / OpenClaw scraper | Current zip-based flyer offer search claims REWE, ALDI Nord etc. | Unofficial. Marktguru does not publish a public third-party API and the OpenClaw tool copies website API keys. No clear permission. | Do not install or call |
| Allelebensmittel.de shopping tools | Public OpenAPI endpoints for assistant-driven one-off searches. | Site explicitly says *not* a general-purpose data API or bulk export; previous direct probes HTTP 403. Obtain written approval before embedding in Basket. | Disabled |
| REWE unofficial SDK (rewerse-engineering) | REWE mobile app backend can be queried with an extracted app mTLS certificate. | Avoid extracting private certificates or bypassing access controls. | Excluded |
| ALDI Nord, Lidl, EDEKA, PENNY direct pages / hidden JSON | Current offers are publicly viewable via official websites. | Public visibility or robots permission is not a third-party data redistribution licence. Rate limits and regional validity still matter. | Outbound links only |

References:
- https://prices.openfoodfacts.org/api/docs and https://openfoodfacts.github.io/open-prices/guides/data/
- https://parelo.de/daten/
- https://apify.com/nerdrx/de-supermarket-offers
- https://cfw.allelebensmittel.de/agents
- https://parse.bot/marketplace/ab5ea86d-d966-48cb-8c05-b885f15cad53/marktguru-de-api
- https://github.com/ByteSizedMarius/rewerse-engineering
- https://bugs.webkit.org/show_bug.cgi?id=236253

## Implementation plan once an authorized source is obtained

1. **Kiel first:** persistent region = Kiel and optional 5-digit post code / exact selected store; map ALDI Nord, not Süd.
2. **Data contract:** source, licence, storefront/branch scope, product barcode if present, brand, pack quantity/unit, current price EUR, old price only when explicitly sourced, sale flag, start/end date and observation timestamp. Validate date in Europe/Berlin. Never infer reductions.
3. **On demand only:** query added item, no crawling catalogues; server-side credential storage only (never publish API keys in Pages). Bounded result count, cache and polite backoff.
4. **Differentiate:** price confirmed, historical sighting, verified current weekly offer, and provider unavailable; never display no offer as if a source is connected.
5. **QA:** test genuine live response, CORS/server access, matching and pack-size identity, regional stores and expiration before enabling the toggle. Keep receipts and their private price history separate.
6. **iOS navigation:** do not launch cross-origin target-blank tabs from an installed iOS Basket PWA. Copy the authenticated/source-free URL for use in Safari; regular browsers keep external links.

Do not turn on a fake German live feed just because individual products appear on a retailer's own webpage. Private use alone does not authorize any form of automatic collection or republication.
