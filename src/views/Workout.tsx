import { useRef, useState } from 'preact/hooks'
import { EQUIPMENT_LABEL, MUSCLE_LABEL, resolveKey } from '../catalog'
import { clock, isTimed, liveLogs, nextDayIndex, platesFor, repsLabel, topReps, warmupRamp, weekStreak, workoutsThisWeek } from '../logic'
import { unlockAudio } from '../feedback'
import {
  addDay, addExercise, applyTemplate, cancelWorkout, currentKg, currentReps, deleteDay, editSet, finishWorkout, moveExercise,
  patchDay, patchExercise, removeExercise, sessionDoneSets, setSessionKg, setSessionReps, startWorkout, toggleSet, toggleWarmup, useStore,
} from '../store'
import { TEMPLATES } from '../data/templates'
import { Sheet, Stepper, TextField, confirmDialog, dateShort, openExercise, timeShort, useTick } from '../ui'
import { Library } from './Library'
import type { FinishResult } from '../store'
import type { PlanDay, PlanExercise, SetRec, WorkoutLog } from '../types'

export function WorkoutView(props: { dayIndex: number; setDayIndex: (i: number) => void; onFinished: (r: FinishResult) => void }) {
  const plan = useStore((s) => s.plan)
  const session = useStore((s) => s.session)
  const logs = useStore((s) => s.logs)
  const goal = useStore((s) => s.settings.weeklyGoal)
  const [editMode, setEditMode] = useState(false)
  const [adding, setAdding] = useState(false)

  if (plan.length === 0) return <Onboarding />

  const index = Math.min(props.dayIndex, plan.length - 1)
  const day = plan[index]
  const active = session?.dayId === day.id
  const suggested = nextDayIndex(plan, logs)
  const total = day.exercises.reduce((n, e) => n + e.sets, 0)
  const done = active ? day.exercises.reduce((n, e) => n + (session!.sets[e.id] ?? []).filter(Boolean).length, 0) : 0

  return (
    <div>
      <div class="days" role="tablist">
        {plan.map((d, i) => (
          <button key={d.id} role="tab" class="day-tab" aria-selected={i === index} onClick={() => { props.setDayIndex(i); setEditMode(false) }}>{d.title}{!session && i === suggested && plan.length > 1 && <span class="next-dot" title="Next in your plan" />}</button>
        ))}
        <button class="day-tab" aria-label="Add day" onClick={() => { props.setDayIndex(plan.length); setEditMode(true); addDay() }}>+</button>
      </div>

      <header class="day">
        {editMode ? (
          <>
            <h1><TextField label="" value={day.title} onCommit={(v) => patchDay(day.id, { title: v.trim() || day.title })} /></h1>
            <TextField label="" value={day.focus} placeholder="what is this day for" onCommit={(v) => patchDay(day.id, { focus: v.trim() })} />
          </>
        ) : (
          <>
            <h1>{day.title}</h1>
            <div class="focus">{day.focus}</div>
          </>
        )}
        <WeekLine logs={logs} goal={goal} />
        <div class="bar"><i style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} /></div>
        <div class="barlab">
          <span>{done} of {total} sets</span>
          <button class="link" onClick={() => setEditMode(!editMode)}>{editMode ? 'Done' : 'Edit'}</button>
        </div>
      </header>

      <StartBox day={day} active={active} otherActive={!!session && !active} />

      <ol class="list">
        {day.exercises.map((e, i) => (
          <ExerciseRow key={e.id} day={day} ex={e} index={i} last={day.exercises.length - 1} editMode={editMode} active={active} />
        ))}
      </ol>
      {day.exercises.length === 0 && <div class="empty">This day has no exercises yet.</div>}
      <button class="btn ghost full" onClick={() => setAdding(true)}>+ Add exercise</button>

      {active && <FinishBox onFinished={props.onFinished} />}

      {editMode && plan.length > 1 && !active && (
        <button class="link danger" onClick={async () => {
          if (await confirmDialog(`Delete the whole day “${day.title}”?`, 'Delete')) { deleteDay(day.id); props.setDayIndex(0) }
        }}>Delete day “{day.title}”</button>
      )}

      {adding && (
        <Sheet title="Add exercise" onClose={() => setAdding(false)}>
          <Library onPick={(key) => { addExercise(day.id, key); setAdding(false) }} />
        </Sheet>
      )}
    </div>
  )
}

function WeekLine(props: { logs: WorkoutLog[]; goal: number }) {
  const done = workoutsThisWeek(props.logs)
  const streak = weekStreak(props.logs, props.goal)
  return (
    <div class="weekline">
      <span>This week {done}/{props.goal}</span>
      {streak > 0 && <span>🔥 {streak} week{streak > 1 ? 's' : ''} in a row</span>}
    </div>
  )
}

