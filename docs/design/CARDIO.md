# Design: cardio days (jump rope, bike, run, ...)

Status: implemented (v2). The shipped model differs from the first proposal below in one way: a cardio day is a
**program of timed steps** (`CardioBlock[]`, each block repeats a list of `CardioStep`s) instead of a single
steady/interval switch, because users want fully custom timers (fast/slow rope rounds, run types, any machine).
See `src/cardio.ts` (programs, timeline, styles), `src/views/Cardio.tsx` (runner, editor) and the tests in
`src/logic.test.ts`. Distance from the tracker is not read yet; distance is entered by hand after the session.

## Goal

Let a plan day be a **cardio day** (jump rope, bike, run, row, walk, swim, custom) with its own warm-up,
separate from strength days. Cardio days must work with the same rotation, history, sync and Fitbit
integration as strength days, but log time, distance and intensity instead of sets, reps and kg.

## Principles

1. **One plan, one history.** Cardio is not a second app. A plan day gets a `kind`, and everything
   else (rotation, logs, cloud sync, export, Fitbit) keeps working on days and logs.
2. **Backward compatible.** Existing data has no `kind`; a missing `kind` means `strength`.
   No migration of stored plan/log JSON is needed (JSON columns), so no Supabase migration either.
3. **Fitbit is the source of truth for physiology** (heart rate, calories, distance, zones).
   The app stores what the user did and the planned target, and links the tracker data on top.
4. **Small surface.** Reuse the session, rest-free timer, warm-up and finish flow instead of
   writing a parallel one.

## Data model (`src/types.ts`)

```ts
type DayKind = 'strength' | 'cardio'

type CardioActivity = 'jump-rope' | 'bike' | 'run' | 'walk' | 'row' | 'swim' | 'elliptical' | 'other'

interface PlanDay {
  // existing: id, title, focus, exercises
  kind?: DayKind                 // undefined = 'strength'
  cardio?: CardioPlan            // present when kind === 'cardio'
}

interface CardioPlan {
  activity: CardioActivity
  warmupMin: number              // 0 = none, default 5
  cooldownMin: number            // default 3
  mode: 'steady' | 'intervals'
  targetMin?: number             // steady: total working minutes
  targetKm?: number              // optional distance goal
  zone?: 1 | 2 | 3 | 4 | 5       // optional target heart-rate zone (uses maxHr setting)
  intervals?: { workSec: number; restSec: number; rounds: number }  // intervals mode
}
```

Why not model cardio as exercises with sets? Because time and distance are the numbers, "4 x 12 reps"
is meaningless for a 30 min ride, and the strength records/volume/e1RM logic would be polluted.

### Log (`WorkoutLog`)

```ts
interface WorkoutLog {
  // existing fields stay
  kind?: DayKind
  cardio?: CardioResult          // present for cardio logs; items = [] , volume = 0, sets = 0
}

interface CardioResult {
  activity: CardioActivity
  warmupSec: number
  workSec: number                // time between "start work" and finish (or sum of interval rounds)
  cooldownSec: number
  km: number | null              // manual entry, or filled from the tracker
  rounds: number | null          // completed intervals
  avgHr: number | null           // from the tracker when linked
  maxHr: number | null
  kcal: number | null
  rpe: number | null             // optional 1-10 perceived effort
}
```

`health` / `healthExport` on the log are reused unchanged, so the existing per-workout heart-rate
panel, zone breakdown and write-back apply to cardio logs too.

## Session flow

The existing session already has `warmStart`/`warmSec`. A cardio session adds a small state machine:

```
idle -> warmup -> work -> cooldown -> done
```

- `warmup`: countdown for `warmupMin`, skippable. Shows a short warm-up checklist per activity.
- `work` steady: elapsed timer, optional target (minutes/km), live HR with zone colour vs the target zone.
- `work` intervals: automatic work/rest phases with beep + vibration, round counter, wake lock kept.
- `cooldown`: countdown, skippable. Then Finish.
- Finish builds a `WorkoutLog` with `kind: 'cardio'`; distance and RPE are asked in the summary sheet
  (distance prefilled from the tracker when available).

Implementation: a `session.cardio?: { phase, phaseStartedAt, round }` field, a pure reducer
`nextCardioPhase()` in `src/logic.ts` (testable), and one new view `src/views/Cardio.tsx`.
The Workout tab renders `Cardio` instead of the exercise list when `day.kind === 'cardio'`.
The top session bar, Finish/cancel, wake lock, HR poller and rest-bar plumbing are reused.

