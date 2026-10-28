# Basket

Public app: https://donknutzen.github.io/Basket/

This is Basket’s own repository. GitHub Pages serves `main:/docs`; the Basket API stays on its existing backend. Run `npm ci` and `npm run build:pages`, then commit the updated `docs/` assets to publish frontend changes.

An English mobile-first shopping app with shared household lists, on-device receipt OCR, a review step, product-price history, and spending by month, category and store.

## Runtime

Vinext / React, Cloudflare D1 (`DB`) and R2 (`BUCKET`). Supabase email/password authentication reuses the existing Pokémon project without creating another Supabase project. Every API request verifies the access token with Supabase Auth and rejects unconfirmed or anonymous users. Previous ChatGPT sign-in remains an explicit fallback for existing shopping data. Every record mutation checks household membership. No paid AI APIs are used. Tesseract.js and English/French language models are self-hosted; images are recognized on the device and uploaded only after confirmation. OCR accuracy varies and all results require review. Historical prices are not live supermarket prices.

## Development

Install dependencies through the Sites dependency helper. `pnpm test` runs 30 receipt-parser, authentication, household, receipt-photo access, CORS and shared-budget tests against SQLite with mocked identity and bindings. `pnpm build` prepares OCR assets and builds the Worker. Apply Drizzle migrations to the local preview database before authenticated local API testing. Deploy through the Sites workflow.

Changes refresh every 3 seconds while visible. An internet connection is required; this version is an installable mobile web app, not a native App Store package. Demo data is explicitly labeled and never stored in a signed-in household.

## Household sharing

The sign-in page is public. Household data requires a verified email account and household invitation. App invitations are random, hashed in storage and expire after seven days. Joining preserves the previous household and allows switching back.

## Receipts and prices

Every receipt must balance: reviewed line totals plus tax equal its total. Discounts must be applied to affected line totals; deposits and fees can be separate lines. Quantities represent pack counts, and pack size is recorded separately. Brands and pack sizes should be kept consistent. Currencies are never combined. Confirmed receipt abbreviations are learned per store, with ambiguous same-receipt labels excluded.

## Email setup and cross-app accounts

Email and password plus signup confirmation were confirmed enabled in the existing project. Basket uses a separate browser storage key (`basket-auth`) and per-request server clients, with only the publishable key exposed to the browser. No Supabase tables, keys, email templates, SMTP settings, or existing app login data were changed.

Before opening registration to other visitors, add `https://basket-together.airychime12.chatgpt.site/account-complete` to Supabase Authentication → URL Configuration → Redirect URLs. Preserve the existing Site URL and every existing redirect. Verify SMTP delivery to non-team addresses. Supabase's default mail service only sends to project-team addresses and is rate-limited; use an existing suitable SMTP service for partner registration. Never disable email confirmation to work around delivery. The Supabase administrative browser flow was blocked at its GitHub sign-in step, so the redirect allowlist and SMTP configuration remain unverified.

Sharing a Supabase project shares its Auth user pool and project-level limits/settings; it does not merge the Pokémon username/PIN account model with Basket's email login. No migration of existing Pokémon or language-app accounts has been performed. Basket's shopping data remains in its own D1 database and receipt images in its own R2 bucket, so all household authorization is enforced in the Basket API rather than exposed through Supabase's Data API.

A verified email user with a concurrent original ChatGPT sign-in can explicitly connect previous shopping data. That action copies household memberships, changes owned-household ownership to the verified email account, and selects the previous household without removing existing records or the previous identity's membership.

## Shared budgets

Overall and category budgets are keyed by household, calendar month and currency. Any household member can see or update them. Overall spending includes recorded tax and fees; category spending uses matching line totals before tax. Different months and currencies never mix. Budget deletion does not delete receipts. Budgets do not automatically repeat into the next month.

## Verification limits

Automated tests cover authentication and household boundaries, proof of both identities for connecting previous data, budget sharing and arithmetic, and receipt-photo access. No real user was created and no confirmation email was sent during testing. The administrative email configuration and a real signup/confirmation/password-recovery round trip still require verification. Managed browser preview infrastructure is currently unavailable in this workspace.

## GitHub Pages front end

The public static front end is built into `docs/` with `npm run build:pages` for `/Basket/` and uses the existing public Basket Worker API for household data and receipt images. It contains only public Supabase connection details; passwords are sent directly to Supabase Auth. The Worker permits CORS only for its own origin and `https://donknutzen.github.io`; API access still requires a remotely verified user and household membership. No account credentials, receipts, real shopping records or service-role keys are committed to GitHub.

