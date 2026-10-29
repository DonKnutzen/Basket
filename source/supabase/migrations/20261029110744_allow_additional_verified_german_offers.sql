-- Allow additional reviewed offers after first publication. Existing snapshots stay immutable.
-- Operator checks, privileges, locks, revision checks and all-page validation are retained.

create or replace function basket_private.offer_import_confirm(target uuid, rights text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform basket_private.require_offer_operator();
 if length(trim(rights))<10 or length(rights)>2000 then raise exception 'Document source/reuse permission'; end if;
 update public.german_offer_imports set rights_note=rights,rights_confirmed=true,dates_confirmed=true,revision=revision+1
 where id=target and status in ('review','published');
 if not found then raise exception 'Import not ready'; end if;
end $$;

create or replace function basket_private.offer_candidate_review(target uuid, expected_revision integer, fields jsonb, decision text) returns void
language plpgsql security definer set search_path='' as $$
declare operator_id uuid:=basket_private.require_offer_operator(); c public.german_offer_candidates; r public.german_offer_imports;
begin
 -- Consistent lock order with publishing: import, then candidate.
 select i.* into strict r from public.german_offer_imports i join public.german_offer_candidates x on x.import_id=i.id where x.id=target for update of i;
 if r.status not in ('review','published') then raise exception 'Import not ready for review'; end if;
 select * into strict c from public.german_offer_candidates where id=target for update;
 if exists(select 1 from public.german_published_offers where id=target) then raise exception 'Offer already published; snapshot is immutable'; end if;
 if c.revision<>expected_revision then raise exception 'This entry was changed; reload it'; end if;
 if decision not in ('verified','rejected','review') then raise exception 'Invalid decision'; end if;
 if decision='verified' and (
 length(trim(coalesce(fields->>'name','')))<2 or length(fields->>'name')>250 or
 length(trim(coalesce(fields->>'category','')))<2 or length(fields->>'category')>100 or
 coalesce(fields->>'priceCents','')!~'^[0-9]{1,6}$' or
 (fields->>'priceCents')::integer not between 1 and 250000 or
 (fields->>'minQuantity')::integer not between 1 and 1000 or
 fields->>'priceKind' not in ('standard','multi','from','loyalty','tiered') or
 (fields->>'priceKind'<>'standard' and length(trim(coalesce(fields->>'conditions','')))<3) or
 (fields->>'priceKind'='multi' and (fields->>'minQuantity')::integer<2) or
 (fields->>'validFrom')::date<r.valid_from or (fields->>'validUntil')::date>r.valid_until or
 (fields->>'validUntil')::date<(fields->>'validFrom')::date or
 fields->>'validFrom' is null or fields->>'validUntil' is null or fields->>'minQuantity' is null or fields->>'priceKind' is null
 ) then raise exception 'Check product, price, quantity, dates and conditions'; end if;
 if length(fields::text)>10000 then raise exception 'Entry too large'; end if;
 -- Only reviewed product fields can enter public snapshots; internal evidence is retained separately.
 update public.german_offer_candidates set data=jsonb_build_object(
 'name',fields->>'name','brand',coalesce(fields->>'brand',''),'variant',coalesce(fields->>'variant',''),
 'category',fields->>'category','packSize',coalesce(fields->>'packSize',''),
 'priceCents',(fields->>'priceCents')::integer,'currency','EUR',
 'basePrice',coalesce(fields->>'basePrice',''),'regularPrice',coalesce(fields->>'regularPrice',''),
 'conditions',coalesce(fields->>'conditions',''),'priceKind',fields->>'priceKind',
 'minQuantity',(fields->>'minQuantity')::integer,'validFrom',fields->>'validFrom','validUntil',fields->>'validUntil'),
 status=decision,reviewed_by=case when decision='verified' then operator_id end,
 reviewed_at=case when decision='verified' then now() end,revision=revision+1 where id=target;
 update public.german_offer_imports set revision=revision+1 where id=r.id;
end $$;

create or replace function basket_private.offer_import_publish(target uuid, expected_revision integer) returns integer
language plpgsql security definer set search_path='' as $$
declare r public.german_offer_imports; n integer;
begin
 perform basket_private.require_offer_operator();
 select * into strict r from public.german_offer_imports where id=target for update;
 if r.status not in ('review','published') or r.revision<>expected_revision or not r.rights_confirmed or not r.dates_confirmed then raise exception 'Confirm source rights, dates and latest review'; end if;
 if r.total_pages is null or (select count(*) from public.german_offer_pages where import_id=target and status='done')<>r.total_pages
 or exists(select 1 from public.german_offer_pages where import_id=target and status='failed') then raise exception 'Process every page before publishing'; end if;
 if r.valid_until<(now() at time zone 'Europe/Berlin')::date then raise exception 'Flyer expired'; end if;
 insert into public.german_published_offers(id,import_id,retailer,region,market_id,valid_from,valid_until,data)
 select c.id,target,r.retailer,r.region,r.market_id,(c.data->>'validFrom')::date,(c.data->>'validUntil')::date,
 c.data||jsonb_build_object('originalName',coalesce(c.original_data->>'name',c.data->>'name'),'normalizedName',lower(c.data->>'category'),
 'id',c.id,'importId',target,'retailer',r.retailer,'region',r.region,'marketId',r.market_id,
 'page',c.page,'bbox',c.bbox,'sourceUrl',case when r.source_available then r.source_url else '' end,
 'sourceStatus',case when r.source_available then 'checked-at-import' else 'unavailable' end,
 'sourceCheckedAt',r.source_checked_at,'sourceFilename',r.filename,'validationStatus','verified')
 from public.german_offer_candidates c where c.import_id=target and c.status='verified' and c.reviewed_by is not null
 and not exists(select 1 from public.german_published_offers p where p.id=c.id);
 select count(*) into n from public.german_published_offers where import_id=target;
 if n=0 then raise exception 'No reviewed offers to publish'; end if;
 update public.german_offer_imports set status='published',published_at=coalesce(published_at,now()) where id=target;
 return n;
end $$;

create or replace function basket_private.offer_candidate_add(target uuid,page_number integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; r public.german_offer_imports; p public.german_offer_pages;
begin
 perform basket_private.require_offer_operator();
 select * into strict r from public.german_offer_imports where id=target for update;
 if r.status not in ('review','published') then raise exception 'Import not ready'; end if;
 select * into strict p from public.german_offer_pages where import_id=target and page=page_number and status='done';
 insert into public.german_offer_candidates(import_id,page,local_key,bbox,crop_key,data,issues)
 values(target,page_number,gen_random_uuid()::text,jsonb_build_array(0,0,p.width,p.height),p.image_key,
 jsonb_build_object('name','','brand','','category','','packSize','','priceCents',0,'currency','EUR','priceKind','standard','minQuantity',1,'conditions','','validFrom',r.valid_from,'validUntil',r.valid_until),
 '["Manuell anhand der Originalseite ergänzen"]') returning id into result;
 update public.german_offer_imports set revision=revision+1 where id=target;
 return result;
end $$;
