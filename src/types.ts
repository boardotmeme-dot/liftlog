export type Muscle =
  | 'chest' | 'back' | 'lats' | 'traps' | 'shoulders' | 'rear-delts' | 'biceps' | 'triceps'
  | 'forearms' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs' | 'lower-back' | 'neck'

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'ez-bar'
  | 'kettlebell' | 'band' | 'smith-machine' | 'other'

export interface Reference {
  type: 'video' | 'article'
  platform: 'youtube' | 'tiktok' | 'instagram' | 'web'
  url: string
  title: string
  author: string
  checked: string
}

/** One entry of catalog/exercises/*.json */
export interface CatalogExercise {
  slug: string
  name: string
  aliases?: string[]
  muscle_group: Muscle
  secondary: Muscle[]
  equipment: Equipment
  mechanic: 'compound' | 'isolation'
  level: 'beginner' | 'intermediate' | 'advanced'
  summary: string
  setup: string[]
  execution: string[]
  cues: string[]
  mistakes: string[]
  default_sets: number
  default_reps: string
  references: Reference[]
}

/** An exercise the user created. Key in history is `custom:<id>`. */
export interface CustomExercise {
  id: string
  name: string
  group: Muscle
  equipment: Equipment
}

export interface PlanExercise {
  id: string
  /** `<slug>` for catalog exercises, `custom:<id>` for custom ones. Stable across renames. */
  key: string
  kg: number | null
  sets: number
  reps: string
  note: string
}

export interface PlanDay {
  id: string
  title: string
  focus: string
  exercises: PlanExercise[]
}

export interface Settings {
  barKg: number
  plates: number[]
  /** rest after a set of a compound (or unknown) exercise */
  restSec: number
  /** rest after a set of an isolation exercise */
  restIsolationSec: number
  /** use restIsolationSec for isolation exercises instead of restSec for everything */
  smartRest: boolean
  vibrate: boolean
  /** workouts per week you aim for */
  weeklyGoal: number
}

/** One logged set. */
export interface SetRec {
  kg: number | null
  reps: number
}

export interface Session {
  id: string
  dayId: string
  startedAt: number
  warmStart: number | null
  warmSec: number
  /** exercise-instance id -> logged set per slot (null = not done) */
  sets: Record<string, (SetRec | null)[]>
  /** working weight / reps for the next set, keyed by exercise-instance id (falls back to the plan) */
  kg: Record<string, number | null>
  reps: Record<string, number>
  restEnd: number | null
  restNotified: boolean
}

export interface LogItem {
  key: string
  name: string
  group: Muscle
  equipment: Equipment
  /** heaviest set */
  kg: number | null
  /** reps of the heaviest set */
  reps: number
  done: number
  planned: number
  /** every set as logged */
  sets: SetRec[]
}

export interface PersonalRecord {
  key: string
  name: string
  kind: 'weight' | 'e1rm' | 'reps'
  value: number
  previous: number | null
}

export interface WorkoutLog {
  id: string
  startedAt: number
  endedAt: number
  title: string
  focus: string
  durationSec: number
  warmSec: number
  items: LogItem[]
  sets: number
  volume: number
  updatedAt: number
  deletedAt: number | null
}

export interface AppState {
  v: 1
  plan: PlanDay[]
  custom: CustomExercise[]
  settings: Settings
  session: Session | null
  logs: WorkoutLog[]
  planUpdatedAt: number
}

export const DEFAULT_SETTINGS: Settings = {
  barKg: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  restSec: 120,
  restIsolationSec: 60,
  smartRest: true,
  vibrate: true,
  weeklyGoal: 3,
}