function Onboarding() {
  return (
    <div>
      <h2 class="sec">Pick a starting plan</h2>
      <p class="focus">You can change everything afterwards: add days, swap exercises, edit sets and reps.</p>
      {TEMPLATES.map((t) => (
        <div class="card" key={t.id}>
          <h4>{t.name}</h4>
          <div class="sub">{t.description}</div>
          <div class="sub">{t.days.map((d) => d.title).join(' · ')}</div>
          <button class="btn full" style={{ marginTop: '10px' }} onClick={() => applyTemplate(t.id)}>Use this plan</button>
        </div>
      ))}
      <div class="card">
        <h4>Start empty</h4>
        <div class="sub">Build your own day from the exercise library.</div>
        <button class="btn ghost full" style={{ marginTop: '10px' }} onClick={() => addDay()}>Create an empty day</button>
      </div>
    </div>
  )
}

function StartBox(props: { day: PlanDay; active: boolean; otherActive: boolean }) {
  const session = useStore((s) => s.session)
  useTick(!!session?.warmStart)
  if (!session) return <div class="startbox"><button class="btn" onClick={() => startWorkout(props.day.id)}>Start workout</button></div>
  if (!props.active) return <div class="startbox"><div class="focus">A workout is running on another day.</div></div>
  const warm = session.warmSec + (session.warmStart ? (Date.now() - session.warmStart) / 1000 : 0)
  return (
    <div class="startbox">
      <div class="warmbox">
        <div><div class="wlab">Warm-up</div><div class="wtime">{clock(warm)}</div></div>
        <div class="sp" />
        <button class={'btn small' + (session.warmStart ? '' : ' ghost')} onClick={toggleWarmup}>{session.warmStart ? 'Stop' : session.warmSec > 1 ? 'Resume' : 'Start'}</button>
      </div>
    </div>
  )
}

function lastTime(logs: WorkoutLog[], key: string) {
  for (const l of liveLogs(logs)) {
    const it = l.items.find((i) => i.key === key)
    if (it) return { it, at: l.endedAt }
  }
  return null
}

