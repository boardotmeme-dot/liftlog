import { useEffect, useState } from 'preact/hooks'
import { useCloud } from '../cloud'
import { clearHealthStatus, connectHealth, disconnectHealth, fetchSleep, fetchWorkoutHealth, fmtMinutes, refreshHealthStatus, useHealthStatus, type SleepInfo } from '../health'
import { attachHealth } from '../store'
import { confirmDialog, dateShort } from '../ui'
import type { HealthSummary, WorkoutLog } from '../types'

/** Small line chart of heart rate over the workout (points are 0 where the tracker had no sample). */
export function HrSpark(props: { points: number[] }) {
  const pts = props.points.map((v, i) => ({ v, i })).filter((p) => p.v > 0)
  if (pts.length < 2) return null
  const w = 300, h = 56, n = props.points.length - 1
  const lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v))
  const y = (v: number) => h - 4 - (hi === lo ? (h - 8) / 2 : ((v - lo) / (hi - lo)) * (h - 8))
  const d = pts.map((p, k) => `${k ? 'L' : 'M'} ${((p.i / n) * w).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`Heart rate from ${lo} to ${hi} beats per minute`} class="spark">
      <path d={d} fill="none" stroke="var(--red)" stroke-width="2" stroke-linejoin="round" />
    </svg>
  )
}

export function HealthStats(props: { health: HealthSummary }) {
  const { health: h } = props
  return (
    <div class="healthbox">
      <div class="hstats">
        {h.hr && <span><b>{h.hr.avg}</b> avg bpm</span>}
        {h.hr && <span><b>{h.hr.max}</b> max</span>}
        {h.kcal !== undefined && <span><b>{h.kcal}</b> kcal</span>}
      </div>
      {h.hr && <HrSpark points={h.hr.points} />}
      <div class="fine">From your tracker via Google Health{h.deviceExercise ? ` · session “${h.deviceExercise}”` : ''}</div>
    </div>
  )
}

/** "Add heart rate" for a finished workout, or its stored summary. Renders nothing when the integration is off. */
export function HealthForLog(props: { log: WorkoutLog; auto?: boolean }) {
  const { log } = props
  const cloud = useCloud()
  const status = useHealthStatus(!!cloud.user)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setBusy(true)
    setMsg('')
    const r = await fetchWorkoutHealth(log)
    setBusy(false)
    if (!r.ok) return setMsg(r.error)
    if (!r.data) return setMsg('Your tracker has no data for this time yet. Open the Google Health app to sync it, then try again.')
    attachHealth(log.id, r.data)
  }

  useEffect(() => {
    if (props.auto && status?.connected && !log.health) void load()
  }, [props.auto, status?.connected])

  if (log.health) return <HealthStats health={log.health} />
  if (!status?.connected) return null
  return (
    <div>
      <button class="link" disabled={busy} onClick={load}>{busy ? 'Loading…' : 'Add heart rate and calories'}</button>
      {msg && <div class="fine err">{msg}</div>}
    </div>
  )
}

export function SleepChip() {
  const cloud = useCloud()
  const status = useHealthStatus(!!cloud.user)
  const [sleep, setSleep] = useState<SleepInfo | null>(null)
  useEffect(() => {
    if (status?.connected) void fetchSleep().then(setSleep)
  }, [status?.connected])
  if (!sleep || sleep.minutesAsleep === null) return null
  const deep = sleep.stages.find((s) => s.type === 'DEEP')?.minutes
  const rem = sleep.stages.find((s) => s.type === 'REM')?.minutes
  const tip = sleep.minutesAsleep < 360 ? 'Short night: consider a lighter session.' : sleep.minutesAsleep >= 420 ? 'Well rested.' : ''
  return (
    <div class="sleepchip">
      <span>🌙 Slept <b>{fmtMinutes(sleep.minutesAsleep)}</b>{deep ? ` · deep ${fmtMinutes(deep)}` : ''}{rem ? ` · REM ${fmtMinutes(rem)}` : ''}</span>
      {tip && <small>{tip}</small>}
    </div>
  )
}

/** More tab: connect / disconnect. */
export function GoogleHealthCard() {
  const cloud = useCloud()
  const status = useHealthStatus(!!cloud.user)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  if (!cloud.user) return null
  if (!status) return <div class="card"><div class="sub">Checking Google Health…</div></div>

  const connect = async () => {
    setBusy(true)
    const err = await connectHealth()
    if (err) { setBusy(false); setMsg(err) }
  }
  const disconnect = async () => {
    if (!(await confirmDialog('Disconnect Google Health? Heart rate already saved on your workouts stays.', 'Disconnect'))) return
    setBusy(true)
    const r = await disconnectHealth()
    setBusy(false)
    if (!r.ok) return setMsg(r.error)
    clearHealthStatus()
    void refreshHealthStatus()
  }
  const days = status.expiresAt ? Math.ceil((Date.parse(status.expiresAt) - Date.now()) / 86_400_000) : null

  return (
    <>
      <h2 class="sec">Google Health (Fitbit)</h2>
      <div class="card">
        {!status.configured ? (
          <div class="sub">Not set up on this server. See docs/GOOGLE-HEALTH.md.</div>
        ) : status.connected ? (
          <>
            <h4>Connected</h4>
            <div class="sub">Heart rate, calories and sleep are read from your tracker. Nothing is written back.{days !== null ? (days > 0 ? ` Access renews in ${days} day${days === 1 ? '' : 's'} (test mode).` : ' Access has expired: connect again.') : ''} Connected {dateShort(Date.parse(status.connectedAt ?? '') || Date.now())}.</div>
            <div class="row">
              {days !== null && days <= 2 && <button class="btn" disabled={busy} onClick={connect}>Reconnect</button>}
              <button class="btn ghost" disabled={busy} onClick={disconnect}>Disconnect</button>
            </div>
          </>
        ) : (
          <>
            <div class="sub">Show your heart rate and calories on every workout, and last night's sleep on the workout screen. You approve read-only access on Google's page.</div>
            <button class="btn full" style={{ marginTop: '10px' }} disabled={busy} onClick={connect}>{busy ? '…' : 'Connect Google Health'}</button>
          </>
        )}
        {msg && <div class="sub err">{msg}</div>}
      </div>
    </>
  )
}
