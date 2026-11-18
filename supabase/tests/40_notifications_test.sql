-- Behaviour tests for 20261118040000_notifications.sql
\set ON_ERROR_STOP on
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'f1@example.com'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@example.com'),
  ('00000000-0000-0000-0000-0000000000f3', 'f3@example.com'),
  ('00000000-0000-0000-0000-0000000000f4', 'f4@example.com');

set role authenticated;

-- F1 and F2 share a household; F3 is in another one; F4 has no household
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select (public.create_household('Notify home', 'Priya')).invite_code as code \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
select public.join_household(:'code', 'Arjun');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f3';
select public.create_household('Other home', 'Mina');

-- Tokens: registered through the RPC, each person sees only their own
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select public.register_push_token('ExponentPushToken[priya-phone]', 'ios');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
select public.register_push_token('ExponentPushToken[arjun-phone]', 'android');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f3';
select public.register_push_token('ExponentPushToken[mina-phone]', 'ios');
do $$ begin
  assert (select count(*) from public.push_tokens) = 1, 'a person sees only their own token';
  assert (select household_id from public.push_tokens) is not null, 'token carries the household';
end $$;

-- Registering twice is idempotent; a device signed in as someone else moves to them
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
select public.register_push_token('ExponentPushToken[arjun-phone]', 'android');
do $$ begin
  assert (select count(*) from public.push_tokens) = 1, 'no duplicate token rows';
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f4';
do $$ begin
  perform public.register_push_token('ExponentPushToken[x]', 'blackberry');
  assert false, 'platform check should apply';
exception when check_violation then null;
end $$;
select public.register_push_token('ExponentPushToken[mina-phone]', 'ios');   -- F4 takes over the device
do $$ begin
  assert (select count(*) from public.push_tokens where token = 'ExponentPushToken[mina-phone]') = 1, 'one row for the device';
  assert (select user_id from public.push_tokens where token = 'ExponentPushToken[mina-phone]')
    = '00000000-0000-0000-0000-0000000000f4', 'token moved to the new user';
end $$;
select public.unregister_push_token('ExponentPushToken[mina-phone]');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f3';
select public.register_push_token('ExponentPushToken[mina-phone]', 'ios');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f4';
select public.unregister_push_token('ExponentPushToken[mina-phone]');          -- not theirs: no effect
reset role;
do $$ begin
  assert (select count(*) from public.push_tokens) = 3, 'unregister only removes your own token';
end $$;
set role authenticated;

-- Direct writes cannot spoof another user
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
do $$ begin
  insert into public.push_tokens (user_id, token, platform)
    values ('00000000-0000-0000-0000-0000000000f1', 'ExponentPushToken[spoof]', 'ios');
  assert false, 'cannot insert a token for someone else';
exception when sqlstate '42501' then null;
end $$;

-- Preferences: defaults, own rows only
insert into public.notification_prefs (user_id, household_id)
  select '00000000-0000-0000-0000-0000000000f2', household_id from public.household_members
  where user_id = '00000000-0000-0000-0000-0000000000f2';
do $$ begin
  assert (select partner_activity and daily_digest and digest_hour = 8 and timezone = 'UTC'
          from public.notification_prefs), 'defaults: both on, 08:00 UTC';
  insert into public.notification_prefs (user_id, digest_hour) values ('00000000-0000-0000-0000-0000000000f1', 9);
  assert false, 'cannot write someone else''s prefs';
exception when sqlstate '42501' then null;
end $$;
do $$ begin
  update public.notification_prefs set digest_hour = 24;
  assert false, 'hour is 0-23';
exception when check_violation then null;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
do $$ begin
  assert (select count(*) from public.notification_prefs) = 0, 'F1 does not see F2''s prefs';
end $$;

-- Service-only helpers are closed to signed-in users
do $$ begin
  perform public.digest_for('00000000-0000-0000-0000-0000000000f1', current_date);
  assert false, 'digest_for is service only';
exception when sqlstate '42501' then null;
end $$;
do $$ begin
  perform * from public.activity_targets(gen_random_uuid(), gen_random_uuid());
  assert false, 'activity_targets is service only';
exception when sqlstate '42501' then null;
end $$;

-- Data for the activity and digest checks (F1 = Priya, F2 = Arjun)
select household_id as hh from public.household_members where user_id = '00000000-0000-0000-0000-0000000000f1' \gset
select id as shop_list from public.lists where household_id = :'hh' and kind = 'shopping' \gset
select id as todo_list from public.lists where household_id = :'hh' and kind = 'todo' \gset
insert into public.list_items (list_id, text) values (:'shop_list', 'Ghee'), (:'shop_list', 'Rice'), (:'shop_list', 'Atta');
insert into public.list_items (list_id, text, source) values (:'shop_list', 'Auto restock', 'pantry');
insert into public.list_items (list_id, text) values (:'todo_list', 'Not a shopping item');

reset role;

