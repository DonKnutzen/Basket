-- Extend the existing reviewed German flyer pipeline to PENNY in Kiel.
-- No changes to household/receipt tables, authentication, published-date RLS,
-- operator privileges, source evidence privacy, or the Canadian feeds.
-- PENNY is a regional flyer, not a verified individual branch.
begin;
alter table public.german_offer_imports
 drop constraint german_offer_imports_retailer_check,
 add constraint german_offer_imports_retailer_check
 check(retailer in ('rewe','aldi-nord','penny'));

alter table public.german_offer_imports
 drop constraint german_offer_imports_check1,
 add constraint german_offer_imports_check1
 check((retailer='rewe' and market_id='561204')
       or (retailer in ('aldi-nord','penny') and market_id is null));

alter table public.german_published_offers
 drop constraint german_published_offers_check,
 add constraint german_published_offers_check
 check(retailer in ('rewe','aldi-nord','penny')
       and region='Kiel' and valid_until>=valid_from);
commit;
