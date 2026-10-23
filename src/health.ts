import { cloudClient, cloudEnabled } from './cloud'
import type { HealthSummary, WorkoutLog } from './types'

/** The integration is optional: it needs a configured backend and the build flag. */
export const healthEnabled = cloudEnabled && import.meta.env.VITE_ENABLE_GOOGLE_HEALTH === 'true'

export interface HealthStatus { configured: boolean; connected: boolean; connectedAt: string | null; expiresAt: string | null }
export interface SleepInfo { startMs: number; endMs: number; minutesAsleep: number | null; minutesAwake: number | null; stages: { type: string; minutes: number | null }[] }

type Reply<T> = { ok: true; data: T } | { ok: false; error: string; reconnect?: boolean; notConnected?: boolean }

export async function call<T>(body: Record<string, unknown>): Promise<Reply<T>> {
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
  if (message === 'not_connected' || status === 404) return { ok: false, error: 'Google Health is not connected.', notConnected: true }
  return { ok: false, error: message }
}

export const healthStatus = () => call<HealthStatus>({ action: 'status' })
export const disconnectHealth = () => call<{ ok: true }>({ action: 'disconnect' })

/** Starts the Google consent flow: the browser leaves the app and comes back with ?health=connected. */
export async function connectHealth(): Promise<string | null> {
  const r = await call<{ url: string }>({ action: 'connect' })
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

const SLEEP_KEY = 'liftlog:sleep'

/** Last night's sleep, cached for the day so the screen does not hit the API on every visit. */
export async function fetchSleep(force = false): Promise<SleepInfo | null> {
  const today = new Date().toDateString()
  try {
    const cached = JSON.parse(localStorage.getItem(SLEEP_KEY) ?? 'null')
    if (!force && cached?.day === today && cached.sleep) return cached.sleep as SleepInfo
  } catch { /* ignore */ }
  const r = await call<{ sleep: SleepInfo | null }>({ action: 'sleep' })
  if (!r.ok) return null
  try { localStorage.setItem(SLEEP_KEY, JSON.stringify({ day: today, sleep: r.data.sleep })) } catch { /* ignore */ }
  return r.data.sleep
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
    if (!healthEnabled || !signedIn) return
    const f = () => force((n) => n + 1)
    listeners.add(f)
    if (!cached) void refreshHealthStatus()
    return () => { listeners.delete(f) }
  }, [signedIn])
  return healthEnabled && signedIn ? cached : null
}

export function clearHealthStatus(): void { cached = null; listeners.forEach((f) => f()) }
