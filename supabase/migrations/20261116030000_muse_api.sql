-- Agent item API: a bearer token in muse_config authorizes the muse_* RPCs,
-- which run as security definer and write closet_items for the configured user.
-- Replace the 'token' value with your own random string; it is what agents send
-- as `Authorization: Bearer <token>` to /api/items.

create table if not exists public.muse_config (
  key text primary key,
  value text not null
);

alter table public.muse_config enable row level security;
revoke all on table public.muse_config from anon, authenticated;

insert into public.muse_config (key, value) values
  ('token', 'replace-me-with-a-long-random-token'),
  ('user_id', '00000000-0000-0000-0000-000000000000')
on conflict (key) do nothing;

create or replace function public.muse_auth(tok text) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if tok is null or tok = '' or not exists (select 1 from muse_config where key = 'token' and value = tok) then
    raise exception 'unauthorized';
  end if;
  select value::uuid into u from muse_config where key = 'user_id';
  return u;
end $$;

create or replace function public.muse_whoami(tok text) returns uuid
language sql security definer set search_path = public as $$
  select muse_auth(tok)
$$;

create or replace function public.muse_list(tok text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := muse_auth(tok);
begin
  return coalesce((
    select jsonb_agg(d.item order by d.item->>'createdAt' desc) from (
      select jsonb_build_object('id', id) || data as item
      from closet_items where user_id = u and not deleted
    ) d), '[]'::jsonb);
end $$;

create or replace function public.muse_create(tok text, item jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := muse_auth(tok);
begin
  insert into closet_items (user_id, id, data, deleted, updated_at)
  values (u, (item->>'id')::uuid, item, false, now())
  on conflict (user_id, id) do update set data = excluded.data, deleted = false, updated_at = now()
  returning data into item;
  return item;
end $$;

create or replace function public.muse_update(tok text, item_id text, patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := muse_auth(tok);
  merged jsonb;
begin
  update closet_items
  set data = data || patch || jsonb_build_object('id', item_id, 'updatedAt', (extract(epoch from now()) * 1000)::bigint),
      updated_at = now()
  where user_id = u and id = item_id::uuid and not deleted
  returning data into merged;
  if not found then raise exception 'item not found'; end if;
  return merged;
end $$;

create or replace function public.muse_delete(tok text, item_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := muse_auth(tok);
begin
  update closet_items set deleted = true, updated_at = now()
  where user_id = u and id = item_id::uuid
  returning id into item_id;
  if not found then raise exception 'item not found'; end if;
  return jsonb_build_object('deleted', item_id);
end $$;