-- activity_targets: the other member, honouring their preference; never the actor or another household
do $$ begin
  assert (select array_agg(token) from public.activity_targets(
            (select household_id from public.household_members where user_id = '00000000-0000-0000-0000-0000000000f1'),
            '00000000-0000-0000-0000-0000000000f1')) = array['ExponentPushToken[arjun-phone]'], 'Arjun is notified of Priya';
  assert (select array_agg(token) from public.activity_targets(
            (select household_id from public.household_members where user_id = '00000000-0000-0000-0000-0000000000f1'),
            '00000000-0000-0000-0000-0000000000f2')) = array['ExponentPushToken[priya-phone]'],
    'Priya has no prefs row, so the default (on) applies';
end $$;
update public.notification_prefs set partner_activity = false where user_id = '00000000-0000-0000-0000-0000000000f2';
do $$ begin
  assert not exists (select 1 from public.activity_targets(
            (select household_id from public.household_members where user_id = '00000000-0000-0000-0000-0000000000f1'),
            '00000000-0000-0000-0000-0000000000f1')), 'opted-out partner is skipped';
end $$;
update public.notification_prefs set partner_activity = true where user_id = '00000000-0000-0000-0000-0000000000f2';

-- claim_activity_items: shopping items by that person only, pantry restocks excluded, each claimed once
select count(*) as first_claim from public.claim_activity_items(:'hh', '00000000-0000-0000-0000-0000000000f1', now() - interval '5 minutes') \gset
select count(*) as second_claim from public.claim_activity_items(:'hh', '00000000-0000-0000-0000-0000000000f1', now() - interval '5 minutes') \gset
select count(*) as other_actor from public.claim_activity_items(:'hh', '00000000-0000-0000-0000-0000000000f2', now() - interval '5 minutes') \gset
select set_config('t.c1', :'first_claim', false), set_config('t.c2', :'second_claim', false), set_config('t.c3', :'other_actor', false) \gset ignore_
do $$ begin
  assert current_setting('t.c1') = '3', 'claims the three shopping items (not the pantry restock or the to-do)';
  assert current_setting('t.c2') = '0', 'items are only announced once';
  assert current_setting('t.c3') = '0', 'other people''s items are not claimed';
end $$;

-- Digest: expiring in 7 days, due today, overdue; skips done, far-future, other owners
insert into public.pantry_items (household_id, name, qty, expires_on, created_by) values
  (:'hh', 'Milk', 1, current_date + 3, null),
  (:'hh', 'Yogurt', 1, current_date + 7, null),
  (:'hh', 'Old paneer', 1, current_date + 8, null),
  (:'hh', 'Gone spice', 0, current_date + 2, null),
  (:'hh', 'Long life', 1, null, null);
insert into public.list_items (list_id, text, due_on, owner_id) values
  (:'todo_list', 'Pay rent', current_date, null),
  (:'todo_list', 'Call Amma', current_date - 2, '00000000-0000-0000-0000-0000000000f1'),
  (:'todo_list', 'Arjun''s errand', current_date, '00000000-0000-0000-0000-0000000000f2'),
  (:'todo_list', 'Next week', current_date + 1, null);
insert into public.list_items (list_id, text, due_on, done) values (:'todo_list', 'Finished', current_date, true);
do $$ declare r text; begin
  select string_agg(kind || ':' || title, ',' order by kind, on_date, title)
    into r from public.digest_for('00000000-0000-0000-0000-0000000000f1', current_date);
  assert r = 'due_today:Pay rent,expiring:Milk,expiring:Yogurt,overdue:Call Amma', 'Priya digest: ' || r;
  select string_agg(kind || ':' || title, ',' order by kind, on_date, title)
    into r from public.digest_for('00000000-0000-0000-0000-0000000000f2', current_date);
  assert r like '%due_today:Arjun''s errand%' and r not like '%Call Amma%', 'Arjun digest: ' || r;
  assert not exists (select 1 from public.digest_for('00000000-0000-0000-0000-0000000000f3', current_date)),
    'another household sees nothing';
  assert not exists (select 1 from public.digest_for('00000000-0000-0000-0000-0000000000f4', current_date)),
    'a user with no household sees nothing';
end $$;

-- digest_targets: opted-in users with tokens only
update public.notification_prefs set daily_digest = false where user_id = '00000000-0000-0000-0000-0000000000f2';
do $$ begin
  assert not exists (select 1 from public.digest_targets()), 'digest off, nobody to notify';
end $$;
update public.notification_prefs set daily_digest = true, digest_hour = 7, timezone = 'Asia/Kolkata'
  where user_id = '00000000-0000-0000-0000-0000000000f2';
do $$ begin
  assert (select digest_hour = 7 and timezone = 'Asia/Kolkata' and token = 'ExponentPushToken[arjun-phone]'
          from public.digest_targets()), 'digest target carries local hour and zone';
end $$;

-- Pruning dead tokens, and cascades
select public.prune_push_tokens(array['ExponentPushToken[arjun-phone]']);
do $$ begin
  assert not exists (select 1 from public.push_tokens where token = 'ExponentPushToken[arjun-phone]'), 'pruned';
end $$;
