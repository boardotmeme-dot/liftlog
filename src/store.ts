import { useEffect, useState } from 'preact/hooks'
import { getExercise, resolveKey, customKey } from './catalog'
import { buildLog, defaultReps, findRecords, liveLogs, nextDayIndex, normalizeState, restFor, uid } from './logic'
import { planFromTemplate } from './data/templates'
import type { AppState, CustomExercise, PersonalRecord, PlanDay, PlanExercise, Session, SetRec, Settings, WorkoutLog } from './types'
import { DEFAULT_SETTINGS } from './types'
import { defaultUnit } from './units'

const KEY = 'liftlog:v1'

function empty(): AppState {
  return { v: 1, plan: [], custom: [], settings: { ...DEFAULT_SETTINGS, units: defaultUnit(navigator.language) }, session: null, logs: [], planUpdatedAt: 0 }
}

/** A session saved by an older version (ticks stored as booleans) cannot be resumed. */
function validSession(x: unknown): Session | null {
  const s = x as Session | null
  if (!s || typeof s !== 'object' || !s.sets || typeof s.startedAt !== 'number') return null
  for (const row of Object.values(s.sets)) if (!Array.isArray(row) || row.some((r) => r !== null && typeof r !== 'object')) return null
  if (typeof s.lastActiveAt !== 'number') s.lastActiveAt = s.startedAt
  if (s.restEnd && s.restEnd < Date.now() - 60_000) s.restEnd = null
  return s
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const s = normalizeState(parsed)
      if (s) return { ...s, session: validSession(parsed.session) }
    }
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return empty()
}

let state: AppState = load()
const subs = new Set<() => void>()
let changeHook: (() => void) | null = null

export const getState = (): AppState => state
export function setChangeHook(fn: () => void): void { changeHook = fn }

function persist(): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* quota or private mode */ }
}

/** Apply a mutation to a copy of the state, persist it, notify views and the cloud. */
export function update(fn: (draft: AppState) => void, opts: { silent?: boolean } = {}): void {
  const draft = structuredClone(state)
  fn(draft)
  state = draft
  persist()
  subs.forEach((f) => f())
  if (!opts.silent) changeHook?.()
}

export function useStore<T>(select: (s: AppState) => T): T {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((n) => n + 1)
    subs.add(f)
    return () => { subs.delete(f) }
  }, [])
  return select(state)
}

/* ---------- plan ---------- */

const touchPlan = (s: AppState) => { s.planUpdatedAt = Date.now() }

export function applyTemplate(id: string): void {
  update((s) => { s.plan = planFromTemplate(id, (slug) => !!getExercise(slug)); touchPlan(s) })
}

export function addDay(): string {
  const id = uid()
  update((s) => { s.plan.push({ id, title: `Day ${s.plan.length + 1}`, focus: '', exercises: [] }); touchPlan(s) })
  return id
}

/** Creates a new plan day filled with the given exercises. Returns its index. */
export function addDayWithExercises(title: string, keys: string[]): number {
  let index = 0
  update((s) => {
    const exercises = keys.map((key) => {
      const c = getExercise(key)
      return { id: uid(), key, kg: null, sets: c?.default_sets ?? 3, reps: c?.default_reps ?? '10', note: '' }
    })
    s.plan.push({ id: uid(), title, focus: '', exercises })
    index = s.plan.length - 1
    touchPlan(s)
  })
  return index
}

export function patchDay(dayId: string, patch: Partial<Pick<PlanDay, 'title' | 'focus'>>): void {
  update((s) => { const d = s.plan.find((x) => x.id === dayId); if (d) Object.assign(d, patch); touchPlan(s) })
}

export function deleteDay(dayId: string): void {
  update((s) => {
    if (s.session?.dayId === dayId) return
    s.plan = s.plan.filter((d) => d.id !== dayId)
    touchPlan(s)
  })
}

