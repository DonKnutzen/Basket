# Basket

Public app: https://donknutzen.github.io/Basket/

This is Basket’s own repository. GitHub Pages serves `main:/docs`; the Basket API stays on its existing backend. Run `npm ci` and `npm run build:pages`, then commit the updated `docs/` assets to publish frontend changes.

An English mobile-first shopping app with shared household lists, on-device receipt OCR, a review step, product-price history, and spending by month, category and store.

## Runtime

Vinext / React, Cloudflare D1 (`DB`) and R2 (`BUCKET`). Supabase email/password authentication reuses the existing Pokémon project without creating another Supabase project. Every API request verifies the access token with Supabase Auth and rejects unconfirmed or anonymous users. Previous ChatGPT sign-in remains an explicit fallback for existing shopping data. Every record mutation checks household membership. No paid AI APIs are used. Tesseract.js and English/French language models are self-hosted; images are recognized on the device and uploaded only after confirmation. OCR accuracy varies and all results require review. Historical prices are not live supermarket prices.

## Development

Install dependencies through the Sites dependency helper. `pnpm test` runs 26 receipt-parser, authentication, household, receipt-photo access, CORS and shared-budget tests against SQLite with mocked identity and bindings. `pnpm build` prepares OCR assets and builds the Worker. Apply Drizzle migrations to the local preview database before authenticated local API testing. Deploy through the Sites workflow.

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
