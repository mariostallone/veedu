-- Notifications: Expo push tokens, per-person preferences, and the SQL helpers the Edge Functions use.
--   * notify-activity (Database Webhook on list_items INSERT) tells the other members about new shopping items
--   * daily-digest (hourly schedule) sends expiring items, to-dos due today and overdue to-dos

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  token        text not null unique check (length(token) between 10 and 200),
  platform     text not null check (platform in ('ios', 'android', 'web')),
  household_id uuid references public.households on delete cascade,
  created_at   timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.notification_prefs (
  user_id          uuid primary key default auth.uid() references auth.users on delete cascade,
  household_id     uuid references public.households on delete cascade,
  partner_activity boolean not null default true,
  daily_digest     boolean not null default true,
  digest_hour      integer not null default 8 check (digest_hour between 0 and 23),
  timezone         text not null default 'UTC' check (length(timezone) between 1 and 64)
);

-- Which list items have already been announced, so each item is notified exactly once
-- even when several webhook calls race.
create table public.notified_list_items (
  list_item_id uuid primary key references public.list_items on delete cascade,
  notified_at  timestamptz not null default now()
);

alter table public.push_tokens          enable row level security;
alter table public.notification_prefs   enable row level security;
alter table public.notified_list_items  enable row level security;  -- no policies: service role only

create policy "own tokens" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own prefs" on public.notification_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Client RPC: a token belongs to a device, so it moves to whoever signs in on it.
-- (A plain upsert could not take over a row owned by the previous user because of RLS.)
-- ---------------------------------------------------------------------------

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_household uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select household_id into v_household from public.household_members
    where user_id = auth.uid() limit 1;
  insert into public.push_tokens (user_id, token, platform, household_id)
    values (auth.uid(), p_token, p_platform, v_household)
    on conflict (token) do update
      set user_id = excluded.user_id, platform = excluded.platform, household_id = excluded.household_id;
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql security definer set search_path = public
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers for the Edge Functions (service role only)
-- ---------------------------------------------------------------------------

-- Atomically claims the shopping items one person added to a household since p_since that were not
-- announced yet, and returns them. Auto-added pantry restocks are not "added by" anyone, so skipped.
create or replace function public.claim_activity_items(p_household uuid, p_actor uuid, p_since timestamptz)
returns table (id uuid, text text)
language sql security definer set search_path = public
as $$
  with candidates as (
    select li.id from public.list_items li
      join public.lists l on l.id = li.list_id
      where li.household_id = p_household
        and l.kind = 'shopping'
        and li.created_by = p_actor
        and li.source <> 'pantry'
        and li.created_at >= p_since
        and not exists (select 1 from public.notified_list_items n where n.list_item_id = li.id)
  ), claimed as (
    insert into public.notified_list_items (list_item_id)
      select c.id from candidates c
      on conflict do nothing
      returning list_item_id
  )
  select li.id, li.text from public.list_items li
    join claimed on claimed.list_item_id = li.id
    order by li.created_at;
$$;

-- Push tokens of the other household members who want partner-activity notifications
-- (members with no saved preferences get the default: on).
create or replace function public.activity_targets(p_household uuid, p_actor uuid)
returns table (user_id uuid, token text)
language sql stable security definer set search_path = public
as $$
  select m.user_id, t.token
  from public.household_members m
    join public.push_tokens t on t.user_id = m.user_id
    left join public.notification_prefs p on p.user_id = m.user_id
  where m.household_id = p_household
    and m.user_id <> p_actor
    and coalesce(p.partner_activity, true);
$$;

-- What the daily digest says for one person on their local date p_today:
-- pantry items expiring within 7 days, and open to-dos due today or overdue
-- (their own and unassigned ones).
create or replace function public.digest_for(p_user uuid, p_today date)
returns table (kind text, title text, on_date date)
language sql stable security definer set search_path = public
as $$
  select 'expiring'::text, pi.name, pi.expires_on
  from public.pantry_items pi
  where pi.household_id in (select household_id from public.household_members where user_id = p_user)
    and pi.qty > 0
    and pi.expires_on between p_today and p_today + 7
  union all
  select case when li.due_on < p_today then 'overdue' else 'due_today' end, li.text, li.due_on
  from public.list_items li
    join public.lists l on l.id = li.list_id
  where l.kind = 'todo'
    and l.household_id in (select household_id from public.household_members where user_id = p_user)
    and not li.done
    and li.due_on <= p_today
    and (li.owner_id is null or li.owner_id = p_user)
  order by 1, 3, 2;
$$;

-- Digest recipients: everyone with the digest on and at least one token, with their local settings.
create or replace function public.digest_targets()
returns table (user_id uuid, token text, digest_hour integer, timezone text)
language sql stable security definer set search_path = public
as $$
  select p.user_id, t.token, p.digest_hour, p.timezone
  from public.notification_prefs p
    join public.push_tokens t on t.user_id = p.user_id
  where p.daily_digest
    and exists (select 1 from public.household_members m where m.user_id = p.user_id);
$$;

-- Expo reports tokens that no longer work; the functions delete them.
create or replace function public.prune_push_tokens(p_tokens text[])
returns void
language sql security definer set search_path = public
as $$
  delete from public.push_tokens where token = any (p_tokens);
$$;

-- These are for the Edge Functions (service role), never for signed-in users.
revoke all on function public.claim_activity_items(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.activity_targets(uuid, uuid) from public, anon, authenticated;
revoke all on function public.digest_for(uuid, date) from public, anon, authenticated;
revoke all on function public.digest_targets() from public, anon, authenticated;
revoke all on function public.prune_push_tokens(text[]) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_activity_items(uuid, uuid, timestamptz) to service_role;
    grant execute on function public.activity_targets(uuid, uuid) to service_role;
    grant execute on function public.digest_for(uuid, date) to service_role;
    grant execute on function public.digest_targets() to service_role;
    grant execute on function public.prune_push_tokens(text[]) to service_role;
  end if;
end;
$$;
