import { clock, liveLogs } from '../logic'
import { deleteLog, useStore } from '../store'
import { confirmDialog, dateLong, timeShort } from '../ui'

export function HistoryView() {
  const logs = liveLogs(useStore((s) => s.logs))
  if (logs.length === 0) return <div class="empty">No finished workouts yet.{'\n'}Start one in the Workout tab.</div>
  return (
    <div>
      <h2 class="sec">Recent workouts</h2>
      {logs.map((l) => (
        <div class="card" key={l.id}>
          <h4>{l.title} — {dateLong(l.endedAt)}</h4>
          <div class="sub">
            {timeShort(l.startedAt)} – {timeShort(l.endedAt)} · {clock(l.durationSec)} · {l.sets} sets
            {l.volume ? ` · ${l.volume.toLocaleString()} kg` : ''}{l.warmSec > 60 ? ` · warm-up ${clock(l.warmSec)}` : ''}
          </div>
          <div class="hist-ex">{l.items.map((i) => `${i.name} ${i.kg ? i.kg + 'kg ' : ''}${i.done}×${i.reps || ''}`).join(' · ')}</div>
          <button class="link" onClick={async () => { if (await confirmDialog('Delete this workout from your history?', 'Delete')) deleteLog(l.id) }}>Delete</button>
        </div>
      ))}
    </div>
  )
}