## Warm-up library

`src/cardio.ts`: a static table `activity -> { icon, label, defaultWarmupMin, warmup: string[], cooldown: string[] }`.
Examples: jump rope = 2 min ankle hops + calf/wrist circles, 3 easy low jumps; bike = 5 min spin in easy gear;
run = 5 min brisk walk + leg swings + 3 strides. Text only, English, easy to extend by contributors.
Presets for new days: "Jump rope 20 min intervals 30/30", "Easy bike 40 min zone 2", "Easy run 30 min", etc.

## Plan editing

In the day editor, "Add day" asks Strength or Cardio. A cardio day edits the `CardioPlan` form
(activity, warm-up/cool-down minutes, mode, targets). Day rotation (`nextDayIndex`) is unchanged, so cardio
days can sit in the rotation, or be marked "extra" later (out of scope for v1).

## Fitbit / Google Health

Reading (already built, extended):
- Per-workout panel: avg/max HR, zones, kcal for the time window of the log. Works as is.
- Distance: add the `distance` data type to the `workout` action for the window; show km and pace/speed.
- Auto-detected exercises: Fitbit often records a run/bike/jump-rope session itself. For a cardio log,
  match the tracker exercise whose time overlaps the window and use its distance/calories (overlap > 50 %).
  The log's `health` block stores the matched summary so charts do not need the API again.

Writing (already built, extended):
- `exportWorkout` maps `CardioActivity` to the Google Health exercise type (run, bike, jump rope, walk, row, swim, elliptical, other)
  instead of always "weightlifting". Distance is sent when present.
- Dedupe: if the tracker already recorded the same window (overlap), skip the export and link instead, so the
  workout is not duplicated in Fitbit.

Live: the live HR poller and zone alerts already work; for cardio the alert compares to the day's target zone
(too low / too high) instead of only the max-HR percentage.

## Stats and records

- Strength stats (volume, e1RM, sets per muscle, weekly sets) ignore cardio logs: filter on `kind !== 'cardio'`.
  Existing code that reads `log.items` keeps working because cardio logs have `items = []`.
- New cardio stats card: minutes and km per week, sessions per activity, average HR trend,
  best pace per activity (run/bike), longest session. Streaks and "days trained" count both kinds.
- Records (`findRecords`) get a cardio branch: longest duration, longest distance, best average pace for
  a given distance bucket.
- Recovery (`recovery()`): cardio contributes load by duration x intensity so a hard bike day is reflected.

## Sync, export, compatibility

- Plan and logs are JSON in existing columns: no SQL migration. Old clients ignore `kind`/`cardio`
  and would show a cardio day as an empty strength day, so release notes advise updating all devices.
- `normalizeState` validates the new fields (clamp minutes, known activity, finite numbers) and defaults
  `kind` to strength.
- JSON/CSV export gets cardio columns (activity, minutes, km, avg HR).

## Edge cases

- Cardio log without tracker data: still valid, only time and manual km/RPE.
- Imported plan keeps working: all existing days are strength.
- The weight carry-forward (`weightsToCarry`) only looks at strength days.
- Cancelled cardio session: same discard path as strength.
- Units: distance follows the kg/lb setting (km vs mi), stored in km.

## Implementation plan

1. Types + `normalizeState` + pure logic (`nextCardioPhase`, pace, cardio week stats) with tests.
2. Warm-up library and presets (`src/cardio.ts`).
3. Day editor: choose kind, cardio form. Plan list shows an activity badge.
4. `Cardio.tsx` session view: phases, intervals, live HR zone, summary sheet fields.
5. Stats/records/recovery changes and the cardio stats card.
6. Edge function: distance read, exercise type mapping on write, overlap matching and dedupe.
7. Docs: README, GOOGLE-HEALTH.md, CHANGELOG, a screenshot in demo mode.

Steps 1 to 5 are app-only and ship together; step 6 needs a redeploy of the `health` edge function.

## Decisions to confirm

1. Should a cardio day be part of the rotation, or an optional "extra" day shown separately?
   Proposal: in the rotation like any day, "extra" later.
2. Intervals in v1, or steady-state only first? Proposal: both (jump rope is naturally intervals).
3. When the tracker already recorded the session: link it (proposal) or still write our own?
