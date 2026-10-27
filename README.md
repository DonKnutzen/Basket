# Basket

App: https://donknutzen.github.io/Basket/

Independent GitHub Pages frontend with shared shopping lists, receipt scanning, product-price history and household budgets. Mobile lists open directly to list controls and item entry. Profile settings offer three locally saved text sizes. Account forms require at least six characters for a new password.

## Source and updates

Authored application code is in `source/`. From that directory, install dependencies with `pnpm install --frozen-lockfile` and run `pnpm run build:pages --out ..`. Commit the updated root `index.html` and `account-complete.html` along with source changes. GitHub Pages publishes `main` from `/ (root)`.

## Backend and accounts

The existing API remains at https://basket-together.airychime12.chatgpt.site and verifies Supabase identity plus household membership. Source also contains that Worker and its migrations. GitHub Pages hosts the frontend only. No third Supabase project is created. No private account credentials, household records or receipt photos are in this repository.

A signed-out visitor can open the sign-in screen without first contacting the household API. A signed-in household still requires a working connection to that API. On-device OCR requires review before saving. Prices reflect saved receipts, not live store prices.

Preserve Supabase redirects for https://donknutzen.github.io/Basket/account-complete.html and the existing backend callback. Confirmation-mail delivery and a real registration/recovery round trip still need end-to-end verification.

## Shared households and lists

The active household and the other members are shown on every app screen. All lists belong to the active household and are automatically visible and editable by its members; there is no separate per-list sharing toggle. Use **Shared list** to create another list in a shared household. The creation dialog states who it is shared with. A one-person household shows **Only you** and an invitation entry point. Joining another household keeps the previous household; use the switcher at the top of household settings to choose which one is active.

Local API tests verify two separately authenticated email users joining the same household, creating lists from either account, seeing and checking the same items, and switching back without exposing data to unrelated households.

