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
  /** preview image, filled for links added by the user (TikTok) */
  thumbnail?: string
  /** iframe URL for an inline player, when the platform offers one */
  embedUrl?: string
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
  secondary?: Muscle[]
  mechanic?: 'compound' | 'isolation'
  level?: 'beginner' | 'intermediate' | 'advanced'
  summary?: string
  setup?: string[]
  execution?: string[]
  cues?: string[]
  mistakes?: string[]
  defaultSets?: number
  defaultReps?: string
  references?: Reference[]
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
  /** weight unit shown in the app; data is always stored in kg */
  units: 'kg' | 'lb'
  barKg: number
  plates: number[]
  /** bar and plates when units is lb (in lb) */
  barLb: number
  platesLb: number[]
  /** rest after a set of a compound (or unknown) exercise */
  restSec: number
  /** rest after a set of an isolation exercise */
  restIsolationSec: number
  /** use restIsolationSec for isolation exercises instead of restSec for everything */
  smartRest: boolean
  vibrate: boolean
  /** short beep when the rest timer ends */
  sound: boolean
  /** workouts per week you aim for */
  weeklyGoal: number
  /** maximum heart rate (bpm) used for zones and alerts; 220 minus age is a common estimate */
  maxHr: number
  /** warn during a workout when heart rate reaches alertPct of maxHr (needs the Google Health integration) */
  hrAlert: boolean
  hrAlertPct: number
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
  /** last time a set or warm-up was touched; used to cut off a forgotten workout */
  lastActiveAt: number
}

export interface LogItem {
  key: string
  name: string
  group: Muscle
  secondary?: Muscle[]
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

/** Heart rate and calories pulled from the user's tracker (Google Health) for one workout. */
export interface HealthSummary {
  source: 'google-health'
  fetchedAt: number
  hr?: { avg: number; max: number; min: number; points: number[] }
  kcal?: number
  /** the tracker's own average HR for the matching exercise session */
  deviceAvgHr?: number
  deviceExercise?: string
}

export interface WorkoutLog {
  id: string
  /** plan day this workout came from (titles can be renamed) */
  dayId?: string
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
  health?: HealthSummary
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
  units: 'kg',
  barKg: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  barLb: 45,
  platesLb: [45, 35, 25, 10, 5, 2.5],
  restSec: 120,
  restIsolationSec: 60,
  smartRest: true,
  vibrate: true,
  sound: true,
  weeklyGoal: 3,
  maxHr: 190,
  hrAlert: true,
  hrAlertPct: 90,
}