function ExerciseRow(props: { day: PlanDay; ex: PlanExercise; index: number; last: number; editMode: boolean; active: boolean }) {
  const { day, ex, editMode, active } = props
  const session = useStore((s) => s.session)
  const custom = useStore((s) => s.custom)
  const logs = useStore((s) => s.logs)
  const settings = useStore((s) => s.settings)
  const [openNote, setOpenNote] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [plates, setPlates] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)

  const meta = resolveKey(ex.key, custom)
  const kg = currentKg(ex, session)
  const reps = currentReps(ex, session)
  const row = (active && session!.sets[ex.id]) || []
  const doneCount = row.filter(Boolean).length
  const lt = lastTime(logs, ex.key)
  const barbell = meta.equipment === 'barbell' || meta.equipment === 'ez-bar' || meta.equipment === 'smith-machine'

  const timed = isTimed(ex.reps)
  const logged = row.filter((r): r is SetRec => !!r)
  const top = topReps(ex.reps)
  const hitTop = top === 0 || logged.every((r) => r.reps >= top)
  const raise = active && !timed && doneCount === ex.sets && kg !== null && kg >= (ex.kg ?? 0) && hitTop

  return (
    <li class={'ex' + (ex.sets > 0 && doneCount === ex.sets ? ' done' : '')}>
      <div class="top">
        <div class="idx">{props.index + 1}</div>
        <div class="bd">
          <button class="name" onClick={() => openExercise(ex.key)}>{meta.name}</button>
          <div><span class="group">{MUSCLE_LABEL[meta.group]}</span></div>
          {lt && (
            <div class="last">last time: {lt.it.kg ? `${lt.it.kg} kg · ` : ''}{lt.it.done}×{lt.it.reps || ''} · {dateShort(lt.at)}</div>
          )}
          <div class="meta">
            {active ? (
              <div class="kgctl">
                <button class="step" aria-label="Lower weight" onClick={() => setSessionKg(ex.id, stepKg(kg, -1, barbell, settings.barKg))}>−</button>
                <button class="kg" onClick={() => setPlates(true)}>{kg ?? '—'} kg</button>
                <button class="step" aria-label="Raise weight" onClick={() => setSessionKg(ex.id, stepKg(kg, 1, barbell, settings.barKg))}>+</button>
              </div>
            ) : kg !== null ? (
              <button class="kg" onClick={() => setPlates(true)}>{kg} kg</button>
            ) : null}
            <span class="reps">{ex.sets} × {ex.reps || '—'}</span>
            {active && (
              <div class="kgctl">
                <button class="step" aria-label={timed ? 'Shorter hold' : 'Fewer reps'} onClick={() => setSessionReps(ex.id, reps - (timed ? 5 : 1))}>−</button>
                <span class="reps">{timed ? `${reps} s` : `${reps} reps`}</span>
                <button class="step" aria-label={timed ? 'Longer hold' : 'More reps'} onClick={() => setSessionReps(ex.id, reps + (timed ? 5 : 1))}>+</button>
              </div>
            )}
          </div>
        </div>
        <div class="btns">
          {ex.note && <button class="icon" aria-expanded={openNote} aria-label="Note" onClick={() => setOpenNote(!openNote)}>?</button>}
          <button class="icon" aria-expanded={openEdit} aria-label="Edit exercise" onClick={() => setOpenEdit(!openEdit)}>✎</button>
          {editMode && (
            <>
              <button class="icon" disabled={props.index === 0} aria-label="Move up" onClick={() => moveExercise(day.id, ex.id, -1)}>↑</button>
              <button class="icon" disabled={props.index === props.last} aria-label="Move down" onClick={() => moveExercise(day.id, ex.id, 1)}>↓</button>
              <button class="icon del" aria-label="Remove" onClick={async () => {
                if (await confirmDialog(`Remove “${meta.name}” from this day?`, 'Remove')) removeExercise(day.id, ex.id)
              }}>✕</button>
            </>
          )}
        </div>
      </div>

      {openNote && ex.note && <div class="note">{ex.note}</div>}

      {openEdit && (
        <div class="edit">
          <Stepper label="Plan weight" value={ex.kg} step={2.5} unit="kg" onChange={(v) => patchExercise(day.id, ex.id, { kg: v })} />
          <Stepper label="Sets" value={ex.sets} step={1} min={1} max={12} onChange={(v) => patchExercise(day.id, ex.id, { sets: Math.round(v ?? 1) })} />
          <TextField label="Reps" value={ex.reps} placeholder="8-12" onCommit={(v) => patchExercise(day.id, ex.id, { reps: v.trim() })} />
          <TextField label="Note" value={ex.note} onCommit={(v) => patchExercise(day.id, ex.id, { note: v.trim() })} />
        </div>
      )}

      <div class="sets">
        {Array.from({ length: ex.sets }, (_, k) => (
          <SetChip key={k} index={k} rec={row[k] ?? null} timed={timed} locked={!!session && !active} onToggle={() => { unlockAudio(); toggleSet(day.id, ex.id, k) }} onEdit={() => setEditing(k)} />
        ))}
      </div>
      {active && props.index === 0 && doneCount > 0 && <div class="fine hint">Hold a ticked set to change its weight or reps.</div>}

      {raise && (
        <div class="prog">
          <span>All sets done at the top of the rep range. Raise the plan to {+((kg ?? 0) + 2.5).toFixed(2)} kg?</span>
          <div class="sp" />
          <button onClick={() => patchExercise(day.id, ex.id, { kg: +((kg ?? 0) + 2.5).toFixed(2) })}>Raise</button>
        </div>
      )}

      {editing !== null && row[editing] && (
        <SetEditor exName={meta.name} index={editing} rec={row[editing]!} timed={timed} onClose={() => setEditing(null)}
          onSave={(r) => { editSet(ex.id, editing, r); setEditing(null) }}
          onRemove={() => { toggleSet(day.id, ex.id, editing); setEditing(null) }} />
      )}

      {plates && (
        <Sheet title={meta.name} onClose={() => setPlates(false)}>
          <PlateInfo kg={kg} barbell={barbell} equipment={EQUIPMENT_LABEL[meta.equipment]} bar={settings.barKg} settings={settings} />
        </Sheet>
      )}
    </li>
  )
}

function PlateInfo(props: { kg: number | null; barbell: boolean; equipment: string; bar: number; settings: { barKg: number; plates: number[] } }) {
  if (props.kg === null) return <p class="focus">No weight set.</p>
  if (!props.barbell) return <p class="focus">{props.kg} kg · {props.equipment}. The plate calculator is for barbell exercises.</p>
  const r = platesFor(props.kg, props.settings)
  if (!r) return <p class="focus">Less than the bar ({props.bar} kg).</p>
  return (
    <div>
      <p class="focus">Bar {props.bar} kg · {r.perSide} kg on each side</p>
      <div class="plates">
        {r.plates.length === 0 && <span class="focus">Just the bar.</span>}
        {r.plates.map((p, i) => <span key={i} class="plate" style={{ background: plateColor(p) }}>{p}</span>)}
      </div>
      {r.leftover > 0.01 && <p class="focus">Cannot be loaded exactly with your plates: {r.leftover} kg per side left over.</p>}
      <Ramp kg={props.kg} bar={props.bar} />
    </div>
  )
}

