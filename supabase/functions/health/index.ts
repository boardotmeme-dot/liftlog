// liftlog: Google Health (Fitbit) integration. One function, several actions.
// Secrets (set in Supabase -> Edge Functions -> Secrets): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically. Refresh tokens never leave the server.
import { createClient } from 'npm:@supabase/supabase-js@2'

const API = 'https://health.googleapis.com/v4/users/me/dataTypes'
const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
]
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const env = (k: string) => Deno.env.get(k) ?? ''

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

class GoogleError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function accessToken(userId: string): Promise<string> {
  const { data: row } = await admin.from('health_connections').select('refresh_token').eq('user_id', userId).maybeSingle()
  if (!row) throw new GoogleError(404, 'not_connected')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: row.refresh_token, grant_type: 'refresh_token',
    }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.access_token) {
    if (j.error === 'invalid_grant') {
      await admin.from('health_connections').delete().eq('user_id', userId)
      throw new GoogleError(401, 'reconnect')
    }
    throw new GoogleError(502, `Google sign-in failed: ${j.error ?? res.status}`)
  }
  return j.access_token as string
}

async function gget(url: string, token: string): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

/** Heart-rate samples between startMs and endMs. The API returns newest first. */
async function heartRate(token: string, startMs: number, endMs: number) {
  const lo = new Date(startMs - 60_000).toISOString()
  const hi = new Date(endMs + 60_000).toISOString()
  let filter: string | null = `heart_rate.sample_time.physical_time >= "${lo}" AND heart_rate.sample_time.physical_time <= "${hi}"`
  const samples: { t: number; bpm: number }[] = []
  let pageToken = ''
  for (let page = 0; page < 12; page++) {
    const q = new URLSearchParams({ pageSize: '5000' })
    if (filter) q.set('filter', filter)
    if (pageToken) q.set('pageToken', pageToken)
    const res = await gget(`${API}/heart-rate/dataPoints?${q}`, token)
    if (!res.ok) {
      // The combined filter may not be supported: retry with a lower bound only.
      if (page === 0 && filter && res.status === 400 && filter.includes(' AND ')) {
        filter = `heart_rate.sample_time.physical_time >= "${lo}"`
        page = -1
        continue
      }
      throw new GoogleError(502, res.body?.error?.message ?? `heart-rate: HTTP ${res.status}`)
    }
    const pts: any[] = res.body.dataPoints ?? []
    let oldest = Infinity
    for (const p of pts) {
      const t = Date.parse(p.heartRate?.sampleTime?.physicalTime ?? '')
      const bpm = num(p.heartRate?.beatsPerMinute)
      if (!Number.isFinite(t) || bpm === null) continue
      oldest = Math.min(oldest, t)
      if (t >= startMs - 60_000 && t <= endMs + 60_000) samples.push({ t, bpm })
    }
    pageToken = res.body.nextPageToken ?? ''
    if (!pageToken || oldest < startMs - 60_000) break
  }
  samples.sort((a, b) => a.t - b.t)
  return samples
}

/** Time of the newest heart-rate sample Google has for the user (the API returns newest first). */
async function latestSampleMs(token: string): Promise<number | null> {
  const res = await gget(`${API}/heart-rate/dataPoints?pageSize=1`, token)
  if (!res.ok) return null
  const t = Date.parse(res.body.dataPoints?.[0]?.heartRate?.sampleTime?.physicalTime ?? '')
  return Number.isFinite(t) ? t : null
}

function summarize(samples: { t: number; bpm: number }[], startMs: number, endMs: number) {
  if (samples.length === 0) return null
  const bpms = samples.map((s) => s.bpm)
  const BUCKETS = 90
  const span = Math.max(1, endMs - startMs)
  const sums = new Array(BUCKETS).fill(0)
  const counts = new Array(BUCKETS).fill(0)
  for (const s of samples) {
    const i = Math.min(BUCKETS - 1, Math.max(0, Math.floor(((s.t - startMs) / span) * BUCKETS)))
    sums[i] += s.bpm
    counts[i]++
  }
  const points = sums.map((sum, i) => (counts[i] ? Math.round(sum / counts[i]) : 0))
  return {
    avg: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
    max: Math.max(...bpms),
    min: Math.min(...bpms),
    count: bpms.length,
    points, // 0 = no sample in that slice
  }
}

