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
    settings.tsx         invite code, members, names, sign out
src/features/<feature>/  data hooks (api.ts) and feature components
src/components/ui.tsx    shared UI building blocks
src/lib/                 Supabase client, session, realtime sync, pure domain logic
supabase/migrations/     schema, RLS policies, triggers, RPCs
supabase/tests/          database behaviour tests
```

## Roadmap

Work is split into milestones tracked as GitHub issues and milestones.
