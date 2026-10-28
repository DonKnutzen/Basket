# Private German supermarket flyer import – Kiel (2026-10-28)

## Workflow
1. Download a PDF or save a screenshot of an **official** REWE, ALDI Nord, Lidl, EDEKA, PENNY or Kaufland flyer using your own browser. Basket does not scrape retailer websites or retrieve third-party offer catalogues.
2. In the shopping list, open **Weekly offers** → Country **Germany** → Region **Kiel (Schleswig-Holstein)** → **Import a weekly flyer privately**.
3. Select the source retailer and **manually enter start and end dates exactly as printed in the flyer**.
4. Select a PDF (up to 25 MB; up to 8 pages **per import**, with selectable starting page for longer brochures) or JPG/PNG/WebP image (max. 12 MB). Text-native PDFs use PDF.js; scanned pages/images use Tesseract.js OCR. Both run inside the browser. No source PDF/image or extracted text is sent to Basket, the data API, or an AI provider. On first use, the browser may download the open-source PDF.js code, the OCR engine and language files from public CDNs; these downloads do not contain the user's flyer.
5. Review OCR candidates against the original, edit product name, package quantity and actual advertised EUR price. The detection is intentionally conservative: only a single price on the same line qualifies as a suggested candidate. Extra columns, strike-through prices, price-per-unit and stacked promotional prices may **not** parse. Add them manually rather than guessing.
6. Select each verified offer and save. Only the reviewed name, store, unit, price, entered validity period, and source **filename** are persisted in browser localStorage. No PDF bytes, OCR text, or scraped offers are stored remotely.
7. Matching shopping-list tiles show **Your imported flyer matches** if the entered validity covers the current date in Europe/Berlin and the selected chain matches. A generic item match is not a verified SKU/branch identity; confirm packaging and store before buying. A flyer price is **not proof of a price reduction** versus the normal shelf price.
8. The shopper can delete all locally imported flyer entries under the same import panel. Entries also automatically become invisible on expiry and are discarded the next time a new reviewed import is saved.

## Boundaries and limitations
- This does **not** provide automatic live German supermarket prices, unattended scraping, or guaranteed nationwide coverage. Official retailer flyer links remain available.
- Imported offers are stored per browser/device only. They do not sync with the logged-in household or contribute to receipt-derived personal price history, statistics or budgets.
- PDF import is bounded to 25 MB per file (to accommodate e.g. a 16 MB REWE flyer); images remain limited to 12 MB and processing to 8 PDF pages per scan to reduce iOS memory load. For long brochures, select a starting page (1, then 9, then 17…), review/save each batch, and reselect the original PDF to process the next batch. Password-protected PDFs may fail. OCR quality depends on scan quality and printed design.
- For privacy, the PDF URL importer accepts **local files only**, not remote URLs. The browser executes open-source third-party parsing code downloaded on demand. For a strict offline build, PDF.js, Tesseract worker/core and German language assets should later be bundled/self-hosted.
- Copyright and database rights may apply to source material. Basket does not distribute source brochures, clone merchant catalogues or re-share reviewed price entries.
- Manual review is mandatory. Validity dates are deliberately not inferred from OCR. Do not label a historical consumer observation a current markdown.

## Verification
Run `cd source && pnpm install --frozen-lockfile && pnpm test && pnpm exec tsc --noEmit && pnpm run build:pages --out ..`.

Safety unit tests cover price parsing, ambiguity rejection, invalid calendar dates, expiration filtering, store selection, localStorage validation/deduplication and matching.

The 25-MB PDF allowance changes validation only. It does not promise that every device can decode a graphics-heavy PDF; try a smaller screenshot if an older iPhone runs out of memory. Files and OCR text remain on-device.

## Verified official-store source check (28 October 2026)

The real requested REWE market is **Holtenauer Str. 69–71, 24105 Kiel**, ID `561204`. Basket's official link was corrected to its exact [weekly offer page](https://www.rewe.de/angebote/kiel/561204/rewe-holtenauer-str-69-71/?market-flyer=active). The retail page returns a **403** to ordinary unattended GitHub Actions requests, and the REWE page warns its PDF flyer viewer is unavailable. **Never bypass retailer access controls.** REWE product highlights are independently visible to a human through the website; this does not authorize harvesting them into a public app.

