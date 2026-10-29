# Weekly Kiel grocery-flyer import: reusable QA procedure

Applies to future **REWE Kiel (market 561204), ALDI Nord Kiel and PENNY Kiel** weekly PDF uploads. This procedure is independent of the specific week. It is a proposal-and-review workflow, **not** an automatically verified product database.

## Every new week

1. Upload the original PDF from the correct retailer/region in Basket → Germany/Kiel → Weekly offers → Operator section. Confirm the printed outer validity period; don't reuse last week's dates. For PENNY, the existing supported official PDF URL import may be used. The importer is idempotent by original file checksum.
2. Let the existing OIDC-authenticated GitHub queue worker process **every page**. It reports proposals, needs-unit and price-ambiguous counts per page and a totals summary for newly processed pages. Resumed runs count only pages processed in that run, not previously checkpointed pages.
3. Use the operator summary to find missing pack units and doubtful price assignments. New **Einheiten prüfen** and **Preiszuordnung prüfen** filters reduce manual searching. Revisit pages with no candidates and compare with the original PDF; OCR page processing is **not** proof that all products were found.
4. A pack unit is suggested only when explicitly printed (e.g. **Stück**, **kg-Preis**, **Bund**, **Schale**, **Netz**, **Packung**). It stays marked as inferred until the original is checked. Do not substitute a weight/volume or infer a pack from common product sizes.
5. Review the product title, brand, variants, sale price, unit/pack size, per-unit/base price, deposit, membership/app/bonus requirements and any shorter in-week validity date. One retailer tile can contain multiple products or prices; split or reject it rather than guessing the pairing.
6. Confirm matching entries individually using the private original crop. Undecidable areas remain visible as **unverified** proposals, with no misleading confirmed price. Publishing requires operator confirmation; new weekly candidates do not inherit previous approvals.
7. On the shopper side check actual names and synonyms (e.g. Kiwi, Bananen, Kohl, Cola Zero) and all selected retailers. Compare **unit price** only when units are comparable. Check a second account sees only permitted published/sanitized draft fields.
8. Verify the PDF links and expiry after the validity period. Invalid/expired offers must disappear at **Berlin-local midnight**; the next weekly upload replaces them rather than extending them automatically.

## QA data and safeguards

- Processing report counts **regions**, not distinct food products. withoutPack, ambiguousPrice and unreadable are triage dimensions; they can overlap.
- The importer never guesses a product, pack amount, price or brand from generic commodity knowledge. It does not treat deposit, UVP, discount percentages, displayed litre quantities or original prices as sale prices.
- Even a single positive printed price is only a **price proposal** if the product-price region is not clear.
- Existing read-only draft visibility for other signed-in accounts remains distinct from **verified, published** prices.
- Keep source files private, don't expose OCR, reviewers or original evidence to shopper accounts, and don't automatically claim source-use rights.
- These tests are regression examples, not a validated 100% product-recall score. An independently labeled collection of **whole pages** would be needed to quantify missing-food rates.

## Running tests for every change

    cd source
    python -m unittest discover -s tests -p 'test_*.py'
    pnpm test
    node scripts/test-german-db.mjs
    pnpm exec tsc --noEmit
    pnpm run build:pages --out ../.ci-pages

The existing GitHub Actions workflows already run the application/database/Python checks and the pinned real-PDF regression. New weekly uploads use the same parser automatically; no hardcoded 2026-W44 offer is needed.
