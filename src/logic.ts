import type { AppState, BodyEntry, CustomExercise, LogItem, Muscle, PersonalRecord, PlanDay, Reference, Session, SetRec, Settings, WorkoutLog } from './types'
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
  secondary?: Muscle[]
  equipment: LogItem['equipment']
}

/** Reps field that means seconds (planks, wall sits): "30-60 s", "45 sec", "1 min". */
export function isTimed(text: string): boolean {
  return /\b(s|sec|secs|seconds|min)\b/i.test(text)
}

/** Longest hold of a day in a group-of-sets context is shown in seconds; this formats a set value. */
export function repsLabel(reps: number, timed: boolean): string {
  return timed ? `${reps}s` : String(reps)
}

/** A workout left open overnight must not count as a 20 hour session: cut it at the last activity. */
export const IDLE_CUTOFF_MS = 2 * 3_600_000

export function buildLog(day: PlanDay, session: Session, resolve: (key: string) => Resolved, finishedAt = Date.now()): WorkoutLog {
  const last = session.lastActiveAt ?? session.startedAt
  const now = finishedAt - last > IDLE_CUTOFF_MS ? Math.max(last, session.startedAt) : finishedAt
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
    items.push({ key: ex.key, name: meta.name, group: meta.group, secondary: meta.secondary, equipment: meta.equipment, kg: top.kg, reps: top.reps, done: done.length, planned: ex.sets, sets: done })
  }
  return {
    id: uid(),
    dayId: day.id,
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
export function warmupRamp(workKg: number, barKg: number, step = 2.5): SetRec[] {
  if (workKg <= barKg + 4 * step) return []
  const round = (x: number) => Math.max(barKg, Math.round(x / step) * step)
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
  let i = plan.findIndex((d) => d.id === last.dayId)
  if (i < 0) i = plan.findIndex((d) => d.title === last.title)
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

/** Weight of one logged set for a muscle: primary 1, secondary 0.5. */
function weightFor(i: LogItem, m: Muscle): number {
  return i.group === m ? 1 : i.secondary?.includes(m) ? 0.5 : 0
}

export function setsInGroups(logs: WorkoutLog[], groups: Muscle[], since: number): number {
  let n = 0
  for (const l of logs) {
    if (l.endedAt < since) continue
    for (const i of l.items) for (const g of groups) n += i.done * weightFor(i, g)
  }
  return Math.round(n * 10) / 10
}

export function setsByGroup(logs: WorkoutLog[], since: number): { group: Muscle; sets: number; volume: number }[] {
  const by = new Map<Muscle, { sets: number; volume: number }>()
  const add = (m: Muscle, sets: number, vol: number) => {
    const cur = by.get(m) ?? { sets: 0, volume: 0 }
    cur.sets += sets
    cur.volume += vol
    by.set(m, cur)
  }
  for (const l of logs) {
    if (l.endedAt < since) continue
    for (const i of l.items) {
      const vol = (i.sets ?? []).reduce((a, r) => a + (r.kg && r.reps ? r.kg * r.reps : 0), 0)
      add(i.group, i.done, vol)
      for (const m of i.secondary ?? []) if (m !== i.group) add(m, i.done * 0.5, 0)
    }
  }
  return [...by.entries()].map(([group, v]) => ({ group, sets: Math.round(v.sets * 10) / 10, volume: v.volume })).sort((a, b) => b.sets - a.sets)
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

/** Plain-text summary of a workout for the notes field of an exported Google Health session. */
export function workoutNotes(log: WorkoutLog, fmtKg: (kg: number | null) => string): string {
  const lines = log.items.map((i) => {
    const sets = (i.sets ?? []).length ? i.sets : Array.from({ length: i.done }, () => ({ kg: i.kg, reps: i.reps }))
    const same = sets.every((s) => s.kg === sets[0].kg && s.reps === sets[0].reps)
    const detail = same ? `${sets.length}×${sets[0].reps}${sets[0].kg ? ' @ ' + fmtKg(sets[0].kg) : ''}` : sets.map((s) => `${s.reps}${s.kg ? '@' + fmtKg(s.kg) : ''}`).join(', ')
    return `${i.name}: ${detail}`
  })
  return [`${log.title}${log.focus ? ' — ' + log.focus : ''}`, ...lines, `Total: ${log.sets} sets. Logged with liftlog.`].join('\n')
}

/** Merge two lists of id-keyed records; the newest `updatedAt` wins (deletions stay as tombstones). */
export function mergeById<T extends { id: string; updatedAt: number }>(a: T[], b: T[]): T[] {
  const by = new Map<string, T>()
  for (const x of [...a, ...b]) {
    const cur = by.get(x.id)
    if (!cur || x.updatedAt > cur.updatedAt) by.set(x.id, x)
  }
  return [...by.values()]
}

export const liveBody = (body: BodyEntry[]): BodyEntry[] => body.filter((b) => !b.deletedAt).sort((x, y) => y.t - x.t)

/** Change of the latest weight against the oldest entry in the last `days` days (kg), or null with too little data. */
export function weightChange(body: BodyEntry[], days = 30, now = Date.now()): number | null {
  const recent = liveBody(body).filter((b) => b.t >= now - days * DAY_MS)
  if (recent.length < 2) return null
  return Math.round((recent[0].kg - recent[recent.length - 1].kg) * 10) / 10
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const REFERENCE_TYPES = new Set<Reference['type']>(['video', 'article'])
const REFERENCE_PLATFORMS = new Set<Reference['platform']>(['youtube', 'tiktok', 'instagram', 'web'])

/** Backups and cloud data are untrusted: reference URLs must never become executable schemes. */
function httpsUrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  try { const url = new URL(v); return url.protocol === 'https:' ? url.href : undefined } catch { return undefined }
}

function tiktokEmbed(v: unknown): string | undefined {
  const value = httpsUrl(v)
  if (!value) return undefined
  const url = new URL(value)
  if (!['tiktok.com', 'www.tiktok.com'].includes(url.hostname) || !/^\/player\/v1\/\d+$/.test(url.pathname)) return undefined
  return url.href
}

function normalizeReferences(input: unknown): Reference[] {
  if (!Array.isArray(input)) return []
  const refs: Reference[] = []
  for (const r of input) {
    if (!isObj(r)) continue
    const url = httpsUrl(r.url)
    if (!url || !REFERENCE_TYPES.has(r.type as Reference['type']) || !REFERENCE_PLATFORMS.has(r.platform as Reference['platform'])) continue
    const platform = r.platform as Reference['platform']
    refs.push({
      type: r.type as Reference['type'],
      platform,
      url,
      title: typeof r.title === 'string' ? r.title : url,
      author: typeof r.author === 'string' ? r.author : '',
      checked: typeof r.checked === 'string' ? r.checked : '',
      thumbnail: httpsUrl(r.thumbnail),
      embedUrl: platform === 'tiktok' ? tiktokEmbed(r.embedUrl) : undefined,
    })
  }
  return refs
}

function normalizeCustom(input: unknown): CustomExercise[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((c) => isObj(c) && typeof c.id === 'string' && typeof c.name === 'string')
    .map((c) => ({ ...c, references: normalizeReferences(c.references) } as unknown as CustomExercise))
}

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
  const custom = normalizeCustom(input.custom)
  return {
    v: 1,
    plan,
    custom,
    logs: logs.map((l) => ({ ...l, deletedAt: l.deletedAt ?? null, updatedAt: l.updatedAt ?? l.endedAt ?? 0 })),
    body: Array.isArray(input.body) ? (input.body.filter((b) => isObj(b) && typeof b.id === 'string' && typeof b.kg === 'number' && typeof b.t === 'number').map((b) => ({ ...(b as unknown as BodyEntry), deletedAt: (b as { deletedAt?: number | null }).deletedAt ?? null, updatedAt: Number((b as { updatedAt?: number }).updatedAt ?? (b as { t: number }).t) }))) : [],
    settings: { ...DEFAULT_SETTINGS, ...(isObj(input.settings) ? (input.settings as Partial<Settings>) : {}) },
    session: null,
    planUpdatedAt: typeof input.planUpdatedAt === 'number' ? input.planUpdatedAt : Date.now(),
  }
}

export interface HrZone {
  zone: 0 | 1 | 2 | 3 | 4 | 5
  label: string
}

/** Heart-rate zone as a share of maximum heart rate: 1 easy ... 5 maximal. */
export function hrZone(bpm: number, maxHr: number): HrZone {
  if (!(bpm > 0) || !(maxHr > 0)) return { zone: 0, label: '' }
  const pct = (bpm / maxHr) * 100
  if (pct < 60) return { zone: 1, label: 'Easy' }
  if (pct < 70) return { zone: 2, label: 'Fat burn' }
  if (pct < 80) return { zone: 3, label: 'Cardio' }
  if (pct < 90) return { zone: 4, label: 'Hard' }
  return { zone: 5, label: 'Max' }
}

/** Should an alert fire now? Not more than once per cooldown, and only for fresh readings. */
export function shouldAlertHr(bpm: number, maxHr: number, pct: number, lastAlertAt: number, readingAt: number, now = Date.now(), cooldownMs = 3 * 60_000): boolean {
  if (!(bpm > 0) || !(maxHr > 0)) return false
  if (now - readingAt > 2 * 60_000) return false
  if (now - lastAlertAt < cooldownMs) return false
  return bpm >= (maxHr * pct) / 100
}

export interface Recovery {
  score: number
  label: 'Ready to push' | 'Normal day' | 'Take it easy'
  parts: { sleep: number | null; hrv: number | null; rhr: number | null }
  hint: string
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Simple, transparent recovery score from last night's sleep, today's HRV and resting heart rate
 * compared with your own recent baseline. Components that are missing are left out and the rest rescaled.
 * `hrv` and `rhr` are newest first (index 0 is today).
 */
export function recovery(sleepMinutes: number | null, hrv: number[], rhr: number[]): Recovery | null {
  const parts = { sleep: null as number | null, hrv: null as number | null, rhr: null as number | null }
  if (sleepMinutes !== null) parts.sleep = Math.round(Math.min(1, sleepMinutes / 480) * 40)
  if (hrv.length >= 4) {
    const base = median(hrv.slice(1))
    const r = hrv[0] / base
    parts.hrv = r >= 1.05 ? 30 : r >= 0.95 ? 22 : r >= 0.85 ? 12 : 4
  }
  if (rhr.length >= 4) {
    const diff = rhr[0] - median(rhr.slice(1))
    parts.rhr = diff <= -2 ? 30 : diff <= 2 ? 22 : diff <= 5 ? 12 : 4
  }
  const max = (parts.sleep !== null ? 40 : 0) + (parts.hrv !== null ? 30 : 0) + (parts.rhr !== null ? 30 : 0)
  if (max === 0) return null
  const got = (parts.sleep ?? 0) + (parts.hrv ?? 0) + (parts.rhr ?? 0)
  const score = Math.round((got / max) * 100)
  const label = score >= 75 ? 'Ready to push' : score >= 55 ? 'Normal day' : 'Take it easy'
  const hint = label === 'Ready to push' ? 'Good day to try a heavier set or a new record.' : label === 'Normal day' ? 'Train as planned.' : 'Consider lighter weights or fewer sets today.'
  return { score, label, parts, hint }
}

/** Percent difference of the newest value against the median of the rest, e.g. +4 means 4% above your baseline. */
export function vsBaseline(values: number[]): number | null {
  if (values.length < 4) return null
  const base = median(values.slice(1))
  return base ? Math.round(((values[0] - base) / base) * 100) : null
}