export function addExercise(dayId: string, key: string): void {
  update((s) => {
    const d = s.plan.find((x) => x.id === dayId)
    if (!d) return
    const c = getExercise(key)
    d.exercises.push({ id: uid(), key, kg: null, sets: c?.default_sets ?? 3, reps: c?.default_reps ?? '10', note: '' })
    touchPlan(s)
  })
}

export function patchExercise(dayId: string, exId: string, patch: Partial<Omit<PlanExercise, 'id' | 'key'>>): void {
  update((s) => {
    const e = s.plan.find((x) => x.id === dayId)?.exercises.find((x) => x.id === exId)
    if (e) Object.assign(e, patch)
    touchPlan(s)
  })
}

export function moveExercise(dayId: string, exId: string, delta: -1 | 1): void {
  update((s) => {
    const list = s.plan.find((x) => x.id === dayId)?.exercises
    if (!list) return
    const i = list.findIndex((e) => e.id === exId)
    const j = i + delta
    if (i < 0 || j < 0 || j >= list.length) return
    list.splice(j, 0, list.splice(i, 1)[0])
    touchPlan(s)
  })
}

/** Replace the exercise in a plan slot, keeping sets and reps (a different movement for the same muscle). */
export function swapExercise(dayId: string, exId: string, key: string): void {
  update((s) => {
    const e = s.plan.find((x) => x.id === dayId)?.exercises.find((x) => x.id === exId)
    if (!e) return
    e.key = key
    e.kg = null
    e.note = ''
    touchPlan(s)
  })
}

export function removeExercise(dayId: string, exId: string): void {
  update((s) => {
    const d = s.plan.find((x) => x.id === dayId)
    if (d) d.exercises = d.exercises.filter((e) => e.id !== exId)
    touchPlan(s)
  })
}

export type CustomInput = Omit<CustomExercise, 'id'>

export function saveCustomExercise(input: CustomInput, id?: string): string {
  const cid = id ?? uid()
  update((s) => {
    const next: CustomExercise = { ...input, id: cid, name: input.name.trim() }
    const i = s.custom.findIndex((c) => c.id === cid)
    if (i >= 0) s.custom[i] = next
    else s.custom.push(next)
    touchPlan(s)
  })
  return customKey(cid)
}

/** Deletes a custom exercise and removes it from every plan day. History keeps its own copy of the name. */
export function deleteCustomExercise(id: string): void {
  update((s) => {
    s.custom = s.custom.filter((c) => c.id !== id)
    for (const d of s.plan) d.exercises = d.exercises.filter((e) => e.key !== customKey(id))
    touchPlan(s)
  })
}

/* ---------- session ---------- */

function newSession(dayId: string): Session {
  return { id: uid(), dayId, startedAt: Date.now(), warmStart: null, warmSec: 0, sets: {}, kg: {}, reps: {}, restEnd: null, restNotified: false, lastActiveAt: Date.now() }
}

export function startWorkout(dayId: string): void {
  update((s) => { if (!s.session) s.session = newSession(dayId) })
}

export function toggleWarmup(): void {
  update((s) => {
    const x = s.session
    if (!x) return
    if (x.warmStart) { x.warmSec += (Date.now() - x.warmStart) / 1000; x.warmStart = null } else x.warmStart = Date.now()
    x.lastActiveAt = Date.now()
  })
}

export function toggleSet(dayId: string, exId: string, index: number): void {
  update((s) => {
    if (!s.session) s.session = newSession(dayId)
    const x = s.session
    if (x.dayId !== dayId) return
    const ex = s.plan.find((d) => d.id === dayId)?.exercises.find((e) => e.id === exId)
    const row = x.sets[exId] ?? []
    const was = !!row[index]
    if (was) row[index] = null
    else if (ex) {
      row[index] = { kg: currentKg(ex, x), reps: currentReps(ex, x) }
      x.restEnd = Date.now() + restFor(getExercise(ex.key)?.mechanic, s.settings) * 1000
      x.restNotified = false
    }
    x.sets[exId] = row
    x.lastActiveAt = Date.now()
  })
}

