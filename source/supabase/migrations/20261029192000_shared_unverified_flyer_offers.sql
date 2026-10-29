-- Signed-in Basket accounts may read a sanitized, time-limited collection
-- of unverified flyer *display candidates*. The private OCR evidence, crops,
-- operators, import internals and editing permissions remain restricted.
-- IMPORTANT: unverified candidates are not approved prices.
create or replace function basket_private.shared_german_offer_drafts()
returns table (
  id uuid,
  import_id uuid,
  page integer,
  status text,
  issues jsonb,
  data jsonb,
  retailer text,
  region text,
  filename text,
  source_url text,
  valid_from date,
  valid_until date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.import_id, c.page, c.status,
    coalesce((
      select jsonb_agg(j.value order by j.ordinality)
      from jsonb_array_elements_text(
        case when jsonb_typeof(c.issues) = 'array' then c.issues else '[]'::jsonb end
      ) with ordinality as j(value, ordinality)
      where j.value in (
        'Angebotszeitraum mit dem Prospekt abgleichen',
        'Marke nicht eindeutig als Text erkannt',
        'Keine eindeutige Packungsgröße erkannt',
        'Mehrere Verkaufspreise / Produkte im selben Bereich',
        'Mehrere Mengen / Größen: Preiszuordnung bestätigen',
        'Bedingter Preis: Bedingungen und Gesamtpreis bestätigen',
        'Keine eindeutige Kachelgrenze; Originalbereich prüfen',
        'Produktbezeichnung nicht lesbar',
        'Grundpreis passt rechnerisch nicht zu Preis / Menge'
      )
    ), '[]'::jsonb) as issues,
    jsonb_build_object(
      'name', left(coalesce(c.data->>'name', ''), 250),
      'brand', left(coalesce(c.data->>'brand', ''), 100),
      'variant', left(coalesce(c.data->>'variant', ''), 100),
      'category', left(coalesce(c.data->>'category', ''), 100),
      'packSize', left(coalesce(c.data->>'packSize', ''), 150),
      'priceCents', case
        when coalesce(c.data->>'priceCents', '') ~ '^[0-9]{1,6}$'
        then (c.data->>'priceCents')::integer
        else 0 end,
      'priceKind', left(coalesce(c.data->>'priceKind', ''), 20),
      'conditions', left(coalesce(c.data->>'conditions', ''), 500),
      'validFrom', case
        when coalesce(c.data->>'validFrom', '') ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
          and c.data->>'validFrom' >= i.valid_from::text
          and c.data->>'validFrom' <= i.valid_until::text
        then c.data->>'validFrom' else i.valid_from::text end,
      'validUntil', case
        when coalesce(c.data->>'validUntil', '') ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
          and c.data->>'validUntil' >= i.valid_from::text
          and c.data->>'validUntil' <= i.valid_until::text
        then c.data->>'validUntil' else i.valid_until::text end
    ) as data,
    i.retailer, i.region,
    left(i.filename, 160) as filename,
    case
      when i.source_url ~ '^https://(view[.]publitas[.]com/|magazine[.]aldi-nord[.]de/|penny-publish[.]blaetterkatalog[.]de/|www[.]rewe[.]de/)'
      then i.source_url
      else '' end as source_url,
    i.valid_from, i.valid_until
  from public.german_offer_candidates c
  join public.german_offer_imports i on i.id = c.import_id
  where (select auth.uid()) is not null
    and coalesce((select auth.jwt()->>'is_anonymous'), 'false') <> 'true'
    and i.region = 'Kiel'
    and i.retailer in ('rewe','aldi-nord','penny')
    and i.status in ('review','published')
    and c.status in ('review','unreadable')
    and i.valid_from <= (now() at time zone 'Europe/Berlin')::date
    and i.valid_until >= (now() at time zone 'Europe/Berlin')::date
    and not exists (
      select 1 from public.german_published_offers p where p.id = c.id
    )
  order by c.id
  limit 2500;
$$;

-- Public Data API entrypoint only invokes the narrowly filtered private reader.
-- It cannot modify the source tables or access raw OCR/evidence.
create or replace function public.shared_german_offer_drafts()
returns table (
  id uuid,
  import_id uuid,
  page integer,
  status text,
  issues jsonb,
  data jsonb,
  retailer text,
  region text,
  filename text,
  source_url text,
  valid_from date,
  valid_until date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from basket_private.shared_german_offer_drafts();
$$;

revoke all on function public.shared_german_offer_drafts() from public, anon;
revoke all on function basket_private.shared_german_offer_drafts() from public, anon;
grant usage on schema basket_private to authenticated;
grant execute on function basket_private.shared_german_offer_drafts() to authenticated;
grant execute on function public.shared_german_offer_drafts() to authenticated;
