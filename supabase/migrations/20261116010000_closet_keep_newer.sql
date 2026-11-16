-- Ignore writes from a device holding an older copy of the item.
create or replace function public.closet_items_keep_newer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists closet_items_keep_newer on public.closet_items;
create trigger closet_items_keep_newer
  before update on public.closet_items
  for each row execute function public.closet_items_keep_newer();
