-- Behaviour tests for 20261118010000_household_tools.sql (regenerate invite code, leave household).
\set ON_ERROR_STOP on
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'd1@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'd3@example.com');

set role authenticated;

-- D1 creates a household, D2 joins with the first code
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select (public.create_household('Tools home', 'Dev')).invite_code as old_code \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
select public.join_household(:'old_code', 'Devi');

-- Regenerating changes the code, for members only; the old code stops working
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select (public.regenerate_invite_code()).invite_code as new_code \gset
select set_config('t.old_code', :'old_code', false), set_config('t.new_code', :'new_code', false) \gset ignore_
do $$ begin
  assert current_setting('t.new_code') <> current_setting('t.old_code'), 'code changed';
  assert (select invite_code from households) = current_setting('t.new_code'), 'household has the new code';
  assert current_setting('t.new_code') ~ '^[0-9A-F]{6}$', 'code has the usual shape';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d3';
do $$ begin
  perform public.join_household(current_setting('t.old_code'), 'Late');
  assert false, 'old code should not work';
exception when sqlstate 'P0002' then null;
end $$;
do $$ begin
  perform public.regenerate_invite_code();
  assert false, 'non-member cannot regenerate';
exception when sqlstate 'P0002' then null;
end $$;
do $$ begin
  perform public.leave_household();
  assert false, 'non-member cannot leave';
exception when sqlstate 'P0002' then null;
end $$;
-- ...but the new one does, so D3 joins (and is then in a household: one per person)
select public.join_household(:'new_code', 'Dee');
do $$ begin
  perform public.create_household('Second', 'Dee');
  assert false, 'already in a household';
exception when sqlstate 'P0001' then null;
end $$;

-- D2 leaves: their assigned to-dos become unassigned, the others stay
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
do $$
declare
  v_todo uuid := (select id from lists where kind = 'todo');
begin
  insert into list_items (list_id, household_id, text, owner_id) values
    (v_todo, (select id from households), 'Mine', '00000000-0000-0000-0000-0000000000d2'),
    (v_todo, (select id from households), 'Theirs', '00000000-0000-0000-0000-0000000000d1');
end $$;
select public.leave_household();
do $$ begin
  assert (select count(*) from households) = 0, 'D2 no longer sees the household';
  assert (select count(*) from household_members) = 0, 'D2 sees no members';
end $$;
reset role;
do $$ begin
  assert (select count(*) from household_members where user_id = '00000000-0000-0000-0000-0000000000d2') = 0, 'D2 removed';
  assert (select count(*) from household_members where display_name in ('Dev', 'Dee')) = 2, 'others remain';
  assert (select owner_id from list_items where text = 'Mine') is null, 'D2 to-do unassigned';
  assert (select owner_id from list_items where text = 'Theirs') is not null, 'D1 to-do untouched';
end $$;

-- D2 can start over: create a new household
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
select (public.create_household('Fresh start', 'Devi')).id as fresh \gset
select set_config('t.fresh', :'fresh', false) \gset ignore_
do $$ begin
  assert (select count(*) from households) = 1, 'D2 sees only the new household';
end $$;

-- The last member leaving deletes the household and its data
select public.leave_household();
reset role;
do $$ begin
  assert not exists (select 1 from households where name = 'Fresh start'), 'empty household deleted';
  assert not exists (select 1 from lists where household_id = current_setting('t.fresh')::uuid), 'its lists deleted';
  assert exists (select 1 from households where name = 'Tools home'), 'other household kept';
end $$;

-- D1 and D3 leave; the first household disappears with its items
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.leave_household();
do $$ begin
  assert (select count(*) from households) = 0, 'D1 sees nothing after leaving';
end $$;
reset role;
do $$ begin
  assert exists (select 1 from households where name = 'Tools home'), 'D3 still there';
end $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d3';
select public.leave_household();
reset role;
do $$ begin
  assert not exists (select 1 from households where name = 'Tools home'), 'last leaver deletes household';
  assert not exists (select 1 from list_items where text in ('Mine', 'Theirs')), 'items deleted with it';
end $$;

select 'household tools tests passed' as result;
