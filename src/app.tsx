import { useEffect, useState } from 'preact/hooks'
import { clock } from './logic'
import { addRest, markRestNotified, stopRest, useStore } from './store'
import { Dialogs, useTick } from './ui'
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
  const [dayIndex, setDayIndex] = useState(0)
  const go = (t: Tab) => { setTab(t); window.scrollTo({ top: 0 }) }

  return (
    <>
      <div class="wrap">
        <nav class="nav" aria-label="Sections">
          {TABS.map(([id, label]) => <button key={id} aria-current={tab === id} onClick={() => go(id)}>{label}</button>)}
        </nav>
        <SessionBar />
        <main>
          {tab === 'workout' && <WorkoutView dayIndex={dayIndex} setDayIndex={setDayIndex} goHistory={() => go('history')} />}
          {tab === 'library' && <Library />}
          {tab === 'history' && <HistoryView />}
          {tab === 'stats' && <StatsView />}
          {tab === 'more' && <MoreView />}
        </main>
      </div>
      <RestBar />
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
  const end = session?.restEnd ?? null
  const now = useTick(end !== null)
  const left = end === null ? 0 : (end - now) / 1000
  const over = end !== null && left <= 0
  const notified = session?.restNotified ?? true

  useEffect(() => {
    if (over && !notified) {
      markRestNotified()
      if (vibrate && 'vibrate' in navigator) navigator.vibrate([200, 100, 200])
    }
  }, [over, notified, vibrate])

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
