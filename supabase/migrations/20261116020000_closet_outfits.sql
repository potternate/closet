create table if not exists public.closet_outfits (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.closet_outfits enable row level security;
revoke all on table public.closet_outfits from anon;
grant select, insert, update, delete on table public.closet_outfits to authenticated;

create policy "Users read own outfits" on public.closet_outfits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add own outfits" on public.closet_outfits
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own outfits" on public.closet_outfits
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own outfits" on public.closet_outfits
  for delete to authenticated using ((select auth.uid()) = user_id);

drop trigger if exists closet_outfits_keep_newer on public.closet_outfits;
create trigger closet_outfits_keep_newer
  before update on public.closet_outfits
  for each row execute function public.closet_items_keep_newer();
