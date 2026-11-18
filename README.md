# Veedu · வீடு

A shared household app for two people: **pantry inventory**, **shopping list**, **trip lists** (gifts for the India trip) and **to-dos**, synced live between both phones.

Built with Expo (iOS, Android, web) and Supabase (auth, Postgres, realtime).

## How it fits together

- Each person signs in with an emailed one-time code, then creates a household or joins one with an invite code.
- **Pantry and shopping are linked in the database** (`supabase/migrations`):
  - when a pantry item's count drops below its *keep at least* level, it is added to the shopping list with the amount to buy;
  - checking a linked shopping item off adds that amount back to the pantry (unchecking undoes it);
  - a shopping item typed by hand is linked to the pantry item with the same name.
- Repeating to-dos create their next occurrence when checked off.
- Every change is pushed to the other phone through Supabase Realtime.

## Set up

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/migrations/20261118000000_init.sql` (or `supabase db push` with the Supabase CLI).
3. **Auth → Email templates → Magic link**: include the code so people can type it in, e.g. `Your Veedu code is {{ .Token }}`.
4. Copy `.env.example` to `.env` and fill in the project URL and anon key (Project Settings → API).
5. Install and run:

```bash
npm install
```

```bash
npx expo start
```

Open it in Expo Go, an iOS simulator, an Android emulator, or press `w` for the web.

## Notifications

Push notifications use Expo's push service. Two Edge Functions send them; the app only registers its token and stores preferences (Settings → Notifications).

1. **EAS project id.** Run `npx eas-cli@latest init` once so `extra.eas.projectId` exists in `app.json`. Without it the app skips push registration (it logs a warning). Push needs a physical device and a development or production build, not Expo Go, and is skipped on web. iOS and Android credentials are set up through EAS (`eas credentials`).
2. **Migration.** Apply `supabase/migrations/20261118040000_notifications.sql` (`push_tokens`, `notification_prefs` and the helper functions).
3. **Deploy the functions** with the Supabase CLI:

```bash
supabase functions deploy notify-activity --no-verify-jwt
```

```bash
supabase functions deploy daily-digest --no-verify-jwt
```

```bash
supabase secrets set WEBHOOK_SECRET=<a long random string>
```

   Both functions refuse requests without the header `x-webhook-secret: <WEBHOOK_SECRET>`.
4. **Partner activity.** Dashboard → Database → Webhooks → create a webhook on table `list_items`, event `Insert`, type *Supabase Edge Functions*, function `notify-activity`, with the HTTP header `x-webhook-secret`. A burst of added items is held for about 20 seconds and sent as one message ("Priya added 5 items to Shopping") to the other members.
5. **Daily digest.** Schedule the function hourly (each person gets it at their own chosen local hour), for example with pg_cron and pg_net:

```sql
select cron.schedule('veedu-daily-digest', '0 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/daily-digest',
    headers := '{"x-webhook-secret": "<WEBHOOK_SECRET>"}'::jsonb
  );
$$);
```

The message-building, batching and time-zone logic lives in `supabase/functions/_shared/notify.ts` and is covered by `npm test`.

## Checks

```bash
npm run typecheck
```

```bash
npx expo lint
```

```bash
npm test
```

```bash
npm run test:db
```

`test:db` spins up a throwaway local Postgres (needs `initdb`/`pg_ctl`/`psql`), applies the migrations on top of a small stub of Supabase's `auth` schema, and runs the behaviour tests in `supabase/tests`.

## Layout

```
src/app/                 routes (Expo Router)
  sign-in.tsx            email code sign-in
  onboarding.tsx         create or join a household
  (app)/                 everything behind sign-in
    (tabs)/              Home, Pantry, Shop, Trips, To-do
    settings.tsx         invite code, members, notifications, names, sign out
src/features/<feature>/  data hooks (api.ts) and feature components
src/components/ui.tsx    shared UI building blocks
src/lib/                 Supabase client, session, realtime sync, pure domain logic
supabase/migrations/     schema, RLS policies, triggers, RPCs
supabase/functions/      Edge Functions (notify-activity, daily-digest) and tested shared logic
supabase/tests/          database behaviour tests
```

## Roadmap

Work is split into milestones tracked as GitHub issues and milestones.