The exact [ALDI Nord 26 October 2026 PDF](https://magazine.aldi-nord.de/aldi-nord/aldi-aktuell/2026/2026cw44mopromotionaldi-angebote-ab-montag-26-10-1//GetPDF.ashx) was successfully downloaded by one temporary verification runner via an expiring official CDN redirect. It was **120,879,735 bytes (about 121 MB), 49 pages**. Plain PDF text extraction produces product descriptions, isolated prices and unit prices in non-semantic order: for instance `1.79` appears before `ASIA GREEN GARDEN Sesam-/Erdnussöl`, and other prices are separated from nearby product names. Consequently a naïve parser must **not** claim a price belongs to the next product. The full 121 MB PDF must not be loaded into a 25-MB/iOS file importer automatically.

ALDI's own [web offers page](https://www.aldi-nord.de/angebote.html) returned an ordinary HTTP 200 with visible product text, but the checks did not find an `Access-Control-Allow-Origin` permission for Basket. Browser JavaScript therefore cannot simply read that page from the separate GitHub Pages origin. Do not use a hidden browser API, stolen credentials, CORS bypass or a republishing proxy to imply a working automatic source.

**Current supported functionality:** readable per-page OCR/PDF text verification with price highlighting, optional all-lines view, search and original-line context; manual locally reviewed entries become offer cards in the grocery list. The external source links are clearly labeled. **Not delivered:** unattended live official retailer scraping or automatic flyer imports. Those require explicit access/reuse permission or a compatible documented licensed feed. A merchant's visible public marketing offers alone do not prove republication rights.

For ALDI use the official [lightweight live-offers page](https://www.aldi-nord.de/angebote.html) in your browser rather than importing the entire 121 MB PDF. The import cap remains 25 MiB for locally chosen PDFs.

## 28 Oct 2026: experimental automatic matching without user PDF uploads

For this exact source, the user provided the official REWE Holtenauer Str. 69–71 (market 561204), week 44 flyer PDF on Publitas. A GitHub Actions job downloads that **one public PDF** (HTTP 200, PDF, 28 pages, 25,035,706 bytes), extracts only a small subset of high-confidence, grocery-category/price facts using PyMuPDF and publishes **no images, full PDF, original text or exhaustive catalog**. The resulting bounded, source-linked `rewe-kiel-weekly.json` includes market ID, dates, source PDF, week status, page number, actual printed price and explicit `category-only` confidence. The reader performs one controlled download per day, not a site crawl, and honors HTTP errors. It never bypasses anti-bot mechanisms.

Basket fetches that small JSON from its own GitHub Pages origin automatically and matches generic shopping-list items only. If a matching, current-week category is available it appears as a REWE source-reference price on the item. A brand, exact SKU/size, and store availability are **not guaranteed**, and a missing match cannot be interpreted as no sale. The manual upload flow remains an optional fallback.

**Important coverage and legal limits:**
- This first integration only covers the explicit official REWE week **2026-10-26 through 2026-10-31**. Those prices become invisible after the last day. The official link for the next week cannot currently be discovered automatically from the REWE market page (unattended site fetch returned HTTP 403). The source must be refreshed by the maintainer or a properly authorized discovery/feed workflow; there is **no claim** of an uninterrupted ongoing Germany price feed.
- Extraction intentionally discards ambiguous price-product pairs, including close-by multiple categories, non-sale unit prices, loyalty-only discounts and old prices.
- Only a few summary price facts are published, not a replacement for the entire original flyer. This is not proof of a general reuse license; ongoing redistribution or a larger service would require a rights review or permission from the retailer/rights holder.
- The scheduled job operates centrally; shoppers are never asked to upload the flyer or pay for OCR. It does not download the 25-MB PDF to their phones.
- No user shopping-list items are sent to REWE/Publitas. Matching takes place in the client after the limited JSON is fetched.
