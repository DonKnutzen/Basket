# Central German flyer imports — Kiel

This supersedes the experimental **German** publishing and browser-local import paths described in `PRIVATE_FLYER_IMPORT.md`. Canada, receipts, personal price history and household storage are unchanged. Existing ALDI structured-source and REWE source-configuration parsers remain available as diagnostics and retain their tests. Their workflows no longer commit unreviewed German prices. The German shopping-list UI consumes only the central reviewed publication table.

## Operating the import

1. Sign in with a verified Supabase email account explicitly listed in `german_offer_operators`. This is a server-managed allowlist, independent of household ownership and user-editable profile metadata.
2. Select Germany / Kiel under Weekly offers. Open **Prospekte verwalten · Betreiberbereich**. Ordinary accounts cannot see this control or access its data.
3. Choose REWE Holtenauer Straße 69–71, market **561204**, or **ALDI Nord, region Kiel**. Enter the outer date range printed in the supplied flyer. A public original PDF URL is optional; a filename and a private, checksum-verified original always document provenance.
4. Upload the PDF. Files up to **250 MiB / 1,000 pages** are supported. Incremental SHA-256 and **8 MiB chunks** bound upload memory; reselecting the same file resumes missing chunks and returns the same import ID. Storage verifies the operator account and accepts new chunks only while the import is uploading. Each transfer has a separate 120-second timeout; household requests keep their existing deadlines.
5. The main-branch GitHub workflow checks the queue approximately every 15 minutes. Scheduled Actions can be delayed. Each page has a durable success/failure checkpoint; completed pages are skipped after a crash or retry. A worker lease prevents concurrent ownership. No PDF, crop or extracted text is uploaded as a workflow artifact or committed to Git.
6. Review the original crop beside each editable product. Brand, full name, variant, category, sizes, total selling price, unit-price text, comparison price, conditions, price type, minimum quantity and individual dates are editable. The existing product catalogue suggests categories. Missing products can be added against a private full-page image. Do not confirm a category which actually describes a different prepared food.
7. Confirm each correct entry against the original. **Every algorithmic proposal requires review.** No confidence score authorizes publication. An unresolved tile remains `review` or `unreadable`; it cannot enter the public feed. Reject irrelevant regions explicitly.
8. Document source/reuse permission and confirm dates before publishing. These are required server-side, not just checkboxes in the client. Uploading a PDF does not supply a reuse licence. All pages must have completed successfully; all selected entries must be human-verified. Review revisions prevent lost edits. One database transaction creates immutable price snapshots; failures preserve all previously published imports.
9. The client verifies the consumer query after publication, reports the number visible today, and refreshes existing shopping lists. Future-dated entries become visible on their actual start date. This data path does not depend on a GitHub Pages rebuild or GitHub Raw CDN.

## Recognition and validation

`scripts/german_flyer_layout.py` uses PyMuPDF text boxes, font sizes, vector rectangles and rounded backgrounds. It filters invisible drawing metadata (including Publitas JSON), separates actual printed unit prices, old prices, deposits and bonus-credit amounts, and combines spatially aligned split Euro/cent glyphs, including overlapping font boxes. Whitespace cuts and repeated badge grids supply tentative regions when a printed panel is absent. Product and price evidence stays inside a proposed region. Multiple sale prices are not silently resolved by proximity: the proposed selling price remains unknown. Ambiguous multi-product regions can also require manual splitting or entry.

Tesseract with German/English language data processes pages with a missing or unusable text layer. Failure is recorded against the page and blocks publication. The worker processes and renders one page at a time into temporary disk files. Private crops and page images are at most 1,700 pixels along their longest edge. Original positions are stored in PDF points.

Printed date ranges are suggestions requiring confirmation. The year may come from the operator's import range and is labelled accordingly. The ALDI holiday example is **26–30 October 2026**, not a guessed Saturday end date. The operator must resolve sub-week actions and dates printed only on other pages.

Known brands are assigned only when their text occurs in the region. Unknown or multiple brands require correction. All remaining original product words, sizes and alternatives stay in the proposal rather than collapsing to a category. Arithmetic checks compare an explicit unit price against an unambiguous size; they never invent a missing current selling price. Multi-buy totals remain totals, and the derived per-item price is labelled with its purchase quantity. Bonus/app/step-price proposals are conservative and need explicit checking of the exact conditions.

## Storage and authorization

The existing Supabase project contains `german_offer_imports`, `german_offer_pages`, `german_offer_candidates`, `german_published_offers` and the operator allowlist. Original extracted data is retained separately from edits. These are advertised offers, not purchases: none of these functions writes to the existing receipt, product-history, budget, account or household tables.

All tables have RLS. Normal authenticated accounts can read only date-valid publication snapshots; no raw PDF bytes, crops, private source text, operator grants or draft rows are exposed. Storage bucket `german-flyers` is private. Operator write operations run through checked functions with fixed search paths. The privileged implementations are in a non-exposed schema; public wrappers are invokers and anonymous execution is revoked. Direct client writes to publication/status/reviewer fields are not granted.

