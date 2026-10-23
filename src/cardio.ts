import type { CardioActivity, CardioBlock, CardioPlan, CardioResult, CardioRun, CardioStep, GoogleExerciseType, StepKind, WorkoutLog } from './types'

const rid = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

export const LEVEL_LABEL = { 1: 'Easy', 2: 'Steady', 3: 'Hard', 4: 'All out' } as const
export const KIND_LABEL: Record<StepKind, string> = { warmup: 'Warm-up', work: 'Work', rest: 'Rest', cooldown: 'Cool-down' }

export interface ActivityInfo {
  label: string
  icon: string
  /** label for the indoor switch ("Treadmill") */
  indoorLabel: string
  outdoorLabel: string
  /** show distance (km / mi) */
  distance: boolean
  warmup: string[]
  cooldown: string[]
  /** work/rest wording used by new steps */
  workName: string
  restName: string
}

export const ACTIVITIES: Record<CardioActivity, ActivityInfo> = {
  'jump-rope': {
    label: 'Jump rope', icon: '⚡', indoorLabel: 'Indoors', outdoorLabel: 'Outdoors', distance: false, workName: 'Fast', restName: 'Slow',
    warmup: ['Ankle circles and calf raises, 30 seconds', 'Wrist and shoulder circles', '1-2 minutes of easy, low jumps without speed', 'A few light double-foot hops to find the rhythm'],
    cooldown: ['Walk it off until breathing is calm', 'Calf and shin stretch, 30 seconds per leg'],
  },
  bike: {
    label: 'Bike', icon: '🚴', indoorLabel: 'Stationary / trainer', outdoorLabel: 'Outdoors', distance: true, workName: 'Hard', restName: 'Easy',
    warmup: ['Spin in an easy gear, high cadence', 'Raise the effort a little every 2 minutes', 'Two or three 10 second pick-ups near the end'],
    cooldown: ['Easy spin with light resistance', 'Quad and hip flexor stretch'],
  },
  run: {
    label: 'Run', icon: '🏃', indoorLabel: 'Treadmill', outdoorLabel: 'Outdoors', distance: true, workName: 'Run', restName: 'Walk',
    warmup: ['Brisk walk, 2-3 minutes', 'Leg swings and walking lunges', 'Easy jog, then 3 relaxed 15 second strides'],
    cooldown: ['Walk until your heart rate drops below zone 2', 'Calf, hamstring and hip flexor stretch'],
  },
  walk: {
    label: 'Walk', icon: '🚶', indoorLabel: 'Treadmill', outdoorLabel: 'Outdoors', distance: true, workName: 'Brisk', restName: 'Easy',
    warmup: ['Start at an easy pace for 3-5 minutes', 'Loosen ankles, hips and shoulders'],
    cooldown: ['Slow the pace for the last 3 minutes', 'Gentle calf stretch'],
  },
  row: {
    label: 'Rowing', icon: '🚣', indoorLabel: 'Rowing machine', outdoorLabel: 'On the water', distance: true, workName: 'Hard', restName: 'Easy',
    warmup: ['5 minutes of easy rowing, 18-20 strokes per minute', 'Arms-only, then arms and body, then full slides', 'Three firm strokes near the end'],
    cooldown: ['Easy rowing for 3 minutes', 'Lat, hamstring and lower back stretch'],
  },
  swim: {
    label: 'Swim', icon: '🏊', indoorLabel: 'Pool', outdoorLabel: 'Open water', distance: true, workName: 'Fast', restName: 'Easy',
    warmup: ['Shoulder and arm circles on land', '200-400 m easy swimming, mixing strokes', 'A few short build-ups'],
    cooldown: ['100-200 m easy', 'Shoulder and chest stretch'],
  },
  elliptical: {
    label: 'Elliptical', icon: '⚙️', indoorLabel: 'Machine', outdoorLabel: 'Machine', distance: true, workName: 'Hard', restName: 'Easy',
    warmup: ['5 minutes at low resistance', 'Increase resistance a little each minute'],
    cooldown: ['3 minutes at low resistance', 'Light leg stretch'],
  },
  other: {
    label: 'Other cardio', icon: '❤️', indoorLabel: 'Indoors', outdoorLabel: 'Outdoors', distance: false, workName: 'Work', restName: 'Rest',
    warmup: ['5 minutes of easy movement', 'Mobilise the joints you are about to use'],
    cooldown: ['Walk or move easily until calm', 'Light stretch'],
  },
}

