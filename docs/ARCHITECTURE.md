# Architecture

liftlog is a static single-page app. There is no backend of its own.

```
Browser (Preact + TypeScript)
 ├─ src/store.ts     local-first state in localStorage, every change goes through update()
 ├─ src/logic.ts     pure functions: plates, records, streaks, stats, merging (unit tested)
 ├─ src/catalog.ts   exercise catalog (bundled JSON) + the user's own exercises
 ├─ src/cloud.ts     optional Supabase auth and two-way sync
 └─ views/           Workout, Library, History, Stats, More
        │
        ▼  (only when VITE_SUPABASE_* are set and the user signs in)
Supabase: Auth + Postgres with Row Level Security
```

## Local first

The app always works from `localStorage`. The cloud is a mirror, not a dependency. Weights are stored in **kilograms** and converted for display (`src/units.ts`).

## Exercise catalog

`catalog/exercises/*.json` is the source of truth, one file per exercise, validated by `scripts/catalog.mjs`. `npm run catalog:build` (run automatically before `dev` and `build`) writes:

* `src/data/catalog.json` — bundled into the app (git-ignored)
* `supabase/seed.sql` — optional table copy for people who want to query it

`catalog/collections/*.json` are the curated "Top lists".

## Data model

```
AppState
 ├─ plan:     PlanDay[] → PlanExercise[]   (key = catalog slug or "custom:<id>")
 ├─ custom:   CustomExercise[]             (steps, cues, video references)
 ├─ settings: units, bar/plates, rest, goal…
 ├─ session:  running workout (sets per exercise, working weight/reps)
 └─ logs:     WorkoutLog[] → LogItem[] → SetRec[] {kg, reps}
```

History stores a snapshot of exercise names and muscles, so renaming or deleting an exercise never rewrites the past.

## Sync

| Data | Table | Strategy |
|---|---|---|
| Finished workouts | `workout_logs` (one row each, client-generated uuid) | Merge by id, newest `updatedAt` wins, deletes are soft (`deleted_at`). Two devices cannot overwrite each other's history. |
| Plan, own exercises, settings | `user_data` (one row per user) | Last write wins by `updatedAt`. On the first sign-in of a device with a different local plan, the user is asked which to keep. |

Sync runs a few seconds after a change, on reconnect, and when the app returns to the foreground. Logs are pulled incrementally with a small overlap window and paginated.

## Security model

All authorisation is Row Level Security in Postgres (`supabase/migrations/0001_init.sql`). The client only holds the public URL and anon key.

## Optional Fitbit / Pixel Watch integration

```
src/health.ts       client for the Edge Function (status, today, workout, live, export…)
src/live.ts         ~20 s polling of the latest heart rate while a workout runs, zones and alerts
src/export.ts       sending finished workouts to Google Health (manual or automatic, never duplicates)
src/views/Health.tsx  Today panel, workout heart-rate block, Google Health settings card
supabase/functions/health            all actions behind your login (JWT)
supabase/functions/health-callback   OAuth redirect target (no JWT, one-time state)
supabase/migrations/0002_google_health.sql   token + state tables, server-only
```

The browser only ever receives summaries. The Google refresh token and client secret exist only inside the Edge Functions and the `health_connections` table, which has Row Level Security on, no policies and no grants for client roles. Full description in [GOOGLE-HEALTH.md](GOOGLE-HEALTH.md).

Related data: `WorkoutLog.health` (summary), `WorkoutLog.healthExport` (what was sent to Google), `BodyEntry` (weight log, table `body_logs`, merged like workouts), `Settings.hr*` and `export*`.

## Tests

`npm test` runs Vitest on the pure logic (`src/logic.test.ts`, `src/units.test.ts`) and checks the catalog and templates (`src/catalog.test.ts`). CI also validates every exercise file and, weekly and on pull requests, that every YouTube/TikTok reference still exists.