The Edge Function `german-flyer-worker` intentionally has platform `verify_jwt=false` because it validates **GitHub's own signed OIDC workload token**. It checks issuer, audience, expiry, RS256 signature, immutable repository/owner IDs, `refs/heads/main`, and the exact queue workflow. Ordinary Supabase/browser tokens, unsigned tokens, other repositories and PR workflows are denied. The service key stays inside Supabase's function environment. No PAT or service-role key is needed in Actions or the frontend. Keep the workflow path, repository IDs and deployed policy in sync if the repository moves.

The queue worker rechecks active public source URLs daily. Only observed official hosts and the verified ALDI `cdn.ipaper.io` redirect are allowed; failed HEAD requests can fall back to a tiny ordinary GET range request. There is no protection bypass. A failed source check disables the link; the original filename/page provenance remains. Links use the original PDF URL and a visible page number, with no invented viewer fragment or product URL. Installed iOS views retain the existing copy-for-Safari behavior. The UI shows the actual source-check date.

References: [Supabase storage access policies](https://supabase.com/docs/guides/storage/security/access-control), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [GitHub OIDC claims and permissions](https://docs.github.com/en/actions/reference/security/oidc).

## Delivery and activation

The additive migration and gateway were deployed and the chosen confirmed operator account was granted access during this implementation. No real offers were publicly published, and no source/reuse permission was assumed. The frontend and queue workflow must be on `main` before the operator flow is live: Pages publishes the generated root HTML from `main`, and the gateway deliberately refuses worker tokens from feature/PR branches. Merge the reviewed code, wait for Pages to serve the new HTML, then trigger **Central German flyer queue** once to verify real workload identity and an empty queue before the first upload.

The existing project is reused; no extra database/project or paid OCR service is created. GitHub-hosted runner and Supabase storage/egress quotas still apply. The 8 MiB parts avoid individual-file limits, not overall storage capacity. Large retained brochures will eventually fill storage: monitor capacity and choose a retention policy before ongoing weekly use. This version does not silently purge historical originals.

## Reproducible checks and measured limits

From `source/`:

```sh
pnpm install --frozen-lockfile
pnpm test
node scripts/test-german-db.mjs
python -m unittest discover -s tests -p 'test_*.py'
pnpm exec tsc --noEmit
pnpm run build:pages --out ..
pnpm run build
```

The new CI workflow also checks/tests the Deno gateway policy. The embedded PostgreSQL test executes the actual deployment migration and checks operator isolation, private storage, incomplete upload rejection, exclusive leases, optimistic review, required rights/dates, all-page publication, exclusion of unreviewed candidates, atomicity, retry idempotency, snapshot immutability and Berlin-local expiry.

For private real-PDF verification install `scripts/flyer_requirements.txt` plus native `tesseract-ocr` and German language data, then:

```sh
python scripts/process-german-flyers.py --pdf /private/rewe-2026w44.pdf --out /private/rewe-analysis --from 2026-10-26 --until 2026-10-31
python scripts/process-german-flyers.py --pdf /private/aldi-nord-2026w44.pdf --out /private/aldi-analysis --from 2026-10-26 --until 2026-10-30
python scripts/check-german-reference.py --pdf-dir /private --out /private/metrics.json
```

The small reference manifest records source SHA-256 hashes and manually checked facts, not source PDFs or complete brochure text. The PDF downloader/worker never automatically discovers new retailer sources.

Measured locally on 28 October 2026:

| Check | Actual result |
| --- | --- |
| Application / Canadian / receipt / household tests | 109 passed |
| PostgreSQL integration | 24 checks passed |
| Python config + geometry tests | 10 passed |
| Gateway cryptographic identity test | Passed, including forged tokens and wrong repo/ref/workflow |
| TypeScript; Pages build; framework build | Passed |
| New files lint | Passed |
| Full repository lint | Failed on existing files/rules; not claimed green |
| REWE supplied week-44 PDF, 25,035,706 bytes | All 28 pages processed; 231 tentative review regions |
| ALDI Nord week-44 PDF, 120,879,735 bytes | 48/49 pages processed locally; 319 tentative review regions; page 44 requires missing local native Tesseract |
| Labelled REWE development sample, page 13 | 8/9 names, brands, quantities and correct product-price pairs; Müller Grießpudding region unresolved |
| Labelled ALDI development sample, page 8 | 10/10 names, brands, quantities and correct product-price pairs |
| Wrong product-price pairs within recognized labelled regions | 0/18; **not a whole-flyer accuracy estimate** |
| Automatic publication of algorithmic proposals | None; all require human review |
| Browser visual QA | Chromium at 390 px, light/dark cards; editable operator fields, private crop, no horizontal overflow |
| Live security smoke test | Gateway returned 401 without a token and 403 for a forged token; bucket private; operator confirmed; no new database security advisor findings |

The 19-region sample was used during development and is not a held-out or statistically representative benchmark. Total review-region counts are not product recall. Whole-brochure false assignments, missed products, OCR precision and variant extraction have **not** been comprehensively labelled. There is no measured production false-publication rate: no real publication occurred.

Outstanding acceptance checks: complete native OCR on ALDI page 44; a real signed-in operator upload → GitHub OIDC worker → review → authorized publication → independent shopper session; actual Pages deployment content; and physical Safari/iOS navigation. Mock visual data and signed-token unit tests do not establish that complete production round trip. Keep these limits visible until those checks have run.
