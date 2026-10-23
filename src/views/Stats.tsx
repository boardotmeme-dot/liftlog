import { useState } from 'preact/hooks'
import { MUSCLE_LABEL } from '../catalog'
import { DAY_MS, POSTERIOR, PULL, PUSH, QUADS, daysSinceTrained, e1rmSeries, liveLogs, setsByGroup, setsInGroups, stalledExercises, trackedExercises, weekStreak, weightSeries, workoutsThisWeek } from '../logic'
import { useStore } from '../store'
import { Select, dateShort } from '../ui'

function Ratio(props: { a: string; av: number; b: string; bv: number; hint: string }) {
  const tot = props.av + props.bv || 1
  return (
    <div>
      <div class="statrow"><span>{props.a} — {props.b}</span><span>{props.av} : {props.bv}</span></div>
      <div class="ratio">
        <div style={{ background: 'var(--ink)', width: `${(props.av / tot) * 100}%` }}>{Math.round((props.av / tot) * 100)}%</div>
        <div style={{ background: 'var(--grey)', width: `${(props.bv / tot) * 100}%` }}>{Math.round((props.bv / tot) * 100)}%</div>
      </div>
      <div class="sub">{props.hint}</div>
    </div>
  )
}

function Line(props: { pts: { t: number; kg: number }[] }) {
  const w = 320, h = 140, pad = 18
  const xs = props.pts.map((p) => p.t), ys = props.pts.map((p) => p.kg)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const sx = (v: number) => pad + (x1 === x0 ? 0 : ((v - x0) / (x1 - x0)) * (w - pad * 2))
  const sy = (v: number) => h - pad - (y1 === y0 ? (h - pad * 2) / 2 : ((v - y0) / (y1 - y0)) * (h - pad * 2))
  const d = props.pts.map((p, i) => `${i ? 'L' : 'M'} ${sx(p.t).toFixed(1)} ${sy(p.kg).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Weight over time">
      <path d={d} fill="none" stroke="var(--ink)" stroke-width="2" />
      {props.pts.map((p) => <circle key={p.t} cx={sx(p.t)} cy={sy(p.kg)} r="3" fill="var(--ink)" />)}
      <text x="2" y={pad + 4} font-size="10" fill="var(--muted)">{y1}kg</text>
      <text x="2" y={h - pad + 4} font-size="10" fill="var(--muted)">{y0}kg</text>
    </svg>
  )
}

export function StatsView() {
  const logs = liveLogs(useStore((s) => s.logs))
  const [picked, setPicked] = useState('')
  const [metric, setMetric] = useState<'kg' | 'e1rm'>('kg')
  const goal = useStore((s) => s.settings.weeklyGoal)
  if (logs.length === 0) return <div class="empty">Stats appear after your first finished workout.</div>

  const now = Date.now()
  const since = now - 30 * DAY_MS
  const recent = logs.filter((l) => l.endedAt >= since)
  const avgMin = recent.length ? Math.round(recent.reduce((a, l) => a + l.durationSec, 0) / recent.length / 60) : 0

  const groups = setsByGroup(logs, since)
  const max = groups[0]?.sets ?? 1
  const tracked = trackedExercises(logs)
  const key = tracked.some((t) => t.key === picked) ? picked : tracked[0]?.key
  const pts = key ? (metric === 'kg' ? weightSeries(logs, key) : e1rmSeries(logs, key)) : []
  const recovery = daysSinceTrained(logs, now)
  const stalled = stalledExercises(logs, now)

  const trained = new Set(logs.map((l) => new Date(l.endedAt).toDateString()))
  const cal = Array.from({ length: 91 }, (_, i) => new Date(now - (90 - i) * DAY_MS))

  return (
    <div>
      <div class="grid3">
        <div class="card"><div class="big">{recent.length}</div><div class="sub">last 30 days</div></div>
        <div class="card"><div class="big">{logs.length}</div><div class="sub">total</div></div>
        <div class="card"><div class="big">{avgMin}′</div><div class="sub">average</div></div>
      </div>

      <div class="card goalcard">
        <div class="statrow"><span>This week</span><span>{workoutsThisWeek(logs)} / {goal}</span></div>
        <div class="gbar"><i style={{ width: `${Math.min(100, (workoutsThisWeek(logs) / goal) * 100)}%`, background: 'var(--green)' }} /></div>
        <div class="sub">{weekStreak(logs, goal) > 0 ? `🔥 ${weekStreak(logs, goal)} week${weekStreak(logs, goal) > 1 ? 's' : ''} in a row at your goal` : 'Hit your weekly goal to start a streak.'}</div>
      </div>

      <h2 class="sec">Balance, last 30 days</h2>
      <div class="card">
        <Ratio a="Pull" av={setsInGroups(logs, PULL, since)} b="Push" bv={setsInGroups(logs, PUSH, since)} hint="Healthy programs are close to 1:1 pull to push." />
        <div style={{ height: '12px' }} />
        <Ratio a="Quads" av={setsInGroups(logs, QUADS, since)} b="Posterior chain" bv={setsInGroups(logs, POSTERIOR, since)} hint="Hamstrings, glutes and lower back should not lag behind quads." />
      </div>

      <h2 class="sec">Sets per muscle, last 30 days</h2>
      <div class="card">
        {groups.map((g) => (
          <div key={g.group}>
            <div class="statrow"><span>{MUSCLE_LABEL[g.group]}</span><span>{g.sets}{g.volume ? ` · ${Math.round(g.volume).toLocaleString()} kg` : ''}</span></div>
            <div class="gbar"><i style={{ width: `${(g.sets / max) * 100}%`, background: g.sets >= 10 && g.sets <= 20 ? 'var(--green)' : g.sets > 20 ? 'var(--red)' : 'var(--yellow)' }} /></div>
          </div>
        ))}
      </div>
      <p class="fine">Green: 10–20 working sets. Yellow: fewer. Red: more. Second number is volume (weight × reps).</p>

      {tracked.length > 0 && (
        <>
          <h2 class="sec">Weight progress</h2>
          <div class="card">
            <Select label="Metric" value={metric} options={[['kg', 'Heaviest weight'], ['e1rm', 'Estimated 1RM']]} onChange={setMetric} />
            <Select label="Exercise" value={key ?? ''} options={tracked.map((t) => [t.key, t.name])} onChange={setPicked} />
            {pts.length >= 2 ? <Line pts={pts} /> : <div class="sub">Two workouts with this exercise are needed.</div>}
            {pts.length >= 2 && <div class="sub">{(() => { const df = +(pts[pts.length - 1].kg - pts[0].kg).toFixed(1); return `${df > 0 ? '+' : ''}${df} kg from ${dateShort(pts[0].t)} to ${dateShort(pts[pts.length - 1].t)}` })()}</div>}
          </div>
        </>
      )}

      {stalled.length > 0 && (
        <>
          <h2 class="sec">Plateaus</h2>
          <div class="card">
            <div class="sub">Best weight has not been beaten for 4+ weeks. Consider changing reps, rest or the exercise.</div>
            {stalled.map((s) => <div class="statrow" key={s.key}><span>{s.name}</span><span>{s.kg} kg · {s.weeks} wk</span></div>)}
          </div>
        </>
      )}

      <h2 class="sec">Recovery</h2>
      <div class="card">
        <div class="sub">Days since each muscle was last trained.</div>
        {recovery.map((r) => <div class="statrow" key={r.group}><span>{MUSCLE_LABEL[r.group]}</span><span style={{ color: r.days >= 7 ? 'var(--red)' : r.days <= 1 ? 'var(--muted)' : 'inherit' }}>{r.days === 0 ? 'today' : `${r.days} d`}</span></div>)}
      </div>

      <h2 class="sec">Last 90 days</h2>
      <div class="card">
        <div class="cal">{cal.map((d) => <i key={d.getTime()} class={trained.has(d.toDateString()) ? 'on' : ''} title={dateShort(d.getTime())} />)}</div>
        <div class="sub">{trained.size} training days in total</div>
      </div>
    </div>
  )
}
