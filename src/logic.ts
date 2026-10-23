import type { AppState, LogItem, Muscle, PersonalRecord, PlanDay, Session, SetRec, Settings, WorkoutLog } from './types'
import { DEFAULT_SETTINGS } from './types'

export const DAY_MS = 86_400_000

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function clock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const x = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`
}

/** "8-12" -> 12, "10" -> 10, "AMRAP" -> 0 */
export function topReps(text: string): number {
  const nums = (text.match(/\d+/g) ?? []).map(Number)
  return nums.length ? Math.max(...nums) : 0
}

/** Reps used when a set is ticked and the user has not changed the number. */
export function defaultReps(text: string): number {
  const nums = (text.match(/\d+/g) ?? []).map(Number)
  return nums.length ? nums[0] : 0
}

export interface PlateResult {
  perSide: number
  plates: number[]
  leftover: number
}

/** Plates to load on each side of a barbell. Returns null when the load is below the bar. */
export function platesFor(kg: number, settings: Pick<Settings, 'barKg' | 'plates'>): PlateResult | null {
  const perSide = (kg - settings.barKg) / 2
  if (perSide < 0) return null
  const available = [...settings.plates].filter((p) => p > 0).sort((a, b) => b - a)
  const plates: number[] = []
  let rest = perSide
  for (const p of available) {
    while (rest >= p - 1e-9) {
      plates.push(p)
      rest = Math.round((rest - p) * 1000) / 1000
    }
  }
  return { perSide, plates, leftover: Math.round(rest * 100) / 100 }
}

export interface Resolved {
  name: string
  group: Muscle
  equipment: LogItem['equipment']
}

export function buildLog(day: PlanDay, session: Session, resolve: (key: string) => Resolved, now = Date.now()): WorkoutLog {
  const warmSec = session.warmSec + (session.warmStart ? (now - session.warmStart) / 1000 : 0)
  const items: LogItem[] = []
  let volume = 0
  let sets = 0
  for (const ex of day.exercises) {
    const done = (session.sets[ex.id] ?? []).filter((x): x is SetRec => !!x)
    if (done.length === 0) continue
    const top = done.reduce((a, b) => ((b.kg ?? 0) > (a.kg ?? 0) || ((b.kg ?? 0) === (a.kg ?? 0) && b.reps > a.reps) ? b : a))
    const meta = resolve(ex.key)
    sets += done.length
    for (const r of done) if (r.kg && r.reps) volume += r.kg * r.reps
    items.push({ key: ex.key, name: meta.name, group: meta.group, equipment: meta.equipment, kg: top.kg, reps: top.reps, done: done.length, planned: ex.sets, sets: done })
  }
  return {
    id: uid(),
    startedAt: session.startedAt,
    endedAt: now,
    title: day.title,
    focus: day.focus,
    durationSec: (now - session.startedAt) / 1000,
    warmSec,
    items,
    sets,
    volume: Math.round(volume),
    updatedAt: now,
    deletedAt: null,
  }
}

/** Epley estimate of a one-rep max. Returns 0 for sets without weight. */
export function e1rm(kg: number | null, reps: number): number {
  if (!kg || reps <= 0) return 0
  return Math.round(kg * (1 + reps / 30) * 10) / 10
}

function itemsOf(l: WorkoutLog, key: string): SetRec[] {
  const it = l.items.find((i) => i.key === key)
  if (!it) return []
  return it.sets ?? Array.from({ length: it.done }, () => ({ kg: it.kg, reps: it.reps }))
}

/** Records set in `log` compared with everything logged before it. First-ever results are not records. */
export function findRecords(log: WorkoutLog, before: WorkoutLog[]): PersonalRecord[] {
  const out: PersonalRecord[] = []
  const prior = before.filter((l) => !l.deletedAt && l.id !== log.id && l.endedAt <= log.endedAt)
  for (const it of log.items) {
    const now = itemsOf(log, it.key)
    const old = prior.flatMap((l) => itemsOf(l, it.key))
    if (old.length === 0) continue
    const weighted = now.some((r) => r.kg)
    if (weighted) {
      const bestNow = Math.max(...now.map((r) => r.kg ?? 0))
      const bestOld = Math.max(...old.map((r) => r.kg ?? 0))
      if (bestNow > bestOld) { out.push({ key: it.key, name: it.name, kind: 'weight', value: bestNow, previous: bestOld || null }); continue }
      const eNow = Math.max(...now.map((r) => e1rm(r.kg, r.reps)))
      const eOld = Math.max(...old.map((r) => e1rm(r.kg, r.reps)))
      if (eNow > eOld) out.push({ key: it.key, name: it.name, kind: 'e1rm', value: eNow, previous: eOld || null })
    } else {
      const bestNow = Math.max(...now.map((r) => r.reps))
      const bestOld = Math.max(...old.map((r) => r.reps))
      if (bestNow > bestOld) out.push({ key: it.key, name: it.name, kind: 'reps', value: bestNow, previous: bestOld })
    }
  }
  return out
}

/** Light ramp-up sets before a heavy barbell exercise, rounded to loadable weights. */
export function warmupRamp(workKg: number, barKg: number): SetRec[] {
  if (workKg <= barKg + 10) return []
  const round = (x: number) => Math.max(barKg, Math.round(x / 2.5) * 2.5)
  const steps: [number, number][] = [[0, 8], [0.5, 5], [0.7, 3], [0.85, 1]]
  const out: SetRec[] = []
  for (const [frac, reps] of steps) {
    const kg = frac === 0 ? barKg : round(workKg * frac)
    if (kg >= workKg) continue
    if (out.length && out[out.length - 1].kg === kg) continue
    out.push({ kg, reps })
  }
  return out
}

export function restFor(mechanic: 'compound' | 'isolation' | undefined, settings: Settings): number {
  return settings.smartRest && mechanic === 'isolation' ? settings.restIsolationSec : settings.restSec
}

/** Monday 00:00 local time of the week containing `t`. */
export function weekStart(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

export function workoutsThisWeek(logs: WorkoutLog[], now = Date.now()): number {
  const from = weekStart(now)
  return logs.filter((l) => !l.deletedAt && l.endedAt >= from).length
}

/** Consecutive finished weeks (before the current one) in which the goal was met; the current week counts once met. */
export function weekStreak(logs: WorkoutLog[], goal: number, now = Date.now()): number {
  const live = logs.filter((l) => !l.deletedAt)
  const count = (from: number) => live.filter((l) => l.endedAt >= from && l.endedAt < from + 7 * DAY_MS).length
  let start = weekStart(now)
  let streak = count(start) >= goal ? 1 : 0
  for (;;) {
    const d = new Date(start)
    d.setDate(d.getDate() - 7)
    start = d.getTime()
    if (count(start) >= goal) streak++
    else break
    if (streak > 520) break
  }
  return streak
}

/** The plan day that follows the most recent workout (matched by title), or 0. */
export function nextDayIndex(plan: PlanDay[], logs: WorkoutLog[]): number {
  const last = liveLogs(logs)[0]
  if (!last || plan.length === 0) return 0
  const i = plan.findIndex((d) => d.title === last.title)
  return i < 0 ? 0 : (i + 1) % plan.length
}

/** Whole days since each muscle was last trained. */
export function daysSinceTrained(logs: WorkoutLog[], now = Date.now()): { group: Muscle; days: number }[] {
  const last = new Map<Muscle, number>()
  for (const l of logs) {
    if (l.deletedAt) continue
    for (const i of l.items) last.set(i.group, Math.max(last.get(i.group) ?? 0, l.endedAt))
  }
  return [...last.entries()].map(([group, t]) => ({ group, days: Math.floor((now - t) / DAY_MS) })).sort((a, b) => b.days - a.days)
}

export const PULL: Muscle[] = ['back', 'lats', 'traps', 'rear-delts', 'biceps', 'forearms']
export const PUSH: Muscle[] = ['chest', 'shoulders', 'triceps']
export const QUADS: Muscle[] = ['quads']
export const POSTERIOR: Muscle[] = ['hamstrings', 'glutes', 'lower-back']

export function liveLogs(logs: WorkoutLog[]): WorkoutLog[] {
  return logs.filter((l) => !l.deletedAt).sort((a, b) => b.endedAt - a.endedAt)
}

export function setsInGroups(logs: WorkoutLog[], groups: Muscle[], since: number): number {
  let n = 0
  for (const l of logs) if (l.endedAt >= since) for (const i of l.items) if (groups.includes(i.group)) n += i.done
  return n
}

export function setsByGroup(logs: WorkoutLog[], since: number): { group: Muscle; sets: number; volume: number }[] {
  const by = new Map<Muscle, { sets: number; volume: number }>()
  for (const l of logs) {
    if (l.endedAt < since) continue
    for (const i of l.items) {
      const cur = by.get(i.group) ?? { sets: 0, volume: 0 }
      cur.sets += i.done
      if (i.kg && i.reps) cur.volume += i.kg * i.reps * i.done
      by.set(i.group, cur)
    }
  }
  return [...by.entries()].map(([group, v]) => ({ group, ...v })).sort((a, b) => b.sets - a.sets)
}

export function weightSeries(logs: WorkoutLog[], key: string): { t: number; kg: number }[] {
  const out: { t: number; kg: number }[] = []
  for (const l of [...logs].sort((a, b) => a.endedAt - b.endedAt)) {
    const it = l.items.find((i) => i.key === key)
    if (it?.kg) out.push({ t: l.endedAt, kg: it.kg })
  }
  return out
}

export function e1rmSeries(logs: WorkoutLog[], key: string): { t: number; kg: number }[] {
  const out: { t: number; kg: number }[] = []
  for (const l of [...logs].sort((a, b) => a.endedAt - b.endedAt)) {
    const best = Math.max(0, ...itemsOf(l, key).map((r) => e1rm(r.kg, r.reps)))
    if (best > 0) out.push({ t: l.endedAt, kg: best })
  }
  return out
}

export function trackedExercises(logs: WorkoutLog[]): { key: string; name: string }[] {
  const seen = new Map<string, string>()
  for (const l of [...logs].sort((a, b) => a.endedAt - b.endedAt)) {
    for (const i of l.items) if (i.kg) seen.set(i.key, i.name)
  }
  return [...seen.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name))
}

/** Exercises whose best weight was set 4+ weeks ago and has not been beaten since. */
export function stalledExercises(logs: WorkoutLog[], now = Date.now()): { key: string; name: string; kg: number; weeks: number }[] {
  const out: { key: string; name: string; kg: number; weeks: number }[] = []
  for (const { key, name } of trackedExercises(logs)) {
    const s = weightSeries(logs, key)
    if (s.length < 3) continue
    if (now - s[s.length - 1].t > 45 * DAY_MS) continue
    const best = Math.max(...s.map((p) => p.kg))
    const first = s.find((p) => p.kg === best)!
    const weeks = Math.floor((now - first.t) / (7 * DAY_MS))
    if (weeks >= 4) out.push({ key, name, kg: best, weeks })
  }
  return out.sort((a, b) => b.weeks - a.weeks).slice(0, 8)
}

/** Merge two lists of logs by id; the newer `updatedAt` wins, deletions are kept as tombstones. */
export function mergeLogs(a: WorkoutLog[], b: WorkoutLog[]): WorkoutLog[] {
  const by = new Map<string, WorkoutLog>()
  for (const l of [...a, ...b]) {
    const cur = by.get(l.id)
    if (!cur || l.updatedAt > cur.updatedAt) by.set(l.id, l)
  }
  return [...by.values()].sort((x, y) => y.endedAt - x.endedAt)
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Validate and repair data from a backup file or the cloud. Returns null when it is not usable. */
export function normalizeState(input: unknown): AppState | null {
  if (!isObj(input) || !Array.isArray(input.plan)) return null
  const plan: PlanDay[] = []
  for (const d of input.plan) {
    if (!isObj(d) || typeof d.title !== 'string' || !Array.isArray(d.exercises)) return null
    plan.push({
      id: typeof d.id === 'string' ? d.id : uid(),
      title: d.title,
      focus: typeof d.focus === 'string' ? d.focus : '',
      exercises: d.exercises.filter(isObj).map((e) => ({
        id: typeof e.id === 'string' ? e.id : uid(),
        key: String(e.key ?? ''),
        kg: typeof e.kg === 'number' ? e.kg : null,
        sets: Math.min(12, Math.max(1, Math.round(Number(e.sets) || 3))),
        reps: typeof e.reps === 'string' ? e.reps : String(e.reps ?? ''),
        note: typeof e.note === 'string' ? e.note : '',
      })).filter((e) => e.key),
    })
  }
  const logs = Array.isArray(input.logs) ? (input.logs.filter((l) => isObj(l) && typeof l.id === 'string' && Array.isArray(l.items)) as unknown as WorkoutLog[]) : []
  const custom = Array.isArray(input.custom) ? (input.custom.filter((c) => isObj(c) && typeof c.id === 'string' && typeof c.name === 'string') as unknown as AppState['custom']) : []
  return {
    v: 1,
    plan,
    custom,
    logs: logs.map((l) => ({ ...l, deletedAt: l.deletedAt ?? null, updatedAt: l.updatedAt ?? l.endedAt ?? 0 })),
    settings: { ...DEFAULT_SETTINGS, ...(isObj(input.settings) ? (input.settings as Partial<Settings>) : {}) },
    session: null,
    planUpdatedAt: typeof input.planUpdatedAt === 'number' ? input.planUpdatedAt : Date.now(),
  }
}