export const ACTIVITY_KEYS = Object.keys(ACTIVITIES) as CardioActivity[]

/** Exercise type to write to Google Health. */
export function googleType(activity: CardioActivity, indoor: boolean): GoogleExerciseType {
  switch (activity) {
    case 'jump-rope': return 'JUMPING_ROPE'
    case 'bike': return indoor ? 'STATIONARY_BIKE' : 'BIKING'
    case 'run': return indoor ? 'TREADMILL' : 'RUNNING'
    case 'walk': return indoor ? 'TREADMILL_WALK' : 'WALKING'
    case 'row': return indoor ? 'ROWING_MACHINE' : 'ROWING'
    case 'swim': return indoor ? 'SWIMMING_POOL' : 'SWIMMING_OPEN_WATER'
    case 'elliptical': return 'ELLIPTICAL'
    default: return 'OTHER'
  }
}

/* ---------- building programs ---------- */

type Level = CardioStep['level']
export const step = (kind: StepKind, label: string, sec: number, level: Level): CardioStep => ({ id: rid(), kind, label, sec, level })
const block = (repeat: number, ...steps: CardioStep[]): CardioBlock => ({ id: rid(), repeat, steps })

const warm = (min: number) => block(1, step('warmup', 'Warm-up', min * 60, 1))
const cool = (min: number) => block(1, step('cooldown', 'Cool-down', min * 60, 1))

export interface CardioStyle {
  name: string
  hint: string
  build: (a: ActivityInfo) => CardioBlock[]
}

const steady = (name: string, warmMin: number, min: number, level: Level, coolMin: number, hint: string): CardioStyle => ({
  name, hint, build: () => [warm(warmMin), block(1, step('work', 'Steady', min * 60, level)), cool(coolMin)],
})
const intervals = (name: string, hint: string, warmMin: number, rounds: number, workSec: number, restSec: number, workLevel: Level, coolMin: number): CardioStyle => ({
  name, hint,
  build: (a) => [warm(warmMin), block(rounds, step('work', a.workName, workSec, workLevel), step('rest', a.restName, restSec, 1)), cool(coolMin)],
})

export const STYLES: Record<CardioActivity, CardioStyle[]> = {
  'jump-rope': [
    intervals('Speed intervals', '10 x 30 s fast, 30 s slow', 3, 10, 30, 30, 4, 2),
    intervals('Boxer rounds', '5 x 3 min jumping, 1 min rest', 3, 5, 180, 60, 3, 2),
    intervals('Tabata', '8 x 20 s all out, 10 s rest', 3, 8, 20, 10, 4, 2),
    {
      name: 'Pyramid', hint: '30 / 45 / 60 / 45 / 30 s fast with 30 s slow between',
      build: (a) => [warm(3), block(1,
        ...[30, 45, 60, 45, 30].flatMap((s, i, all) => [step('work', a.workName, s, 4), ...(i < all.length - 1 ? [step('rest', a.restName, 30, 1)] : [])])), cool(2)],
    },
    steady('Steady jumping', 3, 15, 2, 2, '15 minutes at an even rhythm'),
  ],
  bike: [
    steady('Easy ride', 5, 40, 2, 5, '40 minutes in zone 2'),
    intervals('Intervals 1/1', '8 x 1 min hard, 1 min easy', 5, 8, 60, 60, 3, 5),
    steady('Tempo', 10, 20, 3, 5, '20 minutes at a hard but even effort'),
    intervals('Sprints', '8 x 20 s all out, 100 s easy', 8, 8, 20, 100, 4, 5),
  ],
  run: [
    steady('Easy run', 5, 30, 2, 5, '30 minutes you can chat through'),
    intervals('Intervals', '6 x 2 min hard, 2 min easy', 8, 6, 120, 120, 3, 5),
    steady('Tempo run', 10, 20, 3, 5, '20 minutes comfortably hard'),
    intervals('Fartlek', '8 x 1 min hard, 2 min easy', 8, 8, 60, 120, 3, 5),
    intervals('Sprints', '8 x 30 s all out, 90 s walk', 8, 8, 30, 90, 4, 5),
    intervals('Run / walk', '8 x 2 min run, 1 min walk (good for beginners)', 3, 8, 120, 60, 2, 3),
    steady('Long run', 5, 60, 2, 5, '60 minutes at an easy pace'),
  ],
  walk: [
    steady('Brisk walk', 3, 30, 2, 3, '30 minutes at a quick pace'),
    intervals('Power intervals', '6 x 3 min brisk, 2 min easy', 3, 6, 180, 120, 3, 3),
    steady('Easy walk', 0, 45, 1, 0, '45 minutes, relaxed'),
  ],
  row: [
    steady('Steady row', 5, 20, 2, 3, '20 minutes at an even stroke rate'),
    intervals('Intervals', '8 x 2 min hard, 1 min easy', 5, 8, 120, 60, 3, 3),
    intervals('Sprints', '10 x 30 s all out, 90 s easy', 5, 10, 30, 90, 4, 3),
  ],
  swim: [
    steady('Steady swim', 5, 25, 2, 3, '25 minutes continuous'),
    intervals('Intervals', '8 x 1 min fast, 30 s rest', 5, 8, 60, 30, 3, 3),
  ],
  elliptical: [
    steady('Steady', 5, 25, 2, 3, '25 minutes'),
    intervals('Intervals', '8 x 1 min hard, 1 min easy', 5, 8, 60, 60, 3, 3),
  ],
  other: [
    steady('Steady', 5, 20, 2, 3, '20 minutes'),
    intervals('Intervals', '8 x 30 s work, 30 s rest', 5, 8, 30, 30, 3, 3),
  ],
}

