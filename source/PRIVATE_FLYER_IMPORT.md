# Private German supermarket flyer import – Kiel (2026-10-28)

## Workflow
1. Download a PDF or save a screenshot of an **official** REWE, ALDI Nord, Lidl, EDEKA, PENNY or Kaufland flyer using your own browser. Basket does not scrape retailer websites or retrieve third-party offer catalogues.
2. In the shopping list, open **Weekly offers** → Country **Germany** → Region **Kiel (Schleswig-Holstein)** → **Import a weekly flyer privately**.
3. Select the source retailer and **manually enter start and end dates exactly as printed in the flyer**.
4. Select a PDF (12 MB; up to 8 pages **per import**, with selectable starting page for longer brochures) or JPG/PNG/WebP image (max. 12 MB). Text-native PDFs use PDF.js; scanned pages/images use Tesseract.js OCR. Both run inside the browser. No source PDF/image or extracted text is sent to Basket, the data API, or an AI provider. On first use, the browser may download the open-source PDF.js code, the OCR engine and language files from public CDNs; these downloads do not contain the user's flyer.
5. Review OCR candidates against the original, edit product name, package quantity and actual advertised EUR price. The detection is intentionally conservative: only a single price on the same line qualifies as a suggested candidate. Extra columns, strike-through prices, price-per-unit and stacked promotional prices may **not** parse. Add them manually rather than guessing.
6. Select each verified offer and save. Only the reviewed name, store, unit, price, entered validity period, and source **filename** are persisted in browser localStorage. No PDF bytes, OCR text, or scraped offers are stored remotely.
7. Matching shopping-list tiles show **Your imported flyer matches** if the entered validity covers the current date in Europe/Berlin and the selected chain matches. A generic item match is not a verified SKU/branch identity; confirm packaging and store before buying. A flyer price is **not proof of a price reduction** versus the normal shelf price.
8. The shopper can delete all locally imported flyer entries under the same import panel. Entries also automatically become invisible on expiry and are discarded the next time a new reviewed import is saved.

## Boundaries and limitations
- This does **not** provide automatic live German supermarket prices, unattended scraping, or guaranteed nationwide coverage. Official retailer flyer links remain available.
- Imported offers are stored per browser/device only. They do not sync with the logged-in household or contribute to receipt-derived personal price history, statistics or budgets.
- Import is bounded to 12 MB and 8 PDF pages per scan to reduce iOS memory load. For long brochures, select a starting page (1, then 9, then 17…), review/save each batch, and reselect the original PDF to process the next batch. Password-protected PDFs may fail. OCR quality depends on scan quality and printed design.
- For privacy, the PDF URL importer accepts **local files only**, not remote URLs. The browser executes open-source third-party parsing code downloaded on demand. For a strict offline build, PDF.js, Tesseract worker/core and German language assets should later be bundled/self-hosted.
- Copyright and database rights may apply to source material. Basket does not distribute source brochures, clone merchant catalogues or re-share reviewed price entries.
- Manual review is mandatory. Validity dates are deliberately not inferred from OCR. Do not label a historical consumer observation a current markdown.

## Verification
Run `cd source && pnpm install --frozen-lockfile && pnpm test && pnpm exec tsc --noEmit && pnpm run build:pages --out ..`.

Safety unit tests cover price parsing, ambiguity rejection, invalid calendar dates, expiration filtering, store selection, localStorage validation/deduplication and matching.
