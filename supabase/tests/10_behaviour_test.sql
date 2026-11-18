-- Behaviour tests for the init migration. A failed assertion raises and stops psql (ON_ERROR_STOP).
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'outsider@example.com');

set role authenticated;

-- A creates a household; shopping + to-do lists exist
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select (public.create_household('Our home', 'Arjun')).invite_code as code \gset
do $$ begin
  assert (select count(*) from lists) = 2, 'expected shopping and to-do lists';
  assert (select count(*) from households) = 1, 'creator sees household';
end $$;

-- Outsider sees nothing and cannot write
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from households) = 0, 'outsider sees no household';
  assert (select count(*) from lists) = 0, 'outsider sees no lists';
end $$;

-- B joins with the invite code typed in lower case
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.join_household(lower(:'code'), 'Priya');
do $$ begin
  assert (select count(*) from household_members) = 2, 'B sees both members';
  assert (select color from household_members where display_name = 'Priya') = '#B5477A', 'second colour';
end $$;

-- Joining twice is refused
do $$ begin
  perform public.join_household((select invite_code from households), 'Priya');
  assert false, 'second join should fail';
exception when sqlstate 'P0001' then null;
end $$;

-- Pantry below keep_min puts it on the shopping list
do $$
declare
  v_h uuid := (select id from households);
  v_rice uuid;
begin
  insert into pantry_items (household_id, name, category, unit, qty, keep_min, store)
    values (v_h, 'Basmati rice', 'Grains', 'bag', 1, 2, 'Patel Brothers') returning id into v_rice;
  assert (select count(*) from list_items where pantry_item_id = v_rice and source = 'pantry' and qty = 1
            and group_name = 'Patel Brothers'), 'rice auto-added with qty 1';

  -- using one more raises the amount to buy
  update pantry_items set qty = 0 where id = v_rice;
  assert (select qty from list_items where pantry_item_id = v_rice and not done) = 2, 'need 2 now';
  assert (select count(*) from list_items where pantry_item_id = v_rice) = 1, 'still one shopping row';

  -- checking it off restocks the pantry, and no new auto item appears
  update list_items set done = true where pantry_item_id = v_rice;
  assert (select qty from pantry_items where id = v_rice) = 2, 'restocked to 2';
  assert (select count(*) from list_items where pantry_item_id = v_rice and not done) = 0, 'nothing open';
  assert (select done_by from list_items where pantry_item_id = v_rice)
         = '00000000-0000-0000-0000-00000000000b', 'done_by stamped';

  -- unchecking undoes the restock and the item is open again with the right qty
  update list_items set done = false where pantry_item_id = v_rice;
  assert (select qty from pantry_items where id = v_rice) = 0, 'restock undone';
  assert (select qty from list_items where pantry_item_id = v_rice and not done) = 2, 'open again, qty 2';

  -- the stepper RPC adjusts atomically and never goes below zero
  perform adjust_pantry_qty(v_rice, -5);
  assert (select qty from pantry_items where id = v_rice) = 0, 'clamped at zero';

  -- topping up the pantry by hand removes the auto item
  update pantry_items set qty = 5 where id = v_rice;
  assert (select count(*) from list_items where pantry_item_id = v_rice) = 0, 'auto item removed';
end $$;

-- A manual shopping item with a pantry item's name gets linked and restocks on check-off
do $$
declare
  v_h uuid := (select id from households);
  v_shop uuid := (select id from lists where kind = 'shopping');
  v_dal uuid;
  v_item uuid;
begin
  insert into pantry_items (household_id, name, qty, keep_min) values (v_h, 'Toor dal', 3, 2)
    returning id into v_dal;
  insert into list_items (list_id, household_id, text, qty) values (v_shop, v_h, 'toor DAL ', 2)
    returning id into v_item;
  assert (select pantry_item_id from list_items where id = v_item) = v_dal, 'linked by name';
  update list_items set done = true where id = v_item;
  assert (select qty from pantry_items where id = v_dal) = 5, 'manual item restocks';

  -- a manual linked item is not removed or resized by the pantry trigger
  update list_items set done = false where id = v_item;  -- qty back to 3
  update pantry_items set qty = 0 where id = v_dal;
  assert (select count(*) from list_items where pantry_item_id = v_dal and not done) = 1, 'no duplicate';
  assert (select qty from list_items where id = v_item) = 2, 'manual qty kept';
end $$;

-- household_id on list items comes from the list, not the client
do $$
declare
  v_todo uuid := (select id from lists where kind = 'todo');
  v_item uuid;
begin
  insert into list_items (list_id, household_id, text) values (v_todo, gen_random_uuid(), 'Fold laundry')
    returning id into v_item;
  assert (select household_id from list_items where id = v_item) = (select id from households),
    'household_id overwritten from list';
end $$;

-- Repeating to-dos: checking off creates the next one; unchecking removes it
do $$
declare
  v_todo uuid := (select id from lists where kind = 'todo');
  v_item uuid;
begin
  insert into list_items (list_id, household_id, text, due_on, repeat_every_days)
    values (v_todo, (select id from households), 'Deep clean kitchen', date '2026-11-21', 14)
    returning id into v_item;
  update list_items set done = true where id = v_item;
  assert (select due_on from list_items where repeated_from = v_item) = date '2026-12-05', 'next in 14 days';
  update list_items set done = false where id = v_item;
  assert (select count(*) from list_items where repeated_from = v_item) = 0, 'next occurrence removed';
end $$;

-- Outsider cannot read or insert into this household
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from pantry_items) = 0, 'outsider sees no pantry';
  begin
    insert into pantry_items (household_id, name)
      values ((select household_id from household_members limit 1), 'Sneaky');
    assert false, 'outsider insert should fail';
  exception when insufficient_privilege or not_null_violation then null;
  end;
end $$;

reset role;
select 'all database tests passed' as result;
