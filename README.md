# Basket

English mobile-first shared shopping lists, receipts, product prices and household budgets.

**Open the app: https://donknutzen.github.io/Basket/**

This is Basket’s independent GitHub Pages repository. It is separate from A1-Language-Suite and Pokemon-Guide.

## Hosting

GitHub Pages serves the static frontend from the root of `main`. `index.html` contains the compiled frontend; `account-complete.html` handles account email links. No private credentials or household records are included.

The existing Basket API remains at https://basket-together.airychime12.chatgpt.site. It verifies Supabase accounts and household membership. GitHub Pages cannot execute the backend or store private receipt photos. Basket reuses the existing Supabase project and creates no third project.

## Account email callbacks

Preserve existing Supabase redirects and allow https://donknutzen.github.io/Basket/account-complete.html for confirmation and password recovery. Email delivery and redirects still need a complete end-to-end verification.

## Receipts

On-device OCR loads free pinned Tesseract assets on demand. Users review recognized items before saving. Receipt prices are historical purchases, not live supermarket prices.