/** Change the weight/reps of one already logged set. */
export function editSet(exId: string, index: number, rec: SetRec): void {
  update((s) => {
    const row = s.session?.sets[exId]
    if (row?.[index]) row[index] = { kg: rec.kg, reps: Math.max(0, Math.round(rec.reps)) }
    if (s.session) s.session.lastActiveAt = Date.now()
  })
}

export function setSessionKg(exId: string, kg: number | null): void {
  update((s) => { if (s.session) s.session.kg[exId] = kg })
}

export function setSessionReps(exId: string, reps: number): void {
  update((s) => { if (s.session) s.session.reps[exId] = Math.max(0, Math.round(reps)) })
}

export function addRest(sec: number): void {
  update((s) => { if (s.session?.restEnd) s.session.restEnd += sec * 1000 }, { silent: true })
}

export function stopRest(): void {
  update((s) => { if (s.session) s.session.restEnd = null }, { silent: true })
}

export function markRestNotified(): void {
  update((s) => { if (s.session) s.session.restNotified = true }, { silent: true })
}

export function cancelWorkout(): void {
  update((s) => { s.session = null })
}

export interface FinishResult {
  log: WorkoutLog
  records: PersonalRecord[]
  nextDay: number
}

/** Saves the running workout. Returns null if there was none. */
export function finishWorkout(): FinishResult | null {
  const x = state.session
  if (!x) return null
  const day = state.plan.find((d) => d.id === x.dayId)
  let result: FinishResult | null = null
  update((s) => {
    if (!s.session) return
    const d = day ?? { id: x.dayId, title: 'Workout', focus: '', exercises: [] }
    const log = buildLog(d, s.session, (k) => resolveKey(k, s.custom))
    const records = findRecords(log, s.logs)
    s.logs.unshift(log)
    s.session = null
    result = { log, records, nextDay: nextDayIndex(s.plan, liveLogs(s.logs)) }
  })
  return result
}

export function sessionDoneSets(): number {
  const x = state.session
  return x ? Object.values(x.sets).reduce((n, row) => n + row.filter(Boolean).length, 0) : 0
}

/** The weight shown for an exercise: session override, else the plan. */
export function currentKg(ex: PlanExercise, session: Session | null): number | null {
  return session && ex.id in session.kg ? session.kg[ex.id] : ex.kg
}

export function currentReps(ex: PlanExercise, session: Session | null): number {
  return session?.reps[ex.id] ?? defaultReps(ex.reps)
}

/* ---------- logs, settings, whole-state ---------- */

export function deleteLog(id: string): void {
  update((s) => {
    const l = s.logs.find((x) => x.id === id)
    if (l) { l.deletedAt = Date.now(); l.updatedAt = Date.now() }
  })
}

export function attachHealth(logId: string, health: import('./types').HealthSummary): void {
  update((s) => {
    const l = s.logs.find((x) => x.id === logId)
    if (l) { l.health = health; l.updatedAt = Date.now() }
  })
}

export function patchSettings(patch: Partial<Settings>): void {
  update((s) => { Object.assign(s.settings, patch); touchPlan(s) })
}

export function replaceAll(next: AppState, opts: { silent?: boolean } = {}): void {
  update((s) => { Object.assign(s, next, { session: s.session }) }, opts)
}

export function eraseEverything(): void {
  update((s) => {
    const now = Date.now()
    // keep tombstones so other devices also forget these workouts
    s.logs = s.logs.map((l) => ({ ...l, deletedAt: l.deletedAt ?? now, updatedAt: now }))
    s.plan = []
    s.custom = []
    s.session = null
    s.settings = { ...DEFAULT_SETTINGS }
    touchPlan(s)
  })
}

export function exportJson(): string {
  const { session: _session, ...rest } = state
  void _session
  return JSON.stringify(rest, null, 2)
}