/** Exercise session recorded by the tracker that overlaps the workout the most. */
async function matchExercise(token: string, startMs: number, endMs: number) {
  const day = new Date(startMs - 86_400_000).toISOString().slice(0, 10)
  const base = `${API}/exercise/dataPoints`
  let res = await gget(`${base}?${new URLSearchParams({ pageSize: '50', filter: `exercise.interval.civil_start_time >= "${day}T00:00:00"` })}`, token)
  if (!res.ok) res = await gget(`${base}?pageSize=50`, token)
  if (!res.ok) return null
  let best: any = null
  let bestOverlap = 0
  for (const p of res.body.dataPoints ?? []) {
    const e = p.exercise
    const s = Date.parse(e?.interval?.startTime ?? '')
    const f = Date.parse(e?.interval?.endTime ?? '')
    if (!Number.isFinite(s) || !Number.isFinite(f)) continue
    const overlap = Math.min(f, endMs) - Math.max(s, startMs)
    const needed = 0.4 * Math.min(f - s, endMs - startMs)
    if (overlap > bestOverlap && overlap >= needed) { best = e; bestOverlap = overlap }
  }
  if (!best) return null
  const m = best.metricsSummary ?? {}
  return {
    type: best.exerciseType ?? null,
    name: best.displayName ?? null,
    startMs: Date.parse(best.interval.startTime),
    endMs: Date.parse(best.interval.endTime),
    avgHr: num(m.averageHeartRateBeatsPerMinute),
    kcal: num(m.caloriesKcal),
  }
}

async function lastSleep(token: string) {
  const res = await gget(`${API}/sleep/dataPoints?pageSize=5`, token)
  if (!res.ok) throw new GoogleError(502, res.body?.error?.message ?? `sleep: HTTP ${res.status}`)
  let best: any = null
  let bestEnd = 0
  for (const p of res.body.dataPoints ?? []) {
    const end = Date.parse(p.sleep?.interval?.endTime ?? '')
    if (Number.isFinite(end) && end <= Date.now() + 3_600_000 && end > bestEnd) { best = p.sleep; bestEnd = end }
  }
  if (!best) return null
  const sum = best.summary ?? {}
  return {
    startMs: Date.parse(best.interval.startTime),
    endMs: bestEnd,
    minutesAsleep: num(sum.minutesAsleep),
    minutesAwake: num(sum.minutesAwake),
    stages: (sum.stagesSummary ?? []).map((s: any) => ({ type: s.type, minutes: num(s.minutes) })),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '')
  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data.user) return json({ error: 'Not signed in' }, 401)
  const userId = data.user.id
  const body = await req.json().catch(() => ({}))
  const configured = Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET') && env('APP_URL'))

  try {
    switch (body.action) {
      case 'status': {
        const { data: row } = await admin.from('health_connections').select('connected_at, refresh_expires_at').eq('user_id', userId).maybeSingle()
        return json({ configured, connected: !!row, connectedAt: row?.connected_at ?? null, expiresAt: row?.refresh_expires_at ?? null })
      }
      case 'connect': {
        if (!configured) return json({ error: 'Google Health is not configured on this server (missing secrets).' }, 503)
        const state = crypto.randomUUID()
        await admin.from('health_oauth_states').delete().lt('created_at', new Date(Date.now() - 86_400_000).toISOString())
        await admin.from('health_oauth_states').insert({ state, user_id: userId })
        const params = new URLSearchParams({
          client_id: env('GOOGLE_CLIENT_ID'),
          redirect_uri: `${env('SUPABASE_URL')}/functions/v1/health-callback`,
          response_type: 'code', access_type: 'offline', prompt: 'consent', state, scope: SCOPES.join(' '),
        })
        return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
      }
      case 'disconnect': {
        const { data: row } = await admin.from('health_connections').select('refresh_token').eq('user_id', userId).maybeSingle()
        if (row) {
          await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', body: new URLSearchParams({ token: row.refresh_token }) }).catch(() => {})
          await admin.from('health_connections').delete().eq('user_id', userId)
        }
        return json({ ok: true })
      }
      case 'workout': {
        const startMs = num(body.startMs)
        const endMs = num(body.endMs)
        if (startMs === null || endMs === null || endMs <= startMs || endMs - startMs > 6 * 3_600_000) return json({ error: 'Invalid time range' }, 400)
        const token = await accessToken(userId)
        const [samples, exercise, latest] = await Promise.all([heartRate(token, startMs, endMs), matchExercise(token, startMs, endMs), latestSampleMs(token)])
        return json({ heartRate: summarize(samples, startMs, endMs), exercise, latestSampleMs: latest })
      }
      case 'sleep': {
        const token = await accessToken(userId)
        return json({ sleep: await lastSleep(token) })
      }
      default:
        return json({ error: 'Unknown action' }, 400)
    }
  } catch (e) {
    if (e instanceof GoogleError) return json({ error: e.message }, e.status === 401 || e.status === 404 ? e.status : 502)
    return json({ error: 'Unexpected error' }, 500)
  }
})
