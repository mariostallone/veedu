-- Household tools: regenerate the invite code, leave a household.

-- Any member can replace the invite code (e.g. after sharing it with the wrong person).
-- The old code stops working immediately.
create or replace function public.regenerate_invite_code()
returns public.households
language plpgsql security definer set search_path = public
as $$
declare
  v_household_id uuid;
  v_household public.households;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select household_id into v_household_id from public.household_members
    where user_id = auth.uid() limit 1;
  if v_household_id is null then
    raise exception 'You are not in a household' using errcode = 'P0002';
  end if;

  loop
    v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6));
    exit when not exists (select 1 from public.households where invite_code = v_code);
  end loop;

  update public.households set invite_code = v_code where id = v_household_id
    returning * into v_household;
  return v_household;
end;
$$;

-- Leaves the caller's household. To-dos assigned to them become unassigned. When the last member
-- leaves, the household and everything in it is deleted (nobody could ever open it again).
-- Afterwards the caller may create or join another household.
create or replace function public.leave_household()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select household_id into v_household_id from public.household_members
    where user_id = auth.uid() limit 1;
  if v_household_id is null then
    raise exception 'You are not in a household' using errcode = 'P0002';
  end if;

  update public.list_items set owner_id = null
    where household_id = v_household_id and owner_id = auth.uid();
  delete from public.household_members
    where household_id = v_household_id and user_id = auth.uid();

  if not exists (select 1 from public.household_members where household_id = v_household_id) then
    delete from public.households where id = v_household_id;
  end if;
end;
$$;

revoke all on function public.regenerate_invite_code() from public;
revoke all on function public.leave_household() from public;
grant execute on function public.regenerate_invite_code() to authenticated;
grant execute on function public.leave_household() to authenticated;
