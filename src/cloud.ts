import { useEffect, useState } from 'preact/hooks'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { getState, replaceAll, setChangeHook, update } from './store'
import { mergeLogs, normalizeState } from './logic'
import type { WorkoutLog } from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
/** False when no Supabase project is configured: the app then runs fully offline. */
export const cloudEnabled = Boolean(url && anon)

const META_KEY = 'liftlog:cloud'
interface Meta { lastPull: number; lastPush: number }
const loadMeta = (): Meta => {
  try { const m = JSON.parse(localStorage.getItem(META_KEY) ?? '') as Meta; if (m && typeof m.lastPull === 'number') return m } catch { /* none yet */ }
  return { lastPull: 0, lastPush: 0 }
}
const saveMeta = (m: Meta) => { try { localStorage.setItem(META_KEY, JSON.stringify(m)) } catch { /* ignore */ } }

export interface CloudStatus {
  user: User | null
  ready: boolean
  busy: boolean
  message: string
  error: boolean
  recovery: boolean
  lastSync: number
}

let status: CloudStatus = { user: null, ready: !cloudEnabled, busy: false, message: '', error: false, recovery: false, lastSync: 0 }
const subs = new Set<() => void>()
function set(patch: Partial<CloudStatus>) { status = { ...status, ...patch }; subs.forEach((f) => f()) }

export function useCloud(): CloudStatus {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((n) => n + 1)
    subs.add(f)
    return () => { subs.delete(f) }
  }, [])
  return status
}

let client: SupabaseClient | null = null
function sb(): SupabaseClient {
  if (!client) client = createClient(url!, anon!, { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'Network error')

function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Wrong email or password.'
  if (m.includes('email not confirmed')) return 'Email not confirmed yet. Check your inbox.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'This email is already registered. Use Sign in.'
  if (m.includes('rate limit')) return 'Too many attempts. Wait a minute and try again.'
  if (m.includes('password should be')) return 'Password is too short (min 6 characters).'
  return message
}

/* ---------- auth ---------- */

export function initCloud(): void {
  if (!cloudEnabled) return
  const c = sb()
  c.auth.getSession().then(({ data }) => {
    set({ user: data.session?.user ?? null, ready: true })
    if (data.session) void syncNow()
  })
  c.auth.onAuthStateChange((event, session) => {
    set({ user: session?.user ?? null, recovery: event === 'PASSWORD_RECOVERY' ? true : status.recovery })
  })
  setChangeHook(scheduleSync)
  window.addEventListener('online', () => { void syncNow() })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void syncNow() })
}

export async function signUp(email: string, password: string): Promise<void> {
  set({ busy: true, message: '', error: false })
  const { data, error } = await sb().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL } })
  if (error) return set({ busy: false, message: friendly(error.message), error: true })
  if (!data.session) return set({ busy: false, message: 'Account created. Confirm your email with the link we sent, then sign in.', error: false })
  set({ busy: false, user: data.user })
  await syncNow()
}

export async function signIn(email: string, password: string): Promise<void> {
  set({ busy: true, message: '', error: false })
  const { data, error } = await sb().auth.signInWithPassword({ email: email.trim(), password })
  if (error) return set({ busy: false, message: friendly(error.message), error: true })
  set({ busy: false, user: data.user })
  await syncNow()
}

export async function signOut(): Promise<void> {
  await sb().auth.signOut()
  saveMeta({ lastPull: 0, lastPush: 0 })
  set({ user: null, message: 'Signed out. Your data stays on this device.', error: false, lastSync: 0 })
}

export async function sendReset(email: string): Promise<void> {
  set({ busy: true, message: '', error: false })
  const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + import.meta.env.BASE_URL })
  set({ busy: false, message: error ? friendly(error.message) : 'If that email exists, a reset link is on its way.', error: !!error })
}

export async function setNewPassword(password: string): Promise<void> {
  set({ busy: true, message: '', error: false })
  const { error } = await sb().auth.updateUser({ password })
  set({ busy: false, message: error ? friendly(error.message) : 'Password updated.', error: !!error, recovery: !!error })
}

/* ---------- sync ---------- */

let timer: ReturnType<typeof setTimeout> | undefined
function scheduleSync() {
  if (!status.user) return
  clearTimeout(timer)
  timer = setTimeout(() => { void syncNow() }, 3000)
}

let running = false
const OVERLAP_MS = 5 * 60_000

export async function syncNow(): Promise<void> {
  const user = status.user
  if (!cloudEnabled || !user || running || !navigator.onLine) return
  running = true
  set({ busy: true })
  try {
    const c = sb()
    const meta = loadMeta()
    const since = new Date(Math.max(0, meta.lastPull - OVERLAP_MS)).toISOString()
    const startedAt = Date.now()

    const [plan, logs] = await Promise.all([
      c.from('user_data').select('plan,custom,settings,updated_at').eq('user_id', user.id).maybeSingle(),
      c.from('workout_logs').select('data').eq('user_id', user.id).gte('updated_at', since),
    ])
    if (plan.error) throw plan.error
    if (logs.error) throw logs.error

    const local = getState()
    const remoteLogs = (logs.data ?? []).map((r) => r.data as WorkoutLog)
    const mergedLogs = mergeLogs(local.logs, remoteLogs)

    let pushPlan = false
    const remoteAt = plan.data ? new Date(plan.data.updated_at as string).getTime() : 0
    if (plan.data && remoteAt > local.planUpdatedAt) {
      const incoming = normalizeState({ plan: plan.data.plan, custom: plan.data.custom, settings: plan.data.settings, planUpdatedAt: remoteAt })
      if (incoming) replaceAll({ ...local, plan: incoming.plan, custom: incoming.custom, settings: incoming.settings, planUpdatedAt: remoteAt, logs: mergedLogs }, { silent: true })
    } else {
      update((s) => { s.logs = mergedLogs }, { silent: true })
      pushPlan = local.planUpdatedAt > remoteAt
    }

    const fresh = getState()
    if (pushPlan) {
      const { error } = await c.from('user_data').upsert({
        user_id: user.id, plan: fresh.plan, custom: fresh.custom, settings: fresh.settings, updated_at: new Date(fresh.planUpdatedAt).toISOString(),
      })
      if (error) throw error
    }

    const toPush = fresh.logs.filter((l) => l.updatedAt > meta.lastPush)
    for (let i = 0; i < toPush.length; i += 100) {
      const rows = toPush.slice(i, i + 100).map((l) => ({
        id: l.id, user_id: user.id, data: l, ended_at: new Date(l.endedAt).toISOString(),
        updated_at: new Date(l.updatedAt).toISOString(), deleted_at: l.deletedAt ? new Date(l.deletedAt).toISOString() : null,
      }))
      const { error } = await c.from('workout_logs').upsert(rows)
      if (error) throw error
    }

    saveMeta({ lastPull: startedAt, lastPush: Math.max(meta.lastPush, ...fresh.logs.map((l) => l.updatedAt), 0) })
    set({ busy: false, lastSync: Date.now(), message: '', error: false })
  } catch (e) {
    set({ busy: false, message: 'Sync failed: ' + errText(e), error: true })
  } finally {
    running = false
  }
}