The Pages build is self-contained except for pinned Tesseract.js OCR worker/core and language assets fetched on demand from their public distribution hosts. Receipt recognition still runs in the browser; the photo is not sent to those hosts. The network-only service worker does not cache private account data.

Registration settings are now read at `/api/account-config`, with `/api/auth/config` retained as a compatibility alias. The primary email callback is `/account-complete` on the Worker site and `account-complete.html` within the Pages directory. Allow both `https://basket-together.airychime12.chatgpt.site/account-complete` and `https://donknutzen.github.io/Basket/account-complete.html` in Supabase's redirect allowlist before a complete email-confirmation/reset round trip can be verified.

The source audit confirmed two existing Supabase projects: Language Suite uses `ufuwxtshfoqiddvyptgn` with email autoconfirm currently enabled, while Pokémon and Basket use `wrmlkpuhyqxkehbvzoxx` with email confirmation enabled. The connected management account is not authorized to administer the language project. No accounts, progress, keys or project settings were migrated or removed, and no additional project or paid resource was created. Consolidation into one project remains blocked on access to the language project's auth/data administration and a preservation plan for existing users.

## Receipt camera and purchase notes

Take receipt photo beneath the shopping list opens the rear-camera capture input and starts on-device OCR after selection. The browser controls whether a camera or file picker is offered. Review and confirm all recognized items and totals before saving. In the review, choose a list and correct each On the list / Additional purchase / Not sure classification. Exact normalized names are suggestions, not a claim that a mismatched receipt abbreviation was unplanned. Open list items are never scored, cleared or labeled forgotten.

Saved receipts retain the chosen list name and additional purchases as a snapshot, shared with the household. First recorded purchases are based on the household price book when the receipt is saved; they do not claim a product has never been bought before. Versioned metadata uses the existing receipts.raw_text column, retaining OCR text without a schema migration. Legacy receipts have no retroactive comparison.

## Product icons

Product icons use small local SVG illustrations, whole-word and phrase matching for English product descriptions, and shared household corrections. Specific phrases distinguish almond milk from almonds, cream cheese from cream, while preparation words such as pickled or marinated keep the same underlying ginger icon. No external image API or paid AI service is needed. In the item editor, choose Item icon to remember a normalized item-name mapping across the household’s lists and price book, or Automatic to remove the correction. This is deterministic recognition plus explicit remembered corrections, not automatic machine learning. Unknown items fall back to their category, then the basket. The item_icons table is a schema-only, additive migration.

## English and German

Profile → Language switches the interface between English and German and remembers the choice on this device. Dates and money formatting follow the interface language; currency and stored category keys do not change. Household names, lists, products, receipt labels and email addresses remain as entered. Suggestions change language. German and English food names, preparation words, common beverage brands and herbs use the same coloured SVG icon system. Explicit household icon corrections still take precedence. Receipt OCR offers English, German, English + German and English + French. Recognition and review still run on the device; translations and icons need no paid API.

Seeds/kernels, cooking oils and spices/seasonings have their own coloured SVG illustrations and remembered icon choices. English and German aliases include sunflower and pumpkin seeds, sesame/chia/flax/hemp, common cooking oils and spice blends. Specific phrases distinguish sunflower seed oil from sunflower seeds and curry leaves from curry powder. Existing household icon corrections take priority.

Household products have distinct coloured SVG icons for sponges, toilet paper, paper towels, toothpaste, toothbrushes, tissues, trash bags, dish soap, laundry detergent, cleaning sprays, shampoo, deodorant, cleaning cloths and food wrap. Shared German/English aliases drive both icon and category recognition, including umlauts, common ASCII spellings and plurals. Product type takes precedence over scents such as lemon or coconut; explicit household icon corrections still take priority. No migration or external image service is required.

Drinks also have separate bilingual illustrations: a red cola can, a slim blue/silver energy-drink can, wine, beer/cider, sparkling wine, water, juice, soft drinks and spirits. Specific phrases distinguish sparkling water from sparkling wine, ginger beer from alcoholic beer, and wine vinegar from wine. All drink icons remain grouped under Drinks and support shared household corrections.

## Bilingual supermarket catalogue

