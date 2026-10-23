import { cloudClient, cloudEnabled } from './cloud'
import type { HealthSummary, WorkoutLog } from './types'

/** The integration is optional: it needs a configured backend and the build flag. */
/** Build with VITE_HEALTH_DEMO=true to see the interface with invented tracker data (screenshots, trying the UI). */
export const demoMode = import.meta.env.VITE_HEALTH_DEMO === 'true'
export const healthEnabled = demoMode || (cloudEnabled && import.meta.env.VITE_ENABLE_GOOGLE_HEALTH === 'true')

export interface HealthStatus { configured: boolean; allowed?: boolean; connected: boolean; connectedAt: string | null; expiresAt: string | null; canWrite?: boolean }
export interface SleepInfo { startMs: number; endMs: number; minutesAsleep: number | null; minutesAwake: number | null; stages: { type: string; minutes: number | null }[] }

type Reply<T> = { ok: true; data: T } | { ok: false; error: string; reconnect?: boolean; notConnected?: boolean; needsWrite?: boolean }

export async function call<T>(body: Record<string, unknown>): Promise<Reply<T>> {
  if (demoMode) {
    const { demoCall } = await import('./health-demo')
    return { ok: true, data: demoCall(body) as T }
  }
  const { data, error } = await cloudClient().functions.invoke('health', { body })
  if (!error) return { ok: true, data: data as T }
  let message = 'Could not reach the health service.'
  let status = 0
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    status = ctx.status
    const j = await ctx.json().catch(() => null)
    if (j?.error) message = String(j.error)
  }
  if (message === 'reconnect') return { ok: false, error: 'Google access expired. Connect again in More.', reconnect: true }
  if (message === 'write_not_granted') return { ok: false, error: 'Sending to Google Health is not enabled. Turn it on in More → Google Health.', needsWrite: true }
  if (message === 'not_connected' || status === 404) return { ok: false, error: 'Google Health is not connected.', notConnected: true }
  return { ok: false, error: message }
}

export const healthStatus = () => call<HealthStatus>({ action: 'status' })
export const disconnectHealth = () => call<{ ok: true }>({ action: 'disconnect' })

/** Starts the Google consent flow: the browser leaves the app and comes back with ?health=connected. */
export async function connectHealth(write = false): Promise<string | null> {
  const r = await call<{ url: string }>({ action: 'connect', write })
  if (!r.ok) return r.error
  location.href = r.data.url
  return null
}

interface WorkoutReply {
  latestSampleMs?: number | null
  heartRate: { avg: number; max: number; min: number; points: number[] } | null
  exercise: { name: string | null; type: string | null; avgHr: number | null; kcal: number | null } | null
}

/** Heart rate and calories for the time window of a finished workout. Null when the tracker has nothing yet. */
export async function fetchWorkoutHealth(log: Pick<WorkoutLog, 'startedAt' | 'endedAt'>): Promise<Reply<HealthSummary | null> & { latestSampleMs?: number | null }> {
  const r = await call<WorkoutReply>({ action: 'workout', startMs: log.startedAt, endMs: log.endedAt })
  if (!r.ok) return r
  const { heartRate, exercise } = r.data
  if (!heartRate && !exercise) return { ok: true, data: null, latestSampleMs: r.data.latestSampleMs ?? null }
  return {
    ok: true,
    data: {
      source: 'google-health',
      fetchedAt: Date.now(),
      hr: heartRate ?? undefined,
      kcal: exercise?.kcal != null ? Math.round(exercise.kcal) : undefined,
      deviceAvgHr: exercise?.avgHr ?? undefined,
      deviceExercise: exercise?.name ?? exercise?.type ?? undefined,
    },
  }
}

/* ---------- writing to Google Health ---------- */

const utcOffsetMin = () => -new Date().getTimezoneOffset()

/** Sends a finished workout as a strength session, unless the tracker already recorded one for that time. */
export async function exportWorkout(log: WorkoutLog, notes: string): Promise<Reply<{ status: 'sent' | 'tracker_recorded'; name?: string }>> {
  const r = await call<{ created?: boolean; name?: string | null; skipped?: string }>({
    action: 'exportWorkout', startMs: log.startedAt, endMs: log.endedAt, title: `${log.title} · liftlog`, notes, utcOffsetMin: utcOffsetMin(),
  })
  if (!r.ok) return r
  if (r.data.skipped) return { ok: true, data: { status: 'tracker_recorded' } }
  return { ok: true, data: { status: 'sent', name: r.data.name ?? undefined } }
}

export async function exportWeight(kg: number, atMs: number): Promise<Reply<{ name?: string }>> {
  const r = await call<{ name?: string | null }>({ action: 'exportWeight', kg, atMs })
  return r.ok ? { ok: true, data: { name: r.data.name ?? undefined } } : r
}

/** Removes points this app created in Google Health. Best effort: failures are ignored. */
export async function deleteExported(names: (string | undefined)[]): Promise<void> {
  const list = names.filter((n): n is string => !!n)
  if (list.length) await call({ action: 'deleteExport', names: list })
}

export interface TodayData {
  todayKey: string
  days: { date: string; steps: number | null; kcal: number | null; distanceM: number | null; azm: number | null }[]
  resting: { date: string; bpm: number }[]
  hrv: { date: string; ms: number }[]
  respiratoryRate: number | null
  weight: { kg: number; atMs: number | null } | null
  sleep: SleepInfo | null
}

const TODAY_KEY = 'liftlog:today'
const TODAY_TTL = 20 * 60_000

/** Daily health summary, cached for 20 minutes (the tracker only syncs every few minutes anyway). */
export async function fetchToday(force = false): Promise<TodayData | null> {
  try {
    const c = JSON.parse(localStorage.getItem(TODAY_KEY) ?? 'null')
    if (!force && c && Date.now() - c.at < TODAY_TTL && c.data) return c.data as TodayData
  } catch { /* ignore */ }
  const r = await call<TodayData>({ action: 'today', utcOffsetMin: -new Date().getTimezoneOffset() })
  if (!r.ok) return null
  try { localStorage.setItem(TODAY_KEY, JSON.stringify({ at: Date.now(), data: r.data })) } catch { /* ignore */ }
  return r.data
}

export const fmtMinutes = (m: number | null): string => (m === null ? '—' : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`)

/* ---------- connection state shared by all screens ---------- */

import { useEffect, useState } from 'preact/hooks'

let cached: HealthStatus | null = null
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

export function refreshHealthStatus(): Promise<void> {
  inflight ??= healthStatus().then((r) => {
    cached = r.ok ? r.data : { configured: false, connected: false, connectedAt: null, expiresAt: null }
    listeners.forEach((f) => f())
  }).finally(() => { inflight = null })
  return inflight
}

/** null while unknown. Only queries the server when the integration is enabled and the user is signed in. */
export function useHealthStatus(signedIn: boolean): HealthStatus | null {
  const [, force] = useState(0)
  useEffect(() => {
    if (!healthEnabled || !(signedIn || demoMode)) return
    const f = () => force((n) => n + 1)
    listeners.add(f)
    if (!cached) void refreshHealthStatus()
    return () => { listeners.delete(f) }
  }, [signedIn])
  return healthEnabled && (signedIn || demoMode) ? cached : null
}

export function clearHealthStatus(): void { cached = null; listeners.forEach((f) => f()) }