/** ±2.5 kg; the first press on an empty weight jumps to the empty bar for barbell lifts. */
function stepKg(kg: number | null, dir: 1 | -1, barbell: boolean, barKg: number): number | null {
  if (kg === null) return dir > 0 ? (barbell ? barKg : 2.5) : null
  return Math.max(0, +(kg + dir * 2.5).toFixed(2))
}

function Ramp(props: { kg: number; bar: number }) {
  const ramp = warmupRamp(props.kg, props.bar)
  if (ramp.length === 0) return null
  return (
    <>
      <h4 class="sub-h">Warm-up ramp</h4>
      <div class="ramp">{ramp.map((r, i) => <span key={i} class="chipbox">{r.kg} kg × {r.reps}</span>)}<span class="chipbox work">{props.kg} kg work sets</span></div>
      <p class="fine">Rest 1–2 minutes between ramp sets. Skip them if you are already warm.</p>
    </>
  )
}

function SetChip(props: { index: number; rec: SetRec | null; timed: boolean; locked: boolean; onToggle: () => void; onEdit: () => void }) {
  const timer = useRef<number | undefined>(undefined)
  const long = useRef(false)
  const { rec } = props
  const cancel = () => window.clearTimeout(timer.current)
  return (
    <button
      class="set"
      disabled={props.locked}
      title={props.locked ? 'A workout is running on another day. Finish it first.' : undefined}
      aria-pressed={!!rec}
      aria-label={rec ? `Set ${props.index + 1} done: ${rec.reps} reps${rec.kg ? ' at ' + rec.kg + ' kg' : ''}. Hold to edit.` : `Set ${props.index + 1}`}
      onPointerDown={() => { long.current = false; if (rec) timer.current = window.setTimeout(() => { long.current = true; props.onEdit() }, 450) }}
      onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      onContextMenu={(e) => { e.preventDefault(); if (rec) props.onEdit() }}
      onClick={() => { if (long.current) { long.current = false; return } props.onToggle() }}
    >{rec ? repsLabel(rec.reps, props.timed) : props.index + 1}</button>
  )
}

function SetEditor(props: { exName: string; index: number; rec: SetRec; timed: boolean; onClose: () => void; onSave: (r: SetRec) => void; onRemove: () => void }) {
  const [kg, setKg] = useState<number | null>(props.rec.kg)
  const [reps, setReps] = useState<number | null>(props.rec.reps)
  return (
    <Sheet title={`${props.exName} · set ${props.index + 1}`} onClose={props.onClose}>
      <Stepper label="Weight" value={kg} step={2.5} unit="kg" onChange={setKg} />
      <Stepper label={props.timed ? 'Seconds' : 'Reps'} value={reps} step={props.timed ? 5 : 1} onChange={setReps} />
      <div class="row">
        <button class="btn ghost" onClick={props.onRemove}>Untick set</button>
        <button class="btn" onClick={() => props.onSave({ kg, reps: reps ?? 0 })}>Save</button>
      </div>
    </Sheet>
  )
}

function plateColor(p: number): string {
  if (p >= 25) return 'var(--red)'
  if (p >= 20) return 'var(--blue)'
  if (p >= 15) return 'var(--yellow)'
  if (p >= 10) return 'var(--green)'
  return 'var(--grey)'
}

function FinishBox(props: { onFinished: (r: FinishResult) => void }) {
  const session = useStore((s) => s.session)
  const now = useTick(!!session)
  if (!session) return null
  const finish = async () => {
    if (sessionDoneSets() === 0 && !(await confirmDialog('No sets are ticked. Finish anyway?', 'Finish'))) return
    const r = finishWorkout()
    if (r) props.onFinished(r)
  }
  return (
    <div class="finish">
      <div class="fin-info"><div class="big">{clock((now - session.startedAt) / 1000)}</div><div class="sub">started {timeShort(session.startedAt)}</div></div>
      <div class="row">
        <button class="btn" onClick={finish}>Finish workout</button>
        <button class="btn ghost small" onClick={async () => { if (await confirmDialog('Discard this workout without saving?', 'Discard')) cancelWorkout() }}>Cancel</button>
      </div>
    </div>
  )
}
