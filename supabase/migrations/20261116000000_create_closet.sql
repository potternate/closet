create table if not exists public.closet_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.closet_items enable row level security;
revoke all on table public.closet_items from anon;
grant select, insert, update, delete on table public.closet_items to authenticated;

create policy "Users read own closet items" on public.closet_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add own closet items" on public.closet_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own closet items" on public.closet_items
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own closet items" on public.closet_items
  for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('closet-photos', 'closet-photos', false, 10485760, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "Users read own closet photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'closet-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload own closet photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'closet-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update own closet photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'closet-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'closet-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own closet photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'closet-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
