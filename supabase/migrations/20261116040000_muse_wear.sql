-- Wear logging for the agent API: muse_wear appends a day to each item's wears.
-- Idempotent: an item already wearing `day` is returned unchanged (no
-- updated_at bump, so the row can't shadow pending device edits).

create or replace function public.muse_wear(tok text, item_ids jsonb, day text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := muse_auth(tok);
  iid text;
  worn jsonb := '[]'::jsonb;
  w jsonb;
begin
  if day !~ '^\d{4}-\d{2}-\d{2}$' or day::date > current_date then
    raise exception 'invalid day (YYYY-MM-DD, not future)';
  end if;
  if jsonb_typeof(item_ids) <> 'array' then raise exception 'item_ids must be an array'; end if;
  for iid in select jsonb_array_elements_text(item_ids) loop
    update closet_items
    set data = data || jsonb_build_object('wears', coalesce(data->'wears','[]'::jsonb) || to_jsonb(day), 'updatedAt', (extract(epoch from now()) * 1000)::bigint),
        updated_at = now()
    where user_id = u and id = iid::uuid and not deleted and not (data->'wears' @> to_jsonb(day))
    returning data into w;
    if not found then
      select data into w from closet_items where user_id = u and id = iid::uuid and not deleted;
      if not found then raise exception 'item not found: %', iid; end if;
    end if;
    worn := worn || jsonb_build_object('id', iid, 'wears', w->'wears');
  end loop;
  return worn;
end $$;
