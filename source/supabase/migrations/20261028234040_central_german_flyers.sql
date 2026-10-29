-- Additive: no receipt, household, Canadian-feed or account schema changes.
create schema if not exists basket_private;
revoke all on schema basket_private from public;
grant usage on schema basket_private to authenticated;

create table public.german_offer_operators (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.german_offer_operators enable row level security;
grant select on public.german_offer_operators to authenticated;
create policy own_operator on public.german_offer_operators for select to authenticated
 using (user_id = (select auth.uid()));

create function basket_private.require_offer_operator() returns uuid
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists (
  select 1 from public.german_offer_operators o join auth.users u on u.id=o.user_id
  where o.user_id=auth.uid() and u.email_confirmed_at is not null
 ) then raise exception 'Operator access required' using errcode='42501'; end if;
 return auth.uid();
end $$;
revoke all on function basket_private.require_offer_operator() from public;

create table public.german_offer_imports (
 id uuid primary key default gen_random_uuid(), created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), retailer text not null check(retailer in ('rewe','aldi-nord')),
 region text not null default 'Kiel' check(region='Kiel'), market_id text,
 filename text not null check(length(filename) between 1 and 200),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), byte_size bigint not null check(byte_size between 1 and 262144000),
 chunk_count integer not null check(chunk_count between 1 and 32),
 source_url text not null default '', source_available boolean not null default false,
 source_checked_at timestamptz, rights_note text not null default '', rights_confirmed boolean not null default false,
 valid_from date not null, valid_until date not null, dates_confirmed boolean not null default false,
 status text not null default 'uploading' check(status in ('uploading','queued','processing','review','failed','published')),
 total_pages integer check(total_pages between 1 and 1000), error text, revision integer not null default 0,
 lease_until timestamptz, worker_run text,
 published_at timestamptz,
 check(valid_until>=valid_from and valid_until-valid_from<=62),
 check((retailer='rewe' and market_id='561204') or (retailer='aldi-nord' and market_id is null)),
 unique(retailer,region,sha256,valid_from,valid_until)
);
create table public.german_offer_pages (
 import_id uuid not null references public.german_offer_imports(id), page integer not null check(page>0),
 status text not null check(status in ('done','failed')), width real, height real,
 image_key text, ocr boolean not null default false, error text, candidates integer not null default 0, date_hints jsonb not null default '[]',
 primary key(import_id,page)
);
create table public.german_offer_candidates (
 id uuid primary key default gen_random_uuid(), import_id uuid not null references public.german_offer_imports(id),
 page integer not null, local_key text not null, bbox jsonb not null, crop_key text,
 data jsonb not null, original_data jsonb not null default '{}', issues jsonb not null default '[]',
 status text not null default 'review' check(status in ('review','unreadable','verified','rejected')),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 revision integer not null default 0,
 foreign key(import_id,page) references public.german_offer_pages(import_id,page),
 unique(import_id,page,local_key)
);
-- Immutable publication snapshots. Draft edits and failed jobs cannot affect them.
create table public.german_published_offers (
 id uuid primary key references public.german_offer_candidates(id), import_id uuid not null references public.german_offer_imports(id),
 retailer text not null, region text not null, market_id text,
 valid_from date not null, valid_until date not null, published_at timestamptz not null default now(),
 data jsonb not null,
 check(retailer in ('rewe','aldi-nord') and region='Kiel' and valid_until>=valid_from)
);
create index german_import_queue on public.german_offer_imports(status,created_at);
create index german_candidate_import on public.german_offer_candidates(import_id,page);
create index german_current_offers on public.german_published_offers(valid_until,valid_from,retailer);
create index german_operator_user on public.german_offer_imports(created_by);
create index german_reviewed_by on public.german_offer_candidates(reviewed_by);

alter table public.german_offer_imports enable row level security;
alter table public.german_offer_pages enable row level security;
alter table public.german_offer_candidates enable row level security;
alter table public.german_published_offers enable row level security;
grant select on public.german_offer_imports,public.german_offer_pages,public.german_offer_candidates,public.german_published_offers to authenticated;
grant all on public.german_offer_imports,public.german_offer_pages,public.german_offer_candidates,public.german_published_offers to service_role;
create policy operators_read on public.german_offer_imports for select to authenticated
 using(exists(select 1 from public.german_offer_operators where user_id=(select auth.uid())));
create policy operators_read on public.german_offer_pages for select to authenticated
 using(exists(select 1 from public.german_offer_operators where user_id=(select auth.uid())));
create policy operators_read on public.german_offer_candidates for select to authenticated
 using(exists(select 1 from public.german_offer_operators where user_id=(select auth.uid())));
create policy current_published on public.german_published_offers for select to authenticated
 using(valid_from<=(now() at time zone 'Europe/Berlin')::date and valid_until>=(now() at time zone 'Europe/Berlin')::date);

