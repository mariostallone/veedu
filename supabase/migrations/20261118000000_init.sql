-- Veedu: initial schema
-- Households share a pantry, one shopping list, one to-do list and any number of trip lists.
-- Pantry and shopping are linked by triggers:
--   * pantry qty below keep_min  -> an item is put on the shopping list (source = 'pantry')
--   * a linked shopping item is checked off -> pantry qty goes up by that amount (and back down if unchecked)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 60),
  invite_code text not null unique
              default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 40),
  color        text not null default '#2F6FB5',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.pantry_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 80),
  category     text not null default 'Other',
  unit         text not null default 'pack',
  qty          numeric not null default 0 check (qty >= 0),
  keep_min     numeric not null default 0 check (keep_min >= 0),
  store        text,
  expires_on   date,
  notes        text,
  created_by   uuid default auth.uid() references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid() references auth.users on delete set null,
  updated_at   timestamptz not null default now()
);
create index pantry_items_household_idx on public.pantry_items (household_id);

create table public.lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  kind         text not null check (kind in ('shopping', 'todo', 'trip')),
  title        text not null check (length(btrim(title)) between 1 and 80),
  starts_on    date,
  budget       numeric check (budget is null or budget >= 0),
  archived     boolean not null default false,
  created_by   uuid default auth.uid() references auth.users on delete set null,
  created_at   timestamptz not null default now()
);
create index lists_household_idx on public.lists (household_id);
create unique index lists_one_shopping on public.lists (household_id) where kind = 'shopping';
create unique index lists_one_todo on public.lists (household_id) where kind = 'todo';

create table public.list_items (
  id                uuid primary key default gen_random_uuid(),
  list_id           uuid not null references public.lists on delete cascade,
  -- copied from the list by trigger; kept here for RLS and realtime filters
  household_id      uuid not null references public.households on delete cascade,
  text              text not null check (length(btrim(text)) between 1 and 200),
  qty               numeric not null default 1 check (qty > 0),
  note              text,
  -- trips: 'gifts' | 'packing' | 'bring_back'; unused elsewhere
  category          text,
  -- shopping: store name; trips: person (e.g. 'Amma & Appa')
  group_name        text,
  owner_id          uuid references auth.users on delete set null,
  due_on            date,
  repeat_every_days integer check (repeat_every_days is null or repeat_every_days > 0),
  repeated_from     uuid references public.list_items on delete set null,
  cost              numeric check (cost is null or cost >= 0),
  pantry_item_id    uuid references public.pantry_items on delete set null,
  source            text not null default 'manual' check (source in ('manual', 'pantry', 'photo')),
  done              boolean not null default false,
  done_at           timestamptz,
  done_by           uuid references auth.users on delete set null,
  position          double precision not null default extract(epoch from clock_timestamp()),
  created_by        uuid default auth.uid() references auth.users on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index list_items_list_idx on public.list_items (list_id);
create index list_items_household_idx on public.list_items (household_id);
create index list_items_pantry_idx on public.list_items (pantry_item_id) where pantry_item_id is not null;

-- ---------------------------------------------------------------------------
-- Membership helper + RLS
-- ---------------------------------------------------------------------------

create or replace function public.is_member(h uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = h and user_id = auth.uid()
  );
$$;

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.pantry_items      enable row level security;
alter table public.lists             enable row level security;
alter table public.list_items        enable row level security;

create policy "members read household" on public.households
  for select using (public.is_member(id));
create policy "members rename household" on public.households
  for update using (public.is_member(id)) with check (public.is_member(id));

create policy "members see each other" on public.household_members
  for select using (public.is_member(household_id));
create policy "edit own profile" on public.household_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "leave household" on public.household_members
  for delete using (user_id = auth.uid());

create policy "members manage pantry" on public.pantry_items
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "members manage lists" on public.lists
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "members manage list items" on public.list_items
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));

-- ---------------------------------------------------------------------------
-- RPCs: create / join a household
-- ---------------------------------------------------------------------------

create or replace function public.create_household(p_name text, p_display_name text)
returns public.households
language plpgsql security definer set search_path = public
as $$
declare
  v_household public.households;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'You are already in a household' using errcode = 'P0001';
  end if;

  insert into public.households (name) values (btrim(p_name)) returning * into v_household;
  insert into public.household_members (household_id, user_id, display_name, color)
    values (v_household.id, auth.uid(), btrim(p_display_name), '#2F6FB5');
  insert into public.lists (household_id, kind, title) values
    (v_household.id, 'shopping', 'Shopping'),
    (v_household.id, 'todo', 'To-dos');
  return v_household;
end;
$$;