A local catalogue covers 468 requested supermarket articles, with German/English names and synonyms. Exact catalogue names take precedence, while more specific phrases, established drink/household recognition and saved icon corrections are retained for descriptions. Recognition does not rewrite item names or merge stored products. Food groups use the catalogue so baby oil is a household item, frozen spinach stays frozen, and fresh versus canned foods can be distinguished. Additional filled SVG illustrations cover household/hygiene, baby/pet supplies and miscellaneous supermarket goods. Catalogue results are tested for every German name, English name and listed synonym. Unknown names retain the existing category fallback and manual icon editor.

### Session renewal and mobile resume

Household reads share one in-flight request. A slow token renewal must not be superseded by the three-second polling interval: previously that could discard the initial result and leave the splash screen loading forever. Every completed read now settles loading; cancelled reads cannot apply stale success or unauthorized results. Session checks and network calls have deadlines, and a suspended, overdue request is replaced when the app resumes. Visibility, pageshow, focus, connectivity and token events trigger another read. Transient failures retain the current household and do not revoke sessions.

`node scripts/test.mjs` includes deterministic session lifecycle tests: delayed renewal with overlapping polls, stalled response bodies, expired/revoked sessions, cancellation, and resuming after suspended timers. These use synthetic sessions and never sign out real accounts. For manual iPhone verification, open Basket from the Home Screen, leave it in the background beyond the access-token lifetime, then resume it with and without connectivity. A successful renewal should show the list; an ended session should show sign-in; a stalled connection should show a retryable error within 20 seconds. Exact iPhone hardware behaviour still requires this device check.

## Personal historical price book (section 15)

Purchase dates are extracted independently of the scan date. ISO, day-first dotted dates, unambiguous slash dates and German/English/French month names are supported. German retailer/location evidence can resolve day-first dates; Canada alone does **not** resolve `04/05/2026`. Explicit printed DD/MM/YYYY or MM/DD/YYYY hints are used. Conflicting, missing or invalid dates require manual selection in the scanner. The API rejects unresolved date evidence and preserves the confirmed calendar date without a time. Existing receipts retain their original dates; missing historical evidence is not reconstructed.

Each confirmed position remains a separate append-only observation linked to its receipt. Migration `0003_personal_prices.sql` adds country/branch/date evidence and optional line evidence without rewriting old prices. Product identities retain pack size, known brand, variant and quality. An exact bilingual catalogue match can normalize product names; unknown abbreviations stay unchanged. The review offers optional measured totals and units, evidenced regular line totals, discounts and offer status. Paid line totals already include item discounts and are never reduced a second time. Separately recorded receipt tax is not arbitrarily allocated to product prices. Normal versus advertised versus evidenced reduced versus unknown prices remain distinct.

Unit conversion uses integer fixed-point amounts and rational BigInt arithmetic, including exactly 0.45359237 kg/lb. Known pack sizes multiply by pack count; an explicit measured total takes precedence. Price display rounds only after conversion. Historical comparisons require the same normalized product, known/unknown brand, variant, quality, country, currency and measurement dimension. Unknown pack sizes compare only within one recorded product identity. They are not treated as kilograms or litres. Price details show each store's latest observation, the cheapest historical observation, a quantity-weighted average and all chronological records, including receipt IDs and discount evidence. Shopping tiles show the latest observed variant, store and date; prices do not claim current availability.

Repeated OCR text with the same store/date/currency/total is detected across new scan IDs within one household, backed by a unique database index. This is conservative exact normalized-text detection, not visual near-duplicate recognition. Two genuinely separate purchases with identical text may require receipt review; manual entries without OCR text only use receipt ID idempotency. Deleting an erroneous receipt also removes its observations. Corrections are reviewed before saving; this change does not add editing of already saved receipts.

Validation: TypeScript and the production Worker build pass. Eleven new synthetic tests cover international/ambiguous dates, unit conversion, variant/currency isolation, weighted averaging, discount evidence, successive history, duplicates and server rejection. The complete suite has 61 passing tests and six failures in pre-existing icon/group expectations; the unchanged base commit has the same six failures (50 passing). The real-photo OCR accuracy and near-duplicate detection have not been established by these tests. Advanced discount/brand/variant evidence is manually reviewable; broad automatic multi-line discount extraction and the full OCR overhaul in sections 1–14 remain separate work.

Deployment order: apply the additive D1 migration, then deploy the API and rebuild/deploy the front end. The new API queries require the new columns. Do not publish a front end against an unmigrated API. No production database or real receipt was modified during this work.
