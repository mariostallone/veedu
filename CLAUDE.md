@AGENTS.md

# Veedu project conventions

Read README.md for what the app does. These rules keep parallel milestone work from colliding.

## Where code goes
- Routes only in `src/app`. Tabs live in `src/app/(app)/(tabs)/`; other signed-in screens (editors, detail pages) go in `src/app/(app)/<feature>/…`. Set a screen's header with `<Stack.Screen options={{ title }} />` inside the screen file. Do not edit `src/app/_layout.tsx` or `src/app/(app)/_layout.tsx` unless the milestone says so.
- Feature components and hooks go in `src/features/<feature>/`. Data access lives in that feature's `api.ts` (React Query + Supabase). Reuse the hooks in `src/features/lists/api.ts` and `src/features/pantry/api.ts` before writing new queries.
- Build UI from `src/components/ui.tsx` and colours/spacing from `src/theme.ts` (`useColors()`); no hard-coded colours. Add a shared component there only if two features need it.
- Pure logic (dates, grouping, maths) goes in `src/lib/domain.ts` with tests in `src/lib/domain.test.ts`. Keep `domain.ts` import-free so `node --test` runs it.

## Data rules
- The database already handles pantry ↔ shopping syncing, household_id on list items, done_at/done_by and repeating to-dos (see `supabase/migrations`). Do not reimplement these in the app.
- Schema changes go in a NEW migration file `supabase/migrations/<timestamp>_<name>.sql`, never by editing an existing one, and come with behaviour tests in `supabase/tests/` that pass under `npm run test:db`.
- Update `src/lib/types.ts` when the schema changes.
- Dates are ISO strings `YYYY-MM-DD`; get today with `toIsoDate(new Date())`.

## Before you finish
Run all four and make them pass: `npm run typecheck`, `npx expo lint`, `npm test`, `npm run test:db`.
`npx expo install` and docs.expo.dev may be blocked by the network; when they are, use `EXPO_OFFLINE=1 npx expo install <pkg>`, which takes versions from `node_modules/expo/bundledNativeModules.json`, and read API types in `node_modules` instead of the docs.
