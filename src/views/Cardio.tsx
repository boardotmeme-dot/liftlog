import { useEffect, useRef, useState } from 'preact/hooks'
import {
  ACTIVITIES, ACTIVITY_KEYS, cardioTotals, KIND_LABEL, LEVEL_LABEL, STYLES, describe, dur, expand, newBlock, newStep, progressAt, runPositionSec, totalSec, type FlatStep,
} from '../cardio'
import { cue, unlockAudio } from '../feedback'
import { clock, hrZone } from '../logic'
import { useLiveHr } from '../live'
import { addCardioDay, cardioSkip, editCardio, finishWorkout, markCued, setCardioResult, setCardioStyle, startWorkout, toggleCardioPause, useStore, type FinishResult } from '../store'
import { Select, Sheet, Stepper, TextField, confirmDialog, useTick } from '../ui'
import { distFromDisplay, distToDisplay, distUnit, fmtDistance, fmtPace } from '../units'
import type { CardioActivity, CardioBlock, CardioStep, PlanDay, StepKind, WorkoutLog } from '../types'

/* ---------- cues (sound + vibration when a step changes), mounted once in the app ---------- */

export function useCardioCues(): void {
  const session = useStore((s) => s.session)
  const plan = useStore((s) => s.plan)
  const sound = useStore((s) => s.settings.sound)
  const vibrate = useStore((s) => s.settings.vibrate)
  const run = session?.cardio
  const now = useTick(!!run && !run.pausedAt)
  const ticked = useRef('')

  useEffect(() => {
    if (!session || !run) return
    const cardio = plan.find((d) => d.id === session.dayId)?.cardio
    if (!cardio) return
    const flat = expand(cardio)
    const p = progressAt(flat, runPositionSec(run, now))
    if (p.index !== run.cued) {
      markCued(p.index)
      if (run.cued === -1 && p.index === 0) return // program just started
      const kind = p.done ? 'done' : flat[p.index].kind === 'work' ? 'work' : 'rest'
      if (sound) cue(kind)
      if (vibrate && 'vibrate' in navigator) navigator.vibrate(kind === 'work' ? [150, 80, 150] : kind === 'done' ? [300, 100, 300, 100, 300] : [250])
      return
    }
    if (!p.done && !run.pausedAt && flat[p.index].sec >= 8 && p.left > 0 && p.left <= 3) {
      const id = `${p.index}:${Math.ceil(p.left)}`
      if (ticked.current !== id) { ticked.current = id; if (sound) cue('tick') }
    }
  }, [now])
}

/* ---------- the day ---------- */

export function CardioDay(props: { day: PlanDay; active: boolean; otherActive: boolean; editMode: boolean; onFinished: (r: FinishResult) => void }) {
  const { day } = props
  const cardio = day.cardio!
  const info = ACTIVITIES[cardio.activity]
  const flat = expand(cardio)
  const unit = useStore((s) => s.settings.units)

  return (
    <div>
      <div class="cdhead">
        <span>{info.icon} <b>{info.label}</b></span>
        <span>{cardio.indoor ? info.indoorLabel : info.outdoorLabel}</span>
        <span>{cardio.style}</span>
        <span><b>{dur(totalSec(flat))}</b> total</span>
        {cardio.targetKm ? <span>goal <b>{fmtDistance(cardio.targetKm, unit)}</b></span> : null}
      </div>

      {props.active ? <Runner day={day} flat={flat} onFinished={props.onFinished} /> : (
        <div class="startbox">
          {props.otherActive
            ? <div class="warmbox"><div class="focus" style={{ margin: 0 }}>A workout is running on another day. Finish it first.</div></div>
            : <button class="btn" onClick={() => { unlockAudio(); startWorkout(day.id) }}>Start {info.label.toLowerCase()}</button>}
        </div>
      )}

      {props.editMode ? <CardioEditor day={day} /> : <ProgramList day={day} flat={flat} active={props.active} />}

      {!props.active && !props.editMode && (
        <details class="card">
          <summary>Warm-up and cool-down ideas</summary>
          <h4 class="sub-h">Warm-up</h4>
          <ul class="tips">{info.warmup.map((t) => <li key={t}>{t}</li>)}</ul>
          <h4 class="sub-h">Cool-down</h4>
          <ul class="tips">{info.cooldown.map((t) => <li key={t}>{t}</li>)}</ul>
        </details>
      )}
    </div>
  )
}

