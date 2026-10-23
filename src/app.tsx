import { useEffect, useState } from 'preact/hooks'
import { clock } from './logic'
import { addRest, cancelWorkout, finishWorkout, getState, markRestNotified, sessionDoneSets, stopRest, useStore, type FinishResult } from './store'
import { nextDayIndex } from './logic'
import { Dialogs, Sheet, confirmDialog, useTick } from './ui'
import { fmtVolume, toDisplay } from './units'
import { HealthForLog } from './views/Health'
import { clearHealthStatus, refreshHealthStatus, useHealthStatus } from './health'
import { useCloud } from './cloud'
import { useLiveHr, useLiveHrPoller } from './live'
import { hrZone } from './logic'
import { beep, keepAwake } from './feedback'
import { ExerciseSheet } from './views/ExerciseSheet'
import { HistoryView } from './views/History'
import { Library } from './views/Library'
import { MoreView } from './views/More'
import { StatsView } from './views/Stats'
import { WorkoutView } from './views/Workout'

type Tab = 'workout' | 'library' | 'history' | 'stats' | 'more'
const TABS: [Tab, string][] = [['workout', 'Workout'], ['library', 'Library'], ['history', 'History'], ['stats', 'Stats'], ['more', 'More']]

export function App() {
  const [tab, setTab] = useState<Tab>('workout')
  const [dayIndex, setDayIndex] = useState(() => { const st = getState(); return nextDayIndex(st.plan, st.logs) })
  const [summary, setSummary] = useState<FinishResult | null>(null)
  const go = (t: Tab) => { setTab(t); window.scrollTo({ top: 0 }) }
  const running = useStore((s) => !!s.session)
  const cloudUser = useCloud().user
  const healthStatus = useHealthStatus(!!cloudUser)
  useLiveHrPoller(running, !!healthStatus?.connected)
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)

  // Returning from Google: ?health=connected or ?health=error&reason=...
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const h = q.get('health')
    if (!h) return
    history.replaceState(null, '', location.pathname)
    setTab('more')
    if (h === 'connected') {
      clearHealthStatus()
      void refreshHealthStatus()
      setNotice({ text: 'Google Health connected.', error: false })
    } else {
      const reason = q.get('reason') ?? ''
      setNotice({ text: reason === 'access_denied' ? 'Google Health access was not granted.' : `Could not connect Google Health (${reason || 'unknown'}).`, error: true })
    }
    const t = setTimeout(() => setNotice(null), 8000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    void keepAwake(running)
    const again = () => { if (running && document.visibilityState === 'visible') void keepAwake(true) }
    document.addEventListener('visibilitychange', again)
    return () => { document.removeEventListener('visibilitychange', again); void keepAwake(false) }
  }, [running])

  return (
    <>
      <div class="wrap">
        <nav class="nav" aria-label="Sections">
          {TABS.map(([id, label]) => <button key={id} aria-current={tab === id} onClick={() => go(id)}>{label}</button>)}
        </nav>
        <SessionBar onFinished={(r) => { setSummary(r); setDayIndex(r.nextDay) }} />
        {notice && <div class={'notice ' + (notice.error ? 'bad' : 'good')} role="status">{notice.text}</div>}
        <main>
          {tab === 'workout' && <WorkoutView dayIndex={dayIndex} setDayIndex={setDayIndex} onFinished={(r) => { setSummary(r); setDayIndex(r.nextDay) }} />}
          {tab === 'library' && <Library onDayCreated={(i) => { setDayIndex(i); go('workout') }} />}
          {tab === 'history' && <HistoryView />}
          {tab === 'stats' && <StatsView />}
          {tab === 'more' && <MoreView />}
        </main>
      </div>
      <RestBar />
      {summary && <Summary r={summary} onClose={() => { setSummary(null); go('history') }} />}
      <ExerciseSheet />
      <Dialogs />
    </>
  )
}

