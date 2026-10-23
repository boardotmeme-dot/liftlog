import { useEffect, useState } from 'preact/hooks'
import { clock } from './logic'
import { addRest, getState, markRestNotified, stopRest, useStore, type FinishResult } from './store'
import { nextDayIndex } from './logic'
import { Dialogs, Sheet, useTick } from './ui'
import { fmtVolume, toDisplay } from './units'
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
        <SessionBar />
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

function SessionBar() {
  const session = useStore((s) => s.session)
  const now = useTick(!!session)
  if (!session) return null
  return <div class="session"><div class="t">{clock((now - session.startedAt) / 1000)}</div><div class="lab">workout in progress</div></div>
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
      {next && <p class="focus">Next in your plan: <b>{next.title}</b></p>}
      <button class="btn full" style={{ marginTop: '12px' }} onClick={props.onClose}>Done</button>
    </Sheet>
  )
}
