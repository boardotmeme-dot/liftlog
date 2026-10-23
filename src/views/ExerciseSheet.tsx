import { EQUIPMENT_LABEL, MUSCLE_LABEL, getFull } from '../catalog'
import { useStore } from '../store'
import { Sheet, closeExercise, useUi } from '../ui'
import { useState } from 'preact/hooks'
import { ExerciseEditor } from './ExerciseEditor'
import { VideoCard } from './Video'

export function ExerciseSheet() {
  const { detail } = useUi()
  const custom = useStore((s) => s.custom)
  const [editing, setEditing] = useState(false)
  if (!detail) return null
  const ex = getFull(detail.key, custom)

  if (!ex) {
    return (
      <Sheet title="Exercise not found" onClose={closeExercise}>
        <p class="focus">This exercise was removed.</p>
      </Sheet>
    )
  }

  const mine = custom.find((c) => 'custom:' + c.id === detail.key)
  if (editing && mine) {
    return <ExerciseEditor initial={mine} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
  }

  const list = (title: string, items: string[], ordered = false) => items.length > 0 && (
    <>
      <h4 class="sub-h">{title}</h4>
      {ordered ? <ol class="steps">{items.map((t) => <li key={t}>{t}</li>)}</ol> : <ul class="steps">{items.map((t) => <li key={t}>{t}</li>)}</ul>}
    </>
  )

  return (
    <Sheet title={ex.name} onClose={closeExercise}>
      <div class="tags">
        <span class="group">{MUSCLE_LABEL[ex.muscle_group]}</span>
        <span class="group">{EQUIPMENT_LABEL[ex.equipment]}</span>
        <span class="group">{ex.mechanic}</span>
        <span class="group">{ex.level}</span>
        {ex.custom && <span class="group">custom</span>}
      </div>
      {ex.summary && <p class="summary">{ex.summary}</p>}
      {ex.secondary.length > 0 && <p class="focus">Also works: {ex.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}</p>}
      {list('Setup', ex.setup, true)}
      {list('How to do it', ex.execution, true)}
      {list('Cues', ex.cues)}
      {list('Common mistakes', ex.mistakes)}

      {ex.references.length > 0 && (
        <>
          <h4 class="sub-h">Watch</h4>
          <div class="refs">{ex.references.map((r) => <VideoCard key={r.url} r={r} />)}</div>
          <p class="fine">Videos are played from their platform and belong to their authors. Tap the title to open the original.</p>
        </>
      )}
      {ex.custom && ex.setup.length + ex.execution.length + ex.references.length === 0 && <p class="focus">No details yet. Tap Edit to add steps, cues and video links.</p>}

      <div class="row">
        {mine && <button class="btn ghost" onClick={() => setEditing(true)}>Edit</button>}
        {detail.onAdd && <button class="btn" onClick={() => { detail.onAdd?.(); closeExercise() }}>Add to this day</button>}
      </div>
    </Sheet>
  )
}
