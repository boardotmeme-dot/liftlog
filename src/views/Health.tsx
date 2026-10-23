import { useEffect, useState } from 'preact/hooks'
import { useCloud } from '../cloud'
import { clearHealthStatus, connectHealth, disconnectHealth, fetchToday, fetchWorkoutHealth, fmtMinutes, refreshHealthStatus, useHealthStatus, type TodayData } from '../health'
import { recovery, vsBaseline } from '../logic'
import { attachHealth, patchSettings, useStore } from '../store'
import { sendWorkout } from '../export'
import { Select, Stepper, confirmDialog, dateShort, timeShort } from '../ui'
import type { HealthSummary, WorkoutLog } from '../types'

/** Small line chart of heart rate over the workout (points are 0 where the tracker had no sample). */
export function HrSpark(props: { points: number[]; color?: string }) {
  const pts = props.points.map((v, i) => ({ v, i })).filter((p) => p.v > 0)
  if (pts.length < 2) return null
  const w = 300, h = 56, n = props.points.length - 1
  const lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v))
  const y = (v: number) => h - 4 - (hi === lo ? (h - 8) / 2 : ((v - lo) / (hi - lo)) * (h - 8))
  const d = pts.map((p, k) => `${k ? 'L' : 'M'} ${((p.i / n) * w).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`Heart rate from ${lo} to ${hi} beats per minute`} class="spark">
      <path d={d} fill="none" stroke={props.color ?? "var(--red)"} stroke-width="2" stroke-linejoin="round" />
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
    if (!r.data) {
      const latest = r.latestSampleMs ?? null
      if (latest !== null && latest < log.endedAt) return setMsg(`Google only has tracker data up to ${timeShort(latest)}, before this workout ended. Open the Google Health app to sync your tracker, then try again.`)
      if (latest !== null) return setMsg('No heart-rate samples were recorded during this workout. Make sure the tracker was on your wrist, and note that very short workouts may have none.')
      return setMsg('No tracker data found. Open the Google Health app to sync, then try again.')
    }
    attachHealth(log.id, r.data)
  }

  useEffect(() => {
    if (props.auto && status?.connected && !log.health) void load()
  }, [props.auto, status?.connected])

  const send = async () => {
    setBusy(true)
    setMsg('')
    const err = await sendWorkout(log.id)
    setBusy(false)
    if (err) setMsg(err)
  }
  const exportLine = log.healthExport
    ? <div class="fine">{log.healthExport.status === 'sent' ? '✓ Sent to Google Health' : 'Your tracker already recorded this workout, nothing was sent.'}</div>
    : status?.canWrite && log.sets > 0
      ? <button class="link" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send to Google Health'}</button>
      : null

  if (!status?.connected) return null
  return (
    <div>
      {log.health ? <HealthStats health={log.health} /> : <button class="link" disabled={busy} onClick={load}>{busy ? 'Loading…' : 'Add heart rate and calories'}</button>}
      {exportLine}
      {msg && <div class="fine err">{msg}</div>}
    </div>
  )
}

const nf = (n: number | null | undefined) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString())

function Delta(props: { pct: number | null; goodWhen: 'up' | 'down' }) {
  if (props.pct === null) return null
  const good = props.goodWhen === 'up' ? props.pct >= 0 : props.pct <= 0
  return <small class={'delta ' + (Math.abs(props.pct) < 3 ? '' : good ? 'ok' : 'bad')}>{props.pct > 0 ? '+' : ''}{props.pct}% vs your 2-week norm</small>
}

/** Workout tab: recovery, sleep and the day's numbers from the tracker. */
export function TodayPanel() {
  const cloud = useCloud()
  const status = useHealthStatus(!!cloud.user)
  const [data, setData] = useState<TodayData | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = async (force = false) => {
    setBusy(true)
    setData(await fetchToday(force))
    setBusy(false)
  }
  useEffect(() => { if (status?.connected) void load() }, [status?.connected])

  if (!status?.connected) return null
  if (!data) return <div class="today"><div class="sub">{busy ? 'Loading your tracker data…' : 'No tracker data yet.'}</div></div>

  const rhr = data.resting.map((x) => x.bpm)
  const hrv = data.hrv.map((x) => x.ms)
  const todayDay = data.days.find((d) => d.date === data.todayKey)
  const rec = recovery(data.sleep?.minutesAsleep ?? null, hrv, rhr)
  const week = data.days.map((d) => d.steps ?? 0)
  const maxSteps = Math.max(1, ...week)
  const deep = data.sleep?.stages.find((s) => s.type === 'DEEP')?.minutes
  const rem = data.sleep?.stages.find((s) => s.type === 'REM')?.minutes

  return (
    <div class="today">
      <button class="todayhead" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          {rec ? <><b class={'rec ' + (rec.score >= 75 ? 'ok' : rec.score >= 55 ? '' : 'bad')}>{rec.score}</b> recovery · {rec.label}</> : 'Today'}
        </span>
        <span class="chev">{open ? '▴' : '▾'}</span>
      </button>
      {rec && <div class="sub">{rec.hint}</div>}
      {data.sleep?.minutesAsleep != null && (
        <div class="sleepchip"><span>🌙 Slept <b>{fmtMinutes(data.sleep.minutesAsleep)}</b>{deep ? ` · deep ${fmtMinutes(deep)}` : ''}{rem ? ` · REM ${fmtMinutes(rem)}` : ''}</span></div>
      )}
      {open && (
        <div class="tgrid">
          <div class="tcell"><span>Resting HR</span><b>{rhr[0] ?? '—'}<i> bpm</i></b><Delta pct={vsBaseline(rhr)} goodWhen="down" /></div>
          <div class="tcell"><span>HRV</span><b>{hrv[0] !== undefined ? Math.round(hrv[0]) : '—'}<i> ms</i></b><Delta pct={vsBaseline(hrv)} goodWhen="up" /></div>
          <div class="tcell"><span>Steps today</span><b>{nf(todayDay?.steps)}</b>
            <div class="bars" aria-label="Steps, last 7 days">{week.map((v, i) => <i key={i} style={{ height: `${Math.max(6, (v / maxSteps) * 100)}%` }} class={data.days[i]?.date === data.todayKey ? 'now' : ''} />)}</div></div>
          <div class="tcell"><span>Calories today</span><b>{nf(todayDay?.kcal)}<i> kcal</i></b></div>
          <div class="tcell"><span>Distance</span><b>{todayDay?.distanceM != null ? (todayDay.distanceM / 1000).toFixed(1) : '—'}<i> km</i></b></div>
          <div class="tcell"><span>Active zone min</span><b>{nf(todayDay?.azm)}</b></div>
          <div class="tcell"><span>Breathing</span><b>{data.respiratoryRate ?? '—'}<i> /min</i></b></div>
          <div class="tcell"><span>Weight</span><b>{data.weight ? data.weight.kg : '—'}<i> kg</i></b>{data.weight?.atMs ? <small>{dateShort(data.weight.atMs)}</small> : null}</div>
          <div class="tfoot">
            <button class="link" disabled={busy} onClick={() => load(true)}>{busy ? 'Refreshing…' : 'Refresh'}</button>
            <span class="fine">Recovery = sleep (40) + HRV (30) + resting HR (30) against your own 2-week baseline. A guide, not medical advice.</span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Stats tab: two-week trends of resting heart rate and HRV, weekly steps. */
export function HealthTrends() {
  const cloud = useCloud()
  const status = useHealthStatus(!!cloud.user)
  const [data, setData] = useState<TodayData | null>(null)
  useEffect(() => { if (status?.connected) void fetchToday().then(setData) }, [status?.connected])
  if (!status?.connected || !data) return null
  const rhr = [...data.resting].reverse().map((x) => x.bpm)
  const hrv = [...data.hrv].reverse().map((x) => Math.round(x.ms))
  const steps = data.days.map((d) => d.steps ?? 0)
  return (
    <>
      <h2 class="sec">Body, from your tracker</h2>
      <div class="card">
        {rhr.length > 1 && <><div class="statrow"><span>Resting heart rate</span><span>{rhr[rhr.length - 1]} bpm</span></div><HrSpark points={rhr} /></>}
        {hrv.length > 1 && <><div class="statrow" style={{ marginTop: '10px' }}><span>HRV</span><span>{hrv[hrv.length - 1]} ms</span></div><HrSpark points={hrv} color="var(--blue)" /></>}
        {steps.length > 1 && <div class="sub" style={{ marginTop: '10px' }}>Steps, last 7 days: {steps.map((v) => v.toLocaleString()).join(' · ')}</div>}
      </div>
    </>
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

  const connect = async (write = false) => {
    setBusy(true)
    const err = await connectHealth(write)
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
        ) : status.allowed === false && !status.connected ? (
          <div class="sub">Google Health is limited to the owner of this server. To use it with your own tracker, host your own copy of liftlog: see docs/SETUP.md and docs/GOOGLE-HEALTH.md.</div>
        ) : status.connected ? (
          <>
            <h4>Connected</h4>
            <div class="sub">Heart rate, calories and sleep are read from your tracker. Nothing is written back.{days !== null ? (days > 0 ? ` Access renews in ${days} day${days === 1 ? '' : 's'} (test mode).` : ' Access has expired: connect again.') : ''} Connected {dateShort(Date.parse(status.connectedAt ?? '') || Date.now())}.</div>
            <div class="row">
              {days !== null && days <= 2 && <button class="btn" disabled={busy} onClick={() => connect(!!status.canWrite)}>Reconnect</button>}
              <button class="btn ghost" disabled={busy} onClick={disconnect}>Disconnect</button>
            </div>
            <HrSettings />
            <WriteSettings canWrite={!!status.canWrite} busy={busy} onEnable={() => connect(true)} />
          </>
        ) : (
          <>
            <div class="sub">Show your heart rate and calories on every workout, and last night's sleep on the workout screen. You approve read-only access on Google's page.</div>
            <button class="btn full" style={{ marginTop: '10px' }} disabled={busy} onClick={() => connect(false)}>{busy ? '…' : 'Connect Google Health'}</button>
          </>
        )}
        {msg && <div class="sub err">{msg}</div>}
      </div>
    </>
  )
}

function HrSettings() {
  const s = useStore((x) => x.settings)
  return (
    <>
      <h4 class="sub-h">Heart rate during workouts</h4>
      <Select label="Alerts" value={s.hrAlert ? '1' : '0'} options={[['1', 'On'], ['0', 'Off']]} onChange={(v) => patchSettings({ hrAlert: v === '1' })} />
      <Stepper label="Max HR" value={s.maxHr} step={1} min={120} max={230} unit="bpm" onChange={(v) => patchSettings({ maxHr: Math.round(v ?? 190) })} />
      {s.hrAlert && <Stepper label="Alert at" value={s.hrAlertPct} step={1} min={60} max={100} unit="% of max" onChange={(v) => patchSettings({ hrAlertPct: Math.round(v ?? 90) })} />}
      <div class="sub">While a workout is running, your latest heart rate is shown at the top and zones are colour coded. An alert (banner, vibration, beep) fires when you reach the chosen share of your max, at most once every 3 minutes. A common estimate of max HR is 220 minus your age. The tracker syncs every minute or so, so this is near-live, not instant.</div>
    </>
  )
}

function WriteSettings(props: { canWrite: boolean; busy: boolean; onEnable: () => void }) {
  const s = useStore((x) => x.settings)
  return (
    <>
      <h4 class="sub-h">Send to Google Health</h4>
      {!props.canWrite ? (
        <>
          <div class="sub">Optional: write finished workouts (when your tracker did not record them) and your body weight into Google Health. This needs extra permission, which you grant on Google's page.</div>
          <button class="btn full" style={{ marginTop: '8px' }} disabled={props.busy} onClick={props.onEnable}>Allow writing</button>
        </>
      ) : (
        <>
          <Select label="Workouts" value={s.exportWorkouts ? '1' : '0'} options={[['0', 'Only when I tap Send'], ['1', 'Automatically']]} onChange={(v) => patchSettings({ exportWorkouts: v === '1' })} />
          <Select label="Body weight" value={s.exportWeight ? '1' : '0'} options={[['0', 'Keep in liftlog only'], ['1', 'Also send to Google Health']]} onChange={(v) => patchSettings({ exportWeight: v === '1' })} />
          <div class="sub">Workouts are sent as a strength session with your exercises in the notes. Automatic sending waits two hours after a workout, so your tracker has time to upload its own session, and nothing is sent if the tracker already recorded one. Entries you delete in liftlog are removed from Google Health too.</div>
        </>
      )}
    </>
  )
}
