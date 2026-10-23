import { clock, liveLogs } from '../logic'
import { deleteLog, useStore } from '../store'
import { confirmDialog, dateLong, timeShort } from '../ui'
import { fmtDistance, fmtPace, fmtVolume, fmtWeight } from '../units'
import { HealthForLog } from './Health'
import { ACTIVITIES } from '../cardio'
import { CardioResultForm } from './Cardio'
import { deleteExported } from '../health'

export function HistoryView() {
  const logs = liveLogs(useStore((s) => s.logs))
  const unit = useStore((s) => s.settings.units)
  if (logs.length === 0) return <div class="empty">No finished workouts yet.{'\n'}Start one in the Workout tab.</div>
  return (
    <div>
      <h2 class="sec">Recent workouts</h2>
      {logs.map((l) => (
        <div class="card" key={l.id}>
          <h4>{l.title} — {dateLong(l.endedAt)}</h4>
          <div class="sub">
            {timeShort(l.startedAt)} – {timeShort(l.endedAt)} · {clock(l.durationSec)}{l.cardio ? '' : ` · ${l.sets} sets`}
            {l.volume ? ` · ${fmtVolume(l.volume, unit)}` : ''}{l.warmSec > 60 ? ` · warm-up ${clock(l.warmSec)}` : ''}
          </div>
          {l.cardio ? (
            <>
              <div class="hist-ex">
                {ACTIVITIES[l.cardio.activity].icon} {ACTIVITIES[l.cardio.activity].label} · {l.cardio.style} · work {clock(l.cardio.workSec)} · {l.cardio.rounds} rounds
                {l.cardio.km ? ` · ${fmtDistance(l.cardio.km, unit)} · ${fmtPace(l.cardio.workSec || l.durationSec, l.cardio.km, unit)}` : ''}{l.cardio.rpe ? ` · effort ${l.cardio.rpe}/10` : ''}
              </div>
              <details><summary class="fine">Distance and effort</summary><CardioResultForm log={l} /></details>
            </>
          ) : <div class="hist-ex">{l.items.map((i) => `${i.name} ${i.kg ? fmtWeight(i.kg, unit) + ' ' : ''}${i.done}×${i.reps || ''}`).join(' · ')}</div>}
          <HealthForLog log={l} />
          <button class="link" onClick={async () => { if (await confirmDialog('Delete this workout from your history?' + (l.healthExport?.name ? ' It will also be removed from Google Health.' : ''), 'Delete')) { void deleteExported([l.healthExport?.name]); deleteLog(l.id) } }}>Delete</button>
        </div>
      ))}
    </div>
  )
}
