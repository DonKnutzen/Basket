-- Friends, in-app inbox, shared recipe books and account recipes.
-- Additive: no household, receipt or offer schema changes. Household invitations
-- sent through the inbox reuse the existing invite/join codes.
create schema if not exists basket_private;
revoke all on schema basket_private from public;
grant usage on schema basket_private to authenticated;

create table public.friendships (
 id uuid primary key default gen_random_uuid(),
 requester uuid not null default auth.uid() references auth.users(id) on delete cascade,
 requester_email text not null check(length(requester_email) between 3 and 320),
 requester_name text not null default '' check(length(requester_name)<=80),
 addressee_email text not null check(length(addressee_email) between 3 and 320),
 addressee uuid references auth.users(id) on delete cascade,
 addressee_name text not null default '' check(length(addressee_name)<=80),
 status text not null default 'pending' check(status in ('pending','accepted')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 unique(requester,addressee_email)
);
create index friendships_addressee_email on public.friendships(lower(addressee_email));
create index friendships_addressee on public.friendships(addressee);
alter table public.friendships enable row level security;
grant select,insert,delete on public.friendships to authenticated;
create policy friendships_read on public.friendships for select to authenticated
 using (requester=(select auth.uid()) or addressee=(select auth.uid()) or lower(addressee_email)=lower((select auth.jwt()->>'email')));
create policy friendships_request on public.friendships for insert to authenticated
 with check (requester=(select auth.uid()) and status='pending' and addressee is null
  and lower(requester_email)=lower((select auth.jwt()->>'email'))
  and lower(addressee_email)<>lower((select auth.jwt()->>'email')));
create policy friendships_remove on public.friendships for delete to authenticated
 using (requester=(select auth.uid()) or addressee=(select auth.uid()) or lower(addressee_email)=lower((select auth.jwt()->>'email')));

-- Accept or decline a request addressed to the signed-in e-mail. Declining deletes it.
create function public.basket_respond_friend(request_id uuid, accept boolean, display_name text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); mail text := lower(auth.jwt()->>'email');
begin
 if me is null or mail is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if accept then
  update public.friendships set status='accepted', addressee=me, addressee_name=left(coalesce(display_name,''),80), responded_at=now()
   where id=request_id and lower(addressee_email)=mail and status='pending' and requester<>me;
 else
  delete from public.friendships where id=request_id and lower(addressee_email)=mail and status='pending';
 end if;
end $$;
revoke all on function public.basket_respond_friend(uuid,boolean,text) from public, anon;
grant execute on function public.basket_respond_friend(uuid,boolean,text) to authenticated;

create function basket_private.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.friendships f where f.status='accepted'
  and ((f.requester=a and f.addressee=b) or (f.requester=b and f.addressee=a)))
$$;
revoke all on function basket_private.are_friends(uuid,uuid) from public;
grant execute on function basket_private.are_friends(uuid,uuid) to authenticated;

create table public.inbox (
 id uuid primary key default gen_random_uuid(),
 sender uuid not null default auth.uid() references auth.users(id) on delete cascade,
 sender_name text not null default '' check(length(sender_name)<=80),
 recipient uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('recipe','household_invite','book_invite')),
 payload jsonb not null default '{}'::jsonb check(pg_column_size(payload)<=200000),
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index inbox_recipient on public.inbox(recipient,created_at desc);
alter table public.inbox enable row level security;
grant select,insert,update,delete on public.inbox to authenticated;
create policy inbox_read on public.inbox for select to authenticated
 using (recipient=(select auth.uid()) or sender=(select auth.uid()));
create policy inbox_send on public.inbox for insert to authenticated
 with check (sender=(select auth.uid()) and basket_private.are_friends((select auth.uid()),recipient));
create policy inbox_mark on public.inbox for update to authenticated
 using (recipient=(select auth.uid())) with check (recipient=(select auth.uid()));
create policy inbox_remove on public.inbox for delete to authenticated
 using (recipient=(select auth.uid()) or sender=(select auth.uid()));

