# Image-first German flyer proposals

Status: implemented behind an explicit opt-in, **not validated against a live
vision service**. This does not yet establish complete recognition or remove
the operator's original-page review. No production data has been reprocessed.

## Processing

The existing PDF-link/upload entry point and central queue remain in use.
`german_flyer_vision.py` discovers grocery regions on a 2400-pixel page image,
then independently reads each region at up to 2200 pixels. It does not rely on
PDF text order or require a good text layer. Full-page context locates products;
cropped images expose small print, quantities and distinct app price badges.

Standard/app offers, pack sizes, variants and multi-buy totals are distinct
proposals. Unit prices are checked against printed size and price where
supported. A contradiction removes the proposed sale price instead of inventing
a correction. Catalogue categories are constrained to existing Basket entries;
unknown categories remain open for review. Every candidate retains its PDF crop,
printed evidence, conditions, dates and unresolved questions. No model output
sets human verification or publication permission.

Unresolved page coverage, invalid coordinates, incomplete responses and service
errors fail the page. They never silently fall back to geometry. Existing done
checkpoints are deliberately retained: enabling vision does not reprocess a
previously completed import. To evaluate it, submit a separate test import;
do not delete reviewed work or publish model proposals in bulk.

## Enable only after configuring access

In the repository's Actions settings:

- Secret `OPENAI_API_KEY`: an API key entered by the account owner. Never put it
  in chat, repository files, frontend configuration or workflow logs.
- Variable `FLYER_VISION_MODEL`: an available model supporting image input and
  Responses structured JSON output. No model is silently selected.
- Variable `FLYER_RECOGNITION`: `vision` to enable; absent/`geometry` keeps the
  existing free parser. A key alone does not enable paid calls.
- Variable `FLYER_VISION_MAX_CALLS`: positive integer, default 200, maximum 2000,
  per runner invocation. One discovery call per page plus one read per region.
  A 43-page flyer can exceed 200 calls. The call limit is not a monetary cap;
  use the provider's project budget as well. An exhausted limit stops the run.

Long pages renew the existing worker lease between calls. The vision client also
stops starting new calls after 45 minutes, before the job's 55-minute hard timeout.
An interrupted import retains finished pages but needs an explicit retry; the
incomplete page is read again, which can incur repeated calls.

Only the backend queue receives the secret. Image requests go to the fixed
OpenAI Responses endpoint with `store: false`. Each request is bounded and has
a timeout; no retries hide repeated charges. API error bodies, images and
extracted names are never printed. A runtime call limit and page checkpoints
make interruption visible rather than claiming successful completion.

For local evaluation, set the same environment variables and run the existing
`process-german-flyers.py --pdf FILE --out PRIVATE_DIR --from YYYY-MM-DD
--until YYYY-MM-DD` entry point. Its output includes private page images and
analysis JSON: do not commit those files or upload them as CI artifacts.

## Validation boundary

`test_german_vision.py` exercises mocked Responses transport, the normal/app
and adjacent-product case, invalid dates/coordinates, missing conditions,
unit-price contradictions, unknown categories, refusal and call budgets. These
tests verify handling of supplied outputs, **not model recognition accuracy**.

Before activation for routine use, run actual PENNY, REWE and ALDI PDFs and
compare every offer against independently labelled original pages. Count
missing products, wrong product-price pairs, incorrect pack sizes, incorrect
conditions and category mistakes separately. A page marked done or a high
candidate count does not prove recall. Small-crop recognition can still miss
products, confuse price roles or misread fine print; no 100% guarantee is made.

For a first comparison on the existing 19 labelled REWE/ALDI development regions,
run `check-german-reference.py --pdf-dir PRIVATE_FIXTURES --out PRIVATE_REPORT`
and repeat with `--vision` after configuring access. This uses the same labels,
reports wrong product-price pairs and misses, and does not run paid recognition
in CI. This small development sample is insufficient for general accuracy claims.

The current workflow still requires dates and operator review. A fully
hands-off "send only a link" experience also needs validated date/region
discovery, a representative recognition benchmark and a considered publication
policy. This change supplies the image-reading stage, not that whole promise.

API contract references: [image inputs](https://developers.openai.com/api/docs/guides/images-vision)
and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
