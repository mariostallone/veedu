-- M6 scanning: remember a product barcode on a pantry item, so scanning it again opens that item.
alter table public.pantry_items add column barcode text check (barcode is null or length(btrim(barcode)) between 4 and 32);

-- One pantry item per barcode per household; items without a barcode are unconstrained.
create unique index pantry_items_barcode_unique on public.pantry_items (household_id, barcode) where barcode is not null;