export function planFromStyle(activity: CardioActivity, styleName: string, indoor = false): CardioPlan {
  const info = ACTIVITIES[activity]
  const style = STYLES[activity].find((s) => s.name === styleName) ?? STYLES[activity][0]
  return { activity, indoor, style: style.name, blocks: style.build(info) }
}

/** A blank step for the editor. */
export function newStep(activity: CardioActivity, kind: StepKind): CardioStep {
  const a = ACTIVITIES[activity]
  if (kind === 'work') return step('work', a.workName, 60, 3)
  if (kind === 'rest') return step('rest', a.restName, 30, 1)
  if (kind === 'warmup') return step('warmup', 'Warm-up', 180, 1)
  return step('cooldown', 'Cool-down', 180, 1)
}

export const newBlock = (activity: CardioActivity): CardioBlock => block(1, newStep(activity, 'work'), newStep(activity, 'rest'))

/* ---------- running a program ---------- */

export interface FlatStep extends CardioStep {
  /** which repeat of its block (1-based) and how many */
  round: number
  rounds: number
  blockIndex: number
  startSec: number
}

/** The program as one timeline. */
export function expand(plan: CardioPlan): FlatStep[] {
  const out: FlatStep[] = []
  let t = 0
  plan.blocks.forEach((b, blockIndex) => {
    for (let round = 1; round <= b.repeat; round++) {
      for (const s of b.steps) {
        out.push({ ...s, round, rounds: b.repeat, blockIndex, startSec: t })
        t += s.sec
      }
    }
  })
  return out
}

export const totalSec = (flat: FlatStep[]): number => (flat.length ? flat[flat.length - 1].startSec + flat[flat.length - 1].sec : 0)

export interface Progress {
  /** index of the current step; flat.length when the program is over */
  index: number
  /** seconds into the current step */
  into: number
  left: number
  done: boolean
}

export function progressAt(flat: FlatStep[], posSec: number): Progress {
  const total = totalSec(flat)
  if (flat.length === 0 || posSec >= total) return { index: flat.length, into: 0, left: 0, done: true }
  let i = flat.findIndex((s) => posSec < s.startSec + s.sec)
  if (i < 0) i = flat.length - 1
  const s = flat[i]
  return { index: i, into: posSec - s.startSec, left: s.startSec + s.sec - posSec, done: false }
}

export function runPositionSec(run: CardioRun, now: number): number {
  return Math.max(0, ((run.pausedAt ?? now) - run.startedAt - run.pausedMs + run.skipMs) / 1000)
}

/** Milliseconds to add to `skipMs` to jump to the next step (dir 1) or restart/go back (dir -1). */
export function skipDeltaMs(flat: FlatStep[], posSec: number, dir: 1 | -1): number {
  const p = progressAt(flat, posSec)
  if (p.done) return 0
  const cur = flat[p.index]
  let target: number
  if (dir > 0) target = cur.startSec + cur.sec
  else if (p.into > 3 || p.index === 0) target = cur.startSec
  else target = flat[p.index - 1].startSec
  return Math.round((target - posSec) * 1000)
}