create table public.recipe_books (
 id uuid primary key default gen_random_uuid(),
 owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 80),
 created_at timestamptz not null default now()
);
create table public.recipe_book_members (
 book_id uuid not null references public.recipe_books(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=80),
 added_at timestamptz not null default now(),
 primary key(book_id,user_id)
);
create index recipe_book_members_user on public.recipe_book_members(user_id);

create function basket_private.is_book_member(book uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.recipe_book_members m where m.book_id=book and m.user_id=auth.uid())
$$;
revoke all on function basket_private.is_book_member(uuid) from public;
grant execute on function basket_private.is_book_member(uuid) to authenticated;

create function basket_private.is_book_owner(book uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.recipe_books b where b.id=book and b.owner=auth.uid())
$$;
revoke all on function basket_private.is_book_owner(uuid) from public;
grant execute on function basket_private.is_book_owner(uuid) to authenticated;

-- The owner becomes the first member of a new book.
create function basket_private.add_book_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.recipe_book_members(book_id,user_id) values (new.id,new.owner) on conflict do nothing;
 return new;
end $$;
revoke all on function basket_private.add_book_owner() from public;
create trigger recipe_books_owner_member after insert on public.recipe_books
 for each row execute function basket_private.add_book_owner();

alter table public.recipe_books enable row level security;
grant select,insert,update,delete on public.recipe_books to authenticated;
create policy recipe_books_read on public.recipe_books for select to authenticated
 using (owner=(select auth.uid()) or basket_private.is_book_member(id));
create policy recipe_books_create on public.recipe_books for insert to authenticated
 with check (owner=(select auth.uid()));
create policy recipe_books_rename on public.recipe_books for update to authenticated
 using (owner=(select auth.uid())) with check (owner=(select auth.uid()));
create policy recipe_books_remove on public.recipe_books for delete to authenticated
 using (owner=(select auth.uid()));

alter table public.recipe_book_members enable row level security;
grant select,insert,delete on public.recipe_book_members to authenticated;
create policy recipe_book_members_read on public.recipe_book_members for select to authenticated
 using (basket_private.is_book_member(book_id));
create policy recipe_book_members_add on public.recipe_book_members for insert to authenticated
 with check (basket_private.is_book_owner(book_id) and basket_private.are_friends((select auth.uid()),user_id));
create policy recipe_book_members_leave on public.recipe_book_members for delete to authenticated
 using (user_id=(select auth.uid()) or basket_private.is_book_owner(book_id));

create table public.recipes (
 id uuid primary key default gen_random_uuid(),
 owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
 book_id uuid references public.recipe_books(id) on delete cascade,
 title text not null default '' check(length(title)<=120),
 servings text not null default '' check(length(servings)<=20),
 ingredients jsonb not null default '[]'::jsonb check(jsonb_typeof(ingredients)='array'),
 steps jsonb not null default '[]'::jsonb check(jsonb_typeof(steps)='array'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(pg_column_size(ingredients)+pg_column_size(steps)<=200000)
);
create index recipes_owner on public.recipes(owner);
create index recipes_book on public.recipes(book_id);
alter table public.recipes enable row level security;
grant select,insert,update,delete on public.recipes to authenticated;
create policy recipes_read on public.recipes for select to authenticated
 using (owner=(select auth.uid()) or (book_id is not null and basket_private.is_book_member(book_id)));
create policy recipes_create on public.recipes for insert to authenticated
 with check (owner=(select auth.uid()) and (book_id is null or basket_private.is_book_member(book_id)));
create policy recipes_edit on public.recipes for update to authenticated
 using (owner=(select auth.uid()) or (book_id is not null and basket_private.is_book_member(book_id)))
 with check (book_id is null and owner=(select auth.uid()) or book_id is not null and basket_private.is_book_member(book_id));
create policy recipes_remove on public.recipes for delete to authenticated
 using (owner=(select auth.uid()) or (book_id is not null and basket_private.is_book_member(book_id)));
