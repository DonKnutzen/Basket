-- Restricted PENNY test release: publish only operator-reviewed price facts.
-- No reuse permission is asserted; no PDF pages, OCR text or crops are published.
-- REWE/ALDI production publication and existing rights checks are unchanged.
create or replace function basket_private.offer_import_confirm_test_dates(target uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.german_offer_imports;
begin
  perform basket_private.require_offer_operator();
  select * into strict r from public.german_offer_imports where id=target for update;
  if r.retailer<>'penny' or r.region<>'Kiel' or r.status not in ('review','published') then
    raise exception 'Only completed PENNY Kiel review imports may be tested';
  end if;
  update public.german_offer_imports
     set dates_confirmed=true,revision=revision+1
   where id=target;
end $$;

create or replace function basket_private.offer_import_publish_test(target uuid, expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare r public.german_offer_imports; n integer;
begin
  perform basket_private.require_offer_operator();
  select * into strict r from public.german_offer_imports where id=target for update;
  if r.retailer<>'penny' or r.region<>'Kiel'
     or r.status not in ('review','published')
     or r.revision<>expected_revision or not r.dates_confirmed then
    raise exception 'PENNY pilot requires an operator and confirmed validity dates';
  end if;
  if r.total_pages is null
    or (select count(*) from public.german_offer_pages
        where import_id=target and status='done')<>r.total_pages
    or exists(select 1 from public.german_offer_pages
              where import_id=target and status='failed') then
    raise exception 'Every PDF page must be processed successfully';
  end if;
  if r.valid_until<(now() at time zone 'Europe/Berlin')::date then
    raise exception 'The PENNY brochure has expired';
  end if;
  -- The test release never accepts a parser draft or an unchecked region.
  -- Only small manually verified facts are added; published snapshots are immutable.
  insert into public.german_published_offers
    (id,import_id,retailer,region,market_id,valid_from,valid_until,data)
  select c.id,target,r.retailer,r.region,r.market_id,
         (c.data->>'validFrom')::date,(c.data->>'validUntil')::date,
         c.data||jsonb_build_object(
           'originalName',coalesce(c.original_data->>'name',c.data->>'name'),
           'normalizedName',lower(c.data->>'category'),
           'id',c.id,'importId',target,'retailer',r.retailer,'region',r.region,
           'marketId',r.market_id,'page',c.page,'bbox',c.bbox,
           'sourceUrl',case when r.source_available then r.source_url else '' end,
           'sourceStatus',case when r.source_available then 'checked-at-import' else 'unavailable' end,
           'sourceCheckedAt',r.source_checked_at,'sourceFilename',r.filename,
           'validationStatus','verified','testOnly',true)
    from public.german_offer_candidates c
   where c.import_id=target and c.status='verified'
     and c.reviewed_by is not null and c.reviewed_at is not null
     and c.data->>'currency'='EUR'
     and (c.data->>'validFrom')::date>=r.valid_from
     and (c.data->>'validUntil')::date<=r.valid_until
     and (c.data->>'validUntil')::date>=(now() at time zone 'Europe/Berlin')::date
     and (c.data->>'priceCents')::integer between 1 and 250000
     and not exists(select 1 from public.german_published_offers p where p.id=c.id);
  select count(*) into n from public.german_published_offers where import_id=target;
  if n=0 then raise exception 'No manually verified, current PENNY offers to test'; end if;
  update public.german_offer_imports
    set status='published',published_at=coalesce(published_at,now())
    where id=target;
  return n;
end $$;

create or replace function public.offer_import_confirm_test_dates(target uuid)
returns void language sql security invoker set search_path='' as $$
  select basket_private.offer_import_confirm_test_dates(target)
$$;
create or replace function public.offer_import_publish_test(target uuid, expected_revision integer)
returns integer language sql security invoker set search_path='' as $$
  select basket_private.offer_import_publish_test(target,expected_revision)
$$;
revoke all on function public.offer_import_confirm_test_dates(uuid) from public,anon;
revoke all on function public.offer_import_publish_test(uuid,integer) from public,anon;
revoke all on function basket_private.offer_import_confirm_test_dates(uuid) from public,anon;
revoke all on function basket_private.offer_import_publish_test(uuid,integer) from public,anon;
grant execute on function public.offer_import_confirm_test_dates(uuid) to authenticated;
grant execute on function public.offer_import_publish_test(uuid,integer) to authenticated;
grant execute on function basket_private.offer_import_confirm_test_dates(uuid) to authenticated;
grant execute on function basket_private.offer_import_publish_test(uuid,integer) to authenticated;