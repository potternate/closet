-- Wear notes: muse_wear can also record an optional occasion/note for the day,
-- stored as data.wearNotes[day] = { occasion, note }. Still idempotent: an item
-- already worn that day with the same note is returned unchanged.

drop function if exists public.muse_wear(text, jsonb, text);

create or replace function public.muse_wear(tok text, item_ids jsonb, day text, occasion text default null, note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := muse_auth(tok);
  wn jsonb := jsonb_strip_nulls(jsonb_build_object('occasion', nullif(btrim(occasion), ''), 'note', nullif(btrim(note), '')));
  iid text;
  worn jsonb := '[]'::jsonb;
  w jsonb;
  has_day boolean;
begin
  if day is null or day !~ '^\d{4}-\d{2}-\d{2}$' or day::date > current_date then
    raise exception 'invalid day (YYYY-MM-DD, not future)';
  end if;
  if jsonb_typeof(item_ids) <> 'array' then raise exception 'item_ids must be an array'; end if;
  for iid in select jsonb_array_elements_text(item_ids) loop
    select data into w from closet_items where user_id = u and id = iid::uuid and not deleted;
    if not found then raise exception 'item not found: %', iid; end if;
    has_day := coalesce(jsonb_typeof(w->'wears') = 'array' and w->'wears' @> to_jsonb(day), false);
    if not has_day or (wn <> '{}'::jsonb and w #> array['wearNotes', day] is distinct from wn) then
      update closet_items
      set data = data
            || jsonb_build_object(
                 'wears', case when has_day then data->'wears' else coalesce(data->'wears', '[]'::jsonb) || to_jsonb(day) end,
                 'updatedAt', (extract(epoch from now()) * 1000)::bigint)
            || case when wn = '{}'::jsonb then '{}'::jsonb
                    else jsonb_build_object('wearNotes', case when jsonb_typeof(data->'wearNotes') = 'object' then data->'wearNotes' else '{}'::jsonb end || jsonb_build_object(day, wn)) end,
          updated_at = now()
      where user_id = u and id = iid::uuid
      returning data into w;
    end if;
    worn := worn || jsonb_strip_nulls(jsonb_build_object('id', iid, 'wears', w->'wears', 'wearNote', w #> array['wearNotes', day]));
  end loop;
  return worn;
end $$;