create function basket_private.offer_import_start(meta jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare operator_id uuid:=basket_private.require_offer_operator(); result uuid; size bigint;
begin
 size:=(meta->>'byteSize')::bigint;
 insert into public.german_offer_imports(created_by,retailer,market_id,filename,sha256,byte_size,chunk_count,valid_from,valid_until,source_url)
 values(operator_id,meta->>'retailer',case when meta->>'retailer'='rewe' then '561204' end,
 meta->>'filename',meta->>'sha256',size,ceil(size/8388608.0),
 (meta->>'validFrom')::date,(meta->>'validUntil')::date,coalesce(meta->>'sourceUrl',''))
 on conflict(retailer,region,sha256,valid_from,valid_until) do nothing returning id into result;
 if result is null then select id into result from public.german_offer_imports
 where retailer=meta->>'retailer' and sha256=meta->>'sha256' and valid_from=(meta->>'validFrom')::date and valid_until=(meta->>'validUntil')::date; end if;
 return result;
end $$;

create function basket_private.offer_import_queue(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.german_offer_imports; n integer;
begin
 perform basket_private.require_offer_operator();
 select * into strict r from public.german_offer_imports where id=target for update;
 if r.status='published' then raise exception 'Import already published'; end if;
 if r.status='processing' and r.lease_until>now() then raise exception 'Import is processing'; end if;
 select count(*) into n from storage.objects where bucket_id='german-flyers' and name like target::text||'/chunks/%';
 if n<>r.chunk_count then raise exception 'Upload incomplete'; end if;
 update public.german_offer_imports set status='queued',error=null,worker_run=null,lease_until=null where id=target;
end $$;

create function basket_private.offer_import_confirm(target uuid, rights text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform basket_private.require_offer_operator();
 if length(trim(rights))<10 or length(rights)>2000 then raise exception 'Document source/reuse permission'; end if;
 update public.german_offer_imports set rights_note=rights,rights_confirmed=true,dates_confirmed=true,revision=revision+1
 where id=target and status='review';
 if not found then raise exception 'Import not ready'; end if;
end $$;

create function basket_private.offer_candidate_review(target uuid, expected_revision integer, fields jsonb, decision text) returns void
language plpgsql security definer set search_path='' as $$
declare operator_id uuid:=basket_private.require_offer_operator(); c public.german_offer_candidates; r public.german_offer_imports;
begin
 -- Consistent lock order with publishing: import, then candidate.
 select i.* into strict r from public.german_offer_imports i join public.german_offer_candidates x on x.import_id=i.id where x.id=target for update of i;
 if r.status<>'review' then raise exception 'Import not ready for review'; end if;
 select * into strict c from public.german_offer_candidates where id=target for update;
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

create function basket_private.offer_import_publish(target uuid, expected_revision integer) returns integer
language plpgsql security definer set search_path='' as $$
declare r public.german_offer_imports; n integer;
begin
 perform basket_private.require_offer_operator();
 select * into strict r from public.german_offer_imports where id=target for update;
 if r.status='published' then return (select count(*) from public.german_published_offers where import_id=target); end if;
 if r.status<>'review' or r.revision<>expected_revision or not r.rights_confirmed or not r.dates_confirmed then raise exception 'Confirm source rights, dates and latest review'; end if;
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
 from public.german_offer_candidates c where c.import_id=target and c.status='verified' and c.reviewed_by is not null;
 get diagnostics n=row_count;
 if n=0 then raise exception 'No reviewed offers to publish'; end if;
 update public.german_offer_imports set status='published',published_at=now() where id=target;
 return n;
end $$;

-- Thin invoker wrappers; privileged implementations are outside the exposed schema.
create function public.offer_import_start(meta jsonb) returns uuid language sql security invoker set search_path='' as $$select basket_private.offer_import_start(meta)$$;
create function public.offer_import_queue(target uuid) returns void language sql security invoker set search_path='' as $$select basket_private.offer_import_queue(target)$$;
create function public.offer_import_confirm(target uuid,rights text) returns void language sql security invoker set search_path='' as $$select basket_private.offer_import_confirm(target,rights)$$;
create function public.offer_candidate_review(target uuid,expected_revision integer,fields jsonb,decision text) returns void language sql security invoker set search_path='' as $$select basket_private.offer_candidate_review(target,expected_revision,fields,decision)$$;
create function public.offer_import_publish(target uuid,expected_revision integer) returns integer language sql security invoker set search_path='' as $$select basket_private.offer_import_publish(target,expected_revision)$$;

-- Atomically lease one job; runs recover after a crashed runner's lease expires.
create function public.offer_worker_claim(run text) returns setof public.german_offer_imports
language sql security definer set search_path='' as $$
 update public.german_offer_imports set status='processing',worker_run=run,lease_until=now()+interval '20 minutes'
 where id=(select id from public.german_offer_imports where status='queued' or (status='processing' and lease_until<now()) order by created_at for update skip locked limit 1)
 returning *
$$;
revoke all on function public.offer_worker_claim(text) from public,anon,authenticated;
grant execute on function public.offer_worker_claim(text) to service_role;

create function public.offer_worker_page(target uuid,run text,page_number integer,payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r public.german_offer_imports; row jsonb;
begin
 select * into strict r from public.german_offer_imports where id=target for update;
 if r.status<>'processing' or r.worker_run<>run or r.lease_until<now() then raise exception 'Worker lease lost'; end if;
 if page_number not between 1 and r.total_pages then raise exception 'Invalid page'; end if;
 if exists(select 1 from public.german_offer_pages where import_id=target and page=page_number and status='done') then return; end if;
 insert into public.german_offer_pages(import_id,page,status,width,height,image_key,ocr,error,candidates,date_hints)
 values(target,page_number,payload->>'status',(payload->>'width')::real,(payload->>'height')::real,
 payload->>'imageKey',coalesce((payload->>'ocr')::boolean,false),payload->>'error',jsonb_array_length(coalesce(payload->'offers','[]')),coalesce(payload->'dateHints','[]'))
 on conflict(import_id,page) do update set status=excluded.status,width=excluded.width,height=excluded.height,
 image_key=excluded.image_key,ocr=excluded.ocr,error=excluded.error,candidates=excluded.candidates,date_hints=excluded.date_hints;
 for row in select * from jsonb_array_elements(coalesce(payload->'offers','[]')) loop
  insert into public.german_offer_candidates(import_id,page,local_key,bbox,crop_key,data,original_data,issues,status)
  values(target,page_number,row->>'key',row->'bbox',row->>'cropKey',row->'data',row->'data',row->'issues',row->>'status')
  on conflict(import_id,page,local_key) do nothing;
 end loop;
 update public.german_offer_imports set lease_until=now()+interval '20 minutes' where id=target;
end $$;
revoke all on function public.offer_worker_page(uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.offer_worker_page(uuid,text,integer,jsonb) to service_role;

create function public.offer_worker_source(target uuid,available boolean) returns void
language plpgsql security definer set search_path='' as $$
declare source text;
begin
 select source_url into strict source from public.german_offer_imports where id=target and status='published' for update;
 update public.german_offer_imports set source_available=available,source_checked_at=now() where id=target;
 update public.german_published_offers set data=data||jsonb_build_object('sourceUrl',case when available then source else '' end,
 'sourceStatus',case when available then 'checked-at-import' else 'unavailable' end,'sourceCheckedAt',now()) where import_id=target;
end $$;
revoke all on function public.offer_worker_source(uuid,boolean) from public,anon,authenticated;
grant execute on function public.offer_worker_source(uuid,boolean) to service_role;

create function basket_private.offer_candidate_add(target uuid,page_number integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; r public.german_offer_imports; p public.german_offer_pages;
begin
 perform basket_private.require_offer_operator();
 select * into strict r from public.german_offer_imports where id=target for update;
 if r.status<>'review' then raise exception 'Import not ready'; end if;
 select * into strict p from public.german_offer_pages where import_id=target and page=page_number and status='done';
 insert into public.german_offer_candidates(import_id,page,local_key,bbox,crop_key,data,issues)
 values(target,page_number,gen_random_uuid()::text,jsonb_build_array(0,0,p.width,p.height),p.image_key,
 jsonb_build_object('name','','brand','','category','','packSize','','priceCents',0,'currency','EUR','priceKind','standard','minQuantity',1,'conditions','','validFrom',r.valid_from,'validUntil',r.valid_until),
 '["Manuell anhand der Originalseite ergänzen"]') returning id into result;
 update public.german_offer_imports set revision=revision+1 where id=target;
 return result;
end $$;
create function public.offer_candidate_add(target uuid,page_number integer) returns uuid language sql security invoker set search_path='' as $$select basket_private.offer_candidate_add(target,page_number)$$;

do $$declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='basket_private' and p.proname like 'offer_%') or (n.nspname='public' and p.proname in ('offer_import_start','offer_import_queue','offer_import_confirm','offer_candidate_review','offer_import_publish','offer_candidate_add')) loop
 execute format('revoke all on function %s from public,anon',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('german-flyers','german-flyers',false,10485760,array['application/octet-stream','image/png']) on conflict(id) do nothing;
create policy german_flyer_operator_read on storage.objects for select to authenticated
 using(bucket_id='german-flyers' and exists(select 1 from public.german_offer_operators where user_id=(select auth.uid())));
create policy german_flyer_operator_upload on storage.objects for insert to authenticated
 with check(bucket_id='german-flyers' and exists(select 1 from public.german_offer_operators where user_id=(select auth.uid()))
 and exists(select 1 from public.german_offer_imports i where i.status='uploading' and name ~ ('^'||i.id::text||'/chunks/[0-9]{4}$')
 and (split_part(name,'/',3))::integer<i.chunk_count));
-- No client overwrite/delete policy: queued source bytes and review evidence are immutable.