/** What was done after `posSec` of the program. */
export function resultAt(plan: CardioPlan, flat: FlatStep[], posSec: number): Pick<CardioResult, 'activity' | 'indoor' | 'style' | 'workSec' | 'rounds'> & { warmSec: number } {
  let workSec = 0
  let warmSec = 0
  let rounds = 0
  for (const s of flat) {
    const spent = Math.max(0, Math.min(s.sec, posSec - s.startSec))
    if (s.kind === 'work') { workSec += spent; if (spent >= s.sec) rounds++ }
    if (s.kind === 'warmup') warmSec += spent
  }
  return { activity: plan.activity, indoor: plan.indoor, style: plan.style, workSec: Math.round(workSec), rounds, warmSec: Math.round(warmSec) }
}

/** "2:30", "45 s", "1 h 05 min" for plan summaries. */
export function dur(sec: number): string {
  const s = Math.round(sec)
  if (s < 60) return `${s} s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`
  return r ? `${m}:${String(r).padStart(2, '0')} min` : `${m} min`
}

/** One line describing the program: "Warm-up 3 min · 10 × (Fast 30 s + Slow 30 s) · Cool-down 2 min". */
export function describe(plan: CardioPlan): string {
  return plan.blocks.map((b) => {
    const parts = b.steps.map((s) => `${s.label} ${dur(s.sec)}`)
    return b.repeat > 1 ? `${b.repeat} × (${parts.join(' + ')})` : parts.join(' + ')
  }).join(' · ')
}

/* ---------- validation of stored data ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const KINDS = new Set<StepKind>(['warmup', 'work', 'rest', 'cooldown'])

export function normalizeCardio(input: unknown): CardioPlan | null {
  if (!isObj(input) || !Array.isArray(input.blocks)) return null
  const activity = ACTIVITY_KEYS.includes(input.activity as CardioActivity) ? (input.activity as CardioActivity) : 'other'
  const blocks: CardioBlock[] = []
  for (const b of input.blocks.slice(0, 40)) {
    if (!isObj(b) || !Array.isArray(b.steps)) continue
    const steps: CardioStep[] = []
    for (const s of b.steps.slice(0, 40)) {
      if (!isObj(s) || !KINDS.has(s.kind as StepKind)) continue
      const level = Math.min(4, Math.max(1, Math.round(Number(s.level) || 2))) as Level
      steps.push({
        id: typeof s.id === 'string' ? s.id : rid(),
        kind: s.kind as StepKind,
        label: typeof s.label === 'string' ? s.label.slice(0, 40) : KIND_LABEL[s.kind as StepKind],
        sec: Math.min(6 * 3600, Math.max(1, Math.round(Number(s.sec) || 60))),
        level,
      })
    }
    if (steps.length) blocks.push({ id: typeof b.id === 'string' ? b.id : rid(), repeat: Math.min(100, Math.max(1, Math.round(Number(b.repeat) || 1))), steps })
  }
  if (blocks.length === 0) return null
  const km = Number(input.targetKm)
  return {
    activity,
    indoor: input.indoor === true,
    style: typeof input.style === 'string' ? input.style.slice(0, 40) : 'Custom',
    blocks,
    targetKm: Number.isFinite(km) && km > 0 ? Math.min(1000, km) : undefined,
  }
}

export interface CardioTotals {
  activity: CardioActivity
  sessions: number
  /** active minutes */
  minutes: number
  km: number
  /** seconds of work time and km of the sessions that have a distance, for pace */
  paceSec: number
  paceKm: number
  longestMin: number
}

/** Cardio sessions since `since`, grouped by activity, most minutes first. */
export function cardioTotals(logs: WorkoutLog[], since: number): CardioTotals[] {
  const by = new Map<CardioActivity, CardioTotals>()
  for (const l of logs) {
    if (l.deletedAt || !l.cardio || l.endedAt < since) continue
    const c = l.cardio
    const t = by.get(c.activity) ?? { activity: c.activity, sessions: 0, minutes: 0, km: 0, paceSec: 0, paceKm: 0, longestMin: 0 }
    t.sessions++
    t.minutes += l.durationSec / 60
    t.longestMin = Math.max(t.longestMin, l.durationSec / 60)
    if (c.km) { t.km += c.km; t.paceSec += c.workSec || l.durationSec; t.paceKm += c.km }
    by.set(c.activity, t)
  }
  return [...by.values()].map((t) => ({ ...t, minutes: Math.round(t.minutes), longestMin: Math.round(t.longestMin), km: Math.round(t.km * 100) / 100 })).sort((a, b) => b.minutes - a.minutes)
}