create or replace function public.join_household(p_code text, p_display_name text)
returns public.households
language plpgsql security definer set search_path = public
as $$
declare
  v_household public.households;
  v_colors text[] := array['#2F6FB5', '#B5477A', '#C77E00', '#5B8C2A', '#7A55B5', '#2A8C8C'];
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'You are already in a household' using errcode = 'P0001';
  end if;

  select * into v_household from public.households
    where invite_code = upper(btrim(p_code));
  if not found then
    raise exception 'No household has that invite code' using errcode = 'P0002';
  end if;

  select count(*) into v_count from public.household_members where household_id = v_household.id;
  insert into public.household_members (household_id, user_id, display_name, color)
    values (v_household.id, auth.uid(), btrim(p_display_name),
            v_colors[1 + (v_count % array_length(v_colors, 1))]);
  return v_household;
end;
$$;

-- Atomic +/- so two people tapping the stepper at once don't overwrite each other.
create or replace function public.adjust_pantry_qty(p_id uuid, p_delta numeric)
returns public.pantry_items
language sql security invoker set search_path = public
as $$
  update public.pantry_items
    set qty = greatest(0, qty + p_delta), updated_by = auth.uid()
    where id = p_id
    returning *;
$$;

revoke all on function public.create_household(text, text) from public;
revoke all on function public.join_household(text, text) from public;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.adjust_pantry_qty(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger pantry_items_touch before update on public.pantry_items
  for each row execute function public.touch_updated_at();
create trigger list_items_touch before update on public.list_items
  for each row execute function public.touch_updated_at();

-- Fill household_id from the list, stamp done_at/done_by, and link shopping items
-- to a pantry item with the same name so checking them off restocks the pantry.
create or replace function public.list_items_before_write()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_kind text;
begin
  select household_id, kind into new.household_id, v_kind from public.lists where id = new.list_id;
  if new.household_id is null then
    raise exception 'List not found';
  end if;

  if tg_op = 'INSERT' or new.done is distinct from old.done then
    if new.done then
      new.done_at := coalesce(new.done_at, now());
      new.done_by := coalesce(new.done_by, auth.uid());
    else
      new.done_at := null;
      new.done_by := null;
    end if;
  end if;

  if tg_op = 'INSERT' and v_kind = 'shopping' and new.pantry_item_id is null then
    select id into new.pantry_item_id from public.pantry_items
      where household_id = new.household_id and lower(btrim(name)) = lower(btrim(new.text))
      limit 1;
  end if;
  return new;
end;
$$;

create trigger list_items_before_write before insert or update on public.list_items
  for each row execute function public.list_items_before_write();

-- Pantry -> shopping: keep one open, auto-added shopping item in step with the shortfall.
create or replace function public.sync_pantry_to_shopping()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_list uuid;
  v_item public.list_items;
  v_need numeric;
begin
  select id into v_list from public.lists
    where household_id = new.household_id and kind = 'shopping';
  if v_list is null then
    return new;
  end if;

  select * into v_item from public.list_items
    where list_id = v_list and pantry_item_id = new.id and not done
    order by (source = 'pantry') desc
    limit 1;

  if new.qty < new.keep_min then
    v_need := greatest(ceil(new.keep_min - new.qty), 1);
    if v_item.id is null then
      insert into public.list_items
        (list_id, household_id, text, qty, group_name, pantry_item_id, source, created_by)
      values
        (v_list, new.household_id, new.name, v_need, new.store, new.id, 'pantry',
         coalesce(auth.uid(), new.updated_by));
    elsif v_item.source = 'pantry' then
      update public.list_items
        set qty = v_need, text = new.name, group_name = new.store
        where id = v_item.id;
    end if;
  elsif v_item.id is not null and v_item.source = 'pantry' then
    delete from public.list_items where id = v_item.id;
  end if;
  return new;
end;
$$;

create trigger pantry_items_sync_shopping
  after insert or update of qty, keep_min, name, store on public.pantry_items
  for each row execute function public.sync_pantry_to_shopping();

-- Shopping -> pantry: checking off a linked item adds its qty to the pantry; unchecking removes it.
-- To-dos: checking off a repeating task creates the next occurrence; unchecking removes it again.
create or replace function public.list_items_after_done()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_kind text;
begin
  if new.done is not distinct from old.done then
    return new;
  end if;
  select kind into v_kind from public.lists where id = new.list_id;

  if v_kind = 'shopping' and new.pantry_item_id is not null then
    update public.pantry_items
      set qty = greatest(0, qty + case when new.done then new.qty else -new.qty end),
          updated_by = coalesce(auth.uid(), updated_by)
      where id = new.pantry_item_id;
  end if;

  if v_kind = 'todo' and new.repeat_every_days is not null then
    if new.done then
      insert into public.list_items
        (list_id, household_id, text, note, owner_id, due_on, repeat_every_days, repeated_from, created_by)
      values
        (new.list_id, new.household_id, new.text, new.note, new.owner_id,
         coalesce(new.due_on, current_date) + new.repeat_every_days,
         new.repeat_every_days, new.id, new.created_by);
    else
      delete from public.list_items where repeated_from = new.id and not done;
    end if;
  end if;
  return new;
end;
$$;

create trigger list_items_after_done
  after update of done on public.list_items
  for each row execute function public.list_items_after_done();

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime
      add table public.pantry_items, public.lists, public.list_items, public.household_members;
  end if;
end;
$$;
