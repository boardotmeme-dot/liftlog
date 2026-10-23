import { getExercise, MUSCLE_LABEL, EQUIPMENT_LABEL } from '../catalog'
import { useStore } from '../store'
import { resolveKey } from '../catalog'
import { Sheet, closeExercise, useUi } from '../ui'
import { VideoCard } from './Video'

export function ExerciseSheet() {
  const { detail } = useUi()
  const custom = useStore((s) => s.custom)
  if (!detail) return null
  const ex = getExercise(detail.key)

  if (!ex) {
    const r = resolveKey(detail.key, custom)
    return (
      <Sheet title={r.name} onClose={closeExercise}>
        <p class="focus">Custom exercise · {MUSCLE_LABEL[r.group]} · {EQUIPMENT_LABEL[r.equipment]}</p>
        <p class="focus">No instructions for custom exercises. Add a reference by sending a pull request to the catalog.</p>
        {detail.onAdd && <button class="btn" onClick={() => { detail.onAdd?.(); closeExercise() }}>Add to this day</button>}
      </Sheet>
    )
  }

  return (
    <Sheet title={ex.name} onClose={closeExercise}>
      <div class="tags">
        <span class="group">{MUSCLE_LABEL[ex.muscle_group]}</span>
        <span class="group">{EQUIPMENT_LABEL[ex.equipment]}</span>
        <span class="group">{ex.mechanic}</span>
        <span class="group">{ex.level}</span>
      </div>
      <p class="summary">{ex.summary}</p>
      {ex.secondary.length > 0 && <p class="focus">Also works: {ex.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}</p>}

      <h4 class="sub-h">Setup</h4>
      <ol class="steps">{ex.setup.map((t) => <li key={t}>{t}</li>)}</ol>
      <h4 class="sub-h">How to do it</h4>
      <ol class="steps">{ex.execution.map((t) => <li key={t}>{t}</li>)}</ol>
      <h4 class="sub-h">Cues</h4>
      <ul class="steps">{ex.cues.map((t) => <li key={t}>{t}</li>)}</ul>
      <h4 class="sub-h">Common mistakes</h4>
      <ul class="steps">{ex.mistakes.map((t) => <li key={t}>{t}</li>)}</ul>

      <h4 class="sub-h">Watch</h4>
      <div class="refs">
        {ex.references.map((r) => <VideoCard key={r.url} r={r} />)}
      </div>
      <p class="fine">Videos are played from YouTube and belong to their authors. Tap the title to open the original.</p>

      {detail.onAdd && <button class="btn" style={{ marginTop: '12px', width: '100%' }} onClick={() => { detail.onAdd?.(); closeExercise() }}>Add to this day</button>}
    </Sheet>
  )
}
