alter table public.purchase_requests
  add column if not exists item_name text;

update public.purchase_requests
set item_name = coalesce(
  nullif(btrim(item_name), ''),
  nullif(btrim(description), ''),
  nullif(btrim(reason), ''),
  id
)
where item_name is null or btrim(item_name) = '';

alter table public.purchase_requests
  alter column item_name set not null;

alter table public.purchase_requests
  drop constraint if exists purchase_requests_item_name_not_blank;

alter table public.purchase_requests
  add constraint purchase_requests_item_name_not_blank
  check (btrim(item_name) <> '');

comment on column public.purchase_requests.item_name is
  'Official name of the item or service being purchased.';