function SessionBar(props: { onFinished: (r: FinishResult) => void }) {
  const session = useStore((s) => s.session)
  const maxHr = useStore((s) => s.settings.maxHr)
  const now = useTick(!!session)
  const { reading, alert } = useLiveHr()
  if (!session) return null
  const age = reading ? (now - reading.atMs) / 1000 : null
  const fresh = reading && age !== null && age < 180
  const z = reading ? hrZone(reading.bpm, maxHr) : null
  return (
    <>
      <div class="session">
        <div class="t">{clock((now - session.startedAt) / 1000)}</div>
        <div class="lab">workout in progress</div>
        <div class="sp" />
        {reading && (
          <div class={'livehr' + (fresh ? ` z${z?.zone ?? 0}` : ' stale')} title={fresh ? 'Latest heart rate from your tracker' : 'Tracker data is not fresh'}>
            ♥ <b>{reading.bpm}</b>{fresh && z?.label ? <small> {z.label}</small> : <small> {Math.round((age ?? 0) / 60)} min ago</small>}
          </div>
        )}
        <button class="sbtn" onClick={async () => {
          if (sessionDoneSets() === 0 && !(await confirmDialog('No sets are ticked. Finish anyway?', 'Finish'))) return
          const r = finishWorkout()
          if (r) props.onFinished(r)
        }}>Finish</button>
        <button class="sbtn" aria-label="Cancel workout" onClick={async () => { if (await confirmDialog('Discard this workout without saving?', 'Discard')) cancelWorkout() }}>✕</button>
      </div>
      {alert && <div class="notice bad" role="alert">{alert}</div>}
    </>
  )
}

function RestBar() {
  const session = useStore((s) => s.session)
  const vibrate = useStore((s) => s.settings.vibrate)
  const sound = useStore((s) => s.settings.sound)
  const end = session?.restEnd ?? null
  const now = useTick(end !== null)
  const left = end === null ? 0 : (end - now) / 1000
  const over = end !== null && left <= 0
  const notified = session?.restNotified ?? true

  useEffect(() => {
    if (over && !notified) {
      markRestNotified()
      if (vibrate && 'vibrate' in navigator) navigator.vibrate([200, 100, 200])
      if (sound) beep()
    }
  }, [over, notified, vibrate, sound])

  if (end === null) return null
  return (
    <div class={'rest' + (over ? ' over' : '')} role="timer">
      <div class="t">{over ? 'Go!' : clock(left)}</div>
      <RestHr />
      <div class="sp" />
      <button onClick={() => addRest(30)}>+30 s</button>
      <button onClick={stopRest}>Stop</button>
    </div>
  )
}

const PR_LABEL = { weight: 'Heaviest weight', e1rm: 'Estimated 1RM', reps: 'Most reps' } as const

function Summary(props: { r: FinishResult; onClose: () => void }) {
  const { log, records } = props.r
  const plan = useStore((s) => s.plan)
  const unit = useStore((s) => s.settings.units)
  const next = plan[props.r.nextDay]
  const liveLog = useStore((s) => s.logs.find((l) => l.id === log.id))
  return (
    <Sheet title="Workout complete" onClose={props.onClose}>
      <div class="grid3">
        <div class="card"><div class="big">{clock(log.durationSec)}</div><div class="sub">time</div></div>
        <div class="card"><div class="big">{log.sets}</div><div class="sub">sets</div></div>
        <div class="card"><div class="big">{fmtVolume(log.volume, unit)}</div><div class="sub">volume</div></div>
      </div>
      {records.length > 0 ? (
        <>
          <h4 class="sub-h"><span class="trophy">★</span> New records</h4>
          {records.map((x) => (
            <div class="pr" key={x.key + x.kind}>
              <span>{x.name}<small class="sub"> · {PR_LABEL[x.kind]}</small></span>
              <b>{x.kind === 'reps' ? x.value : `${toDisplay(x.value, unit)} ${unit}`}{x.previous ? ` (was ${x.kind === 'reps' ? x.previous : toDisplay(x.previous, unit)})` : ''}</b>
            </div>
          ))}
        </>
      ) : <p class="focus">No new records this time. Consistency is what builds them.</p>}
      {liveLog && <HealthForLog log={liveLog} auto />}
      {next && <p class="focus">Next in your plan: <b>{next.title}</b></p>}
      <button class="btn full" style={{ marginTop: '12px' }} onClick={props.onClose}>Done</button>
    </Sheet>
  )
}

/** During rest: current heart rate and whether it has recovered below 70% of max. */
function RestHr() {
  const maxHr = useStore((s) => s.settings.maxHr)
  const { reading } = useLiveHr()
  const now = useTick(!!reading)
  if (!reading || now - reading.atMs > 180_000) return null
  const recovered = reading.bpm < maxHr * 0.7
  return <div class={'restHr' + (recovered ? ' ok' : '')}>♥ {reading.bpm}<small>{recovered ? ' recovered' : ' recovering'}</small></div>
}
