import { getExercise, MUSCLE_LABEL, EQUIPMENT_LABEL } from '../catalog'
import { useStore } from '../store'
import { resolveKey } from '../catalog'
import { Sheet, closeExercise, useUi } from '../ui'

const PLATFORM_LABEL = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', web: 'Web' } as const

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
        {ex.references.map((r) => (
          <a class="ref" key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">
            <span class="plat">{PLATFORM_LABEL[r.platform]}</span>
            <span class="rt">{r.title}<small>{r.author}</small></span>
          </a>
        ))}
      </div>
      <p class="fine">Links open the original video on its platform. The authors keep all rights to their content.</p>

      {detail.onAdd && <button class="btn" style={{ marginTop: '12px', width: '100%' }} onClick={() => { detail.onAdd?.(); closeExercise() }}>Add to this day</button>}
    </Sheet>
  )
}