function ProgramList(props: { day: PlanDay; flat: FlatStep[]; active: boolean }) {
  const session = useStore((s) => s.session)
  const run = session?.cardio
  const now = useTick(!!run && !run.pausedAt)
  const cardio = props.day.cardio!
  const idx = props.active && run ? progressAt(props.flat, runPositionSec(run, now)).index : -1
  let at = 0
  return (
    <div class="prog-list">
      {cardio.blocks.map((b) => {
        const first = at
        at += b.steps.length * b.repeat
        const steps = props.flat.slice(first, first + b.steps.length * b.repeat)
        const rows = b.repeat > 1 && props.active ? steps : steps.slice(0, b.steps.length)
        return (
          <div class={b.repeat > 1 ? 'pblock' : ''} key={b.id}>
            {b.repeat > 1 && <div class="rep">× {b.repeat} rounds</div>}
            {rows.map((s) => (
              <div key={s.id + s.round} class={`pstep lv${s.level}` + (props.flat.indexOf(s) === idx ? ' now' : idx > props.flat.indexOf(s) ? ' past' : '')}>
                <span class="k">{KIND_LABEL[s.kind]}</span>
                <span>{s.label}{b.repeat > 1 && props.active ? ` · ${s.round}/${s.rounds}` : ''}</span>
                <span class="d">{dur(s.sec)}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

/* ---------- running ---------- */

function Runner(props: { day: PlanDay; flat: FlatStep[]; onFinished: (r: FinishResult) => void }) {
  const session = useStore((s) => s.session)
  const maxHr = useStore((s) => s.settings.maxHr)
  const run = session?.cardio
  const now = useTick(!!run && !run.pausedAt)
  const { reading } = useLiveHr()
  if (!run) return null
  const { flat } = props
  const pos = runPositionSec(run, now)
  const p = progressAt(flat, pos)
  const paused = run.pausedAt !== null
  const total = totalSec(flat)
  const cur = p.done ? null : flat[p.index]
  const nxt = p.done ? null : flat[p.index + 1] ?? null
  const hrFresh = reading && now - reading.atMs < 180_000
  const z = hrFresh ? hrZone(reading!.bpm, maxHr) : null

  const finish = async () => {
    if (!p.done && !(await confirmDialog('The program is not finished yet. Finish and save what you did?', 'Finish'))) return
    const r = finishWorkout()
    if (r) props.onFinished(r)
  }

  return (
    <div class={'runner' + (cur ? ` lv${cur.level}` : ' lv1') + (paused ? ' paused' : '')} role="timer" aria-live="off">
      {cur ? (
        <>
          <div class="what">{KIND_LABEL[cur.kind]}{cur.rounds > 1 ? ` · round ${cur.round} of ${cur.rounds}` : ''} · {LEVEL_LABEL[cur.level]}</div>
          <div class="label">{cur.label}</div>
          <div class="count">{clock(Math.ceil(p.left))}</div>
          <div class="next">{nxt ? <>Next: <b>{nxt.label}</b> · {dur(nxt.sec)}</> : 'Last step'}</div>
        </>
      ) : (
        <>
          <div class="what">Program complete</div>
          <div class="label">Well done</div>
          <div class="count">{clock(total)}</div>
        </>
      )}
      <div class="bar"><i style={{ width: `${total ? Math.min(100, (pos / total) * 100) : 0}%` }} /></div>
      <div class="barlab"><span>{clock(pos)} elapsed</span><span>{clock(Math.max(0, total - pos))} left</span></div>
      {reading && <div class="hr">♥ <b>{reading.bpm}</b>{z?.label ? <small> {z.label}</small> : <small> not fresh</small>}</div>}
      <div class="ctrls">
        <button class="btn ghost" disabled={p.done} onClick={() => cardioSkip(-1)} aria-label="Previous step or restart this step">⏮</button>
        {!p.done && <button class="btn" onClick={() => { unlockAudio(); toggleCardioPause() }}>{paused ? 'Resume' : 'Pause'}</button>}
        <button class="btn ghost" disabled={p.done} onClick={() => cardioSkip(1)} aria-label="Skip to the next step">⏭</button>
      </div>
      <div class="ctrls">
        <button class={'btn' + (p.done ? '' : ' ghost')} onClick={finish}>Finish</button>
      </div>
    </div>
  )
}

/* ---------- result form (distance, effort) ---------- */

export function CardioResultForm(props: { log: WorkoutLog }) {
  const log = useStore((s) => s.logs.find((l) => l.id === props.log.id)) ?? props.log
  const unit = useStore((s) => s.settings.units)
  const c = log.cardio
  if (!c) return null
  return (
    <div>
      {ACTIVITIES[c.activity].distance && (
        <Stepper label="Distance" unit={distUnit(unit)} step={0.5} min={0} max={1000}
          value={c.km === null ? null : distToDisplay(c.km, unit)}
          onChange={(v) => setCardioResult(log.id, { km: v === null || v <= 0 ? null : distFromDisplay(v, unit) })} />
      )}
      <Stepper label="Effort" unit="/ 10" step={1} min={1} max={10} value={c.rpe} onChange={(v) => setCardioResult(log.id, { rpe: v === null ? null : Math.round(v) })} />
    </div>
  )
}

/* ---------- creating a day ---------- */

export function NewCardioDay(props: { onCreated: (index: number) => void; onClose: () => void }) {
  const [activity, setActivity] = useState<CardioActivity>('jump-rope')
  const [indoor, setIndoor] = useState(false)
  const info = ACTIVITIES[activity]
  const styles = STYLES[activity]
  const sameLabel = info.indoorLabel === info.outdoorLabel
  return (
    <Sheet title="New cardio day" onClose={props.onClose}>
      <div class="acts">
        {ACTIVITY_KEYS.map((a) => (
          <button key={a} class="act" aria-pressed={a === activity} onClick={() => setActivity(a)}>{ACTIVITIES[a].icon} {ACTIVITIES[a].label}</button>
        ))}
      </div>
      {!sameLabel && (
        <div class="acts">
          <button class="act" aria-pressed={!indoor} onClick={() => setIndoor(false)}>{info.outdoorLabel}</button>
          <button class="act" aria-pressed={indoor} onClick={() => setIndoor(true)}>{info.indoorLabel}</button>
        </div>
      )}
      <h4 class="sub-h">Pick a style. You can change every step afterwards.</h4>
      {styles.map((st) => (
        <button key={st.name} class="act" style={{ width: '100%', marginBottom: '8px' }}
          onClick={() => { props.onCreated(addCardioDay(activity, st.name, indoor && !sameLabel, `${info.label}${styles.length > 1 ? ' · ' + st.name : ''}`)); props.onClose() }}>
          {st.name}<small>{st.hint}</small>
        </button>
      ))}
    </Sheet>
  )
}

/* ---------- editing a program ---------- */

function CardioEditor(props: { day: PlanDay }) {
  const { day } = props
  const c = day.cardio!
  const info = ACTIVITIES[c.activity]
  const unit = useStore((s) => s.settings.units)
  const sameLabel = info.indoorLabel === info.outdoorLabel
  const move = (i: number, d: -1 | 1) => editCardio(day.id, (x) => { const j = i + d; if (j >= 0 && j < x.blocks.length) x.blocks.splice(j, 0, x.blocks.splice(i, 1)[0]) })

  return (
    <div class="card">
      <Select label="Activity" value={c.activity} options={ACTIVITY_KEYS.map((a) => [a, ACTIVITIES[a].label] as [CardioActivity, string])}
        onChange={async (a) => {
          if (a === c.activity) return
          if (await confirmDialog('Changing the activity rebuilds the steps from a template.', 'Change')) setCardioStyle(day.id, a, STYLES[a][0].name, false)
        }} />
      {!sameLabel && (
        <Select label="Where" value={c.indoor ? 'in' : 'out'} options={[['out', info.outdoorLabel], ['in', info.indoorLabel]]}
          onChange={(v) => editCardio(day.id, (x) => { x.indoor = v === 'in' })} />
      )}
      <Select label="Template" value={'' as string} options={[['', 'Rebuild from a template…'], ...STYLES[c.activity].map((s) => [s.name, `${s.name} — ${s.hint}`] as [string, string])]}
        onChange={async (name) => {
          if (name && (await confirmDialog(`Replace all steps with “${name}”?`, 'Replace'))) setCardioStyle(day.id, c.activity, name, c.indoor)
        }} />
      {info.distance && (
        <Stepper label="Goal" unit={distUnit(unit)} step={0.5} min={0} value={c.targetKm ? distToDisplay(c.targetKm, unit) : null}
          onChange={(v) => editCardio(day.id, (x) => { x.targetKm = v && v > 0 ? distFromDisplay(v, unit) : undefined })} />
      )}
      <div class="fine">{describe(c)}</div>

      {c.blocks.map((b, i) => (
        <BlockEditor key={b.id} dayId={day.id} block={b} index={i} last={c.blocks.length - 1} activity={c.activity} onMove={move} />
      ))}
      <button class="btn ghost full" onClick={() => editCardio(day.id, (x) => { x.blocks.push(newBlock(x.activity)) })}>+ Add block</button>
    </div>
  )
}

function BlockEditor(props: { dayId: string; block: CardioBlock; index: number; last: number; activity: CardioActivity; onMove: (i: number, d: -1 | 1) => void }) {
  const { dayId, block, index } = props
  const patchBlock = (fn: (b: CardioBlock) => void) => editCardio(dayId, (x) => { const b = x.blocks.find((y) => y.id === block.id); if (b) fn(b) })
  return (
    <div class="pblock" style={{ marginTop: '12px' }}>
      <Stepper label="Repeat" unit="×" step={1} min={1} max={100} value={block.repeat} onChange={(v) => patchBlock((b) => { b.repeat = Math.round(v ?? 1) })} />
      {block.steps.map((s, k) => (
        <StepEditor key={s.id} step={s} onPatch={(fn) => patchBlock((b) => { fn(b.steps[k]) })}
          onRemove={() => patchBlock((b) => { b.steps.splice(k, 1) })} canRemove={block.steps.length > 1} />
      ))}
      <div class="row" style={{ flexWrap: 'wrap' }}>
        {(['work', 'rest', 'warmup', 'cooldown'] as StepKind[]).map((k) => (
          <button key={k} class="btn ghost small" onClick={() => patchBlock((b) => { b.steps.push(newStep(props.activity, k)) })}>+ {KIND_LABEL[k]}</button>
        ))}
      </div>
      <div class="row">
        <button class="link" disabled={index === 0} onClick={() => props.onMove(index, -1)}>Move up</button>
        <button class="link" disabled={index === props.last} onClick={() => props.onMove(index, 1)}>Move down</button>
        <button class="link danger" onClick={() => editCardio(dayId, (x) => { if (x.blocks.length > 1) x.blocks = x.blocks.filter((y) => y.id !== block.id) })}>Remove block</button>
      </div>
    </div>
  )
}

function StepEditor(props: { step: CardioStep; onPatch: (fn: (s: CardioStep) => void) => void; onRemove: () => void; canRemove: boolean }) {
  const { step } = props
  const min = Math.floor(step.sec / 60)
  const sec = step.sec % 60
  return (
    <div class={`pstep lv${step.level}`} style={{ display: 'block' }}>
      <TextField label="Name" value={step.label} onCommit={(v) => props.onPatch((s) => { s.label = v.trim() || KIND_LABEL[s.kind] })} />
      <Select label="Type" value={step.kind} options={(Object.keys(KIND_LABEL) as StepKind[]).map((k) => [k, KIND_LABEL[k]] as [StepKind, string])}
        onChange={(k) => props.onPatch((s) => { s.kind = k })} />
      <Stepper label="Minutes" step={1} min={0} max={360} value={min} onChange={(v) => props.onPatch((s) => { s.sec = Math.max(1, Math.round(v ?? 0) * 60 + (s.sec % 60)) })} />
      <Stepper label="Seconds" step={5} min={0} max={59} value={sec} onChange={(v) => props.onPatch((s) => { s.sec = Math.max(1, Math.floor(s.sec / 60) * 60 + Math.round(v ?? 0)) })} />
      <Select label="Effort" value={String(step.level)} options={([1, 2, 3, 4] as const).map((l) => [String(l), LEVEL_LABEL[l]] as [string, string])}
        onChange={(v) => props.onPatch((s) => { s.level = Number(v) as CardioStep['level'] })} />
      {props.canRemove && <button class="link danger" onClick={props.onRemove}>Remove step</button>}
    </div>
  )
}

/* ---------- stats ---------- */

export function CardioStats(props: { logs: WorkoutLog[] }) {
  const unit = useStore((s) => s.settings.units)
  const rows = cardioTotals(props.logs, Date.now() - 30 * 86_400_000)
  if (rows.length === 0) return null
  return (
    <>
      <h2 class="sec">Cardio, last 30 days</h2>
      <div class="card">
        {rows.map((r) => (
          <div class="statrow" key={r.activity}>
            <span>{ACTIVITIES[r.activity].icon} {ACTIVITIES[r.activity].label} · {r.sessions} session{r.sessions > 1 ? 's' : ''}</span>
            <span>{r.minutes} min{r.km > 0 ? ` · ${fmtDistance(r.km, unit)} · ${fmtPace(r.paceSec, r.paceKm, unit)}` : ''}</span>
          </div>
        ))}
        <div class="sub">Longest: {Math.max(...rows.map((r) => r.longestMin))} min. Distance and pace use the sessions where you entered a distance.</div>
      </div>
    </>
  )
}
