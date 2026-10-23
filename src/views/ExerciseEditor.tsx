import { useState } from 'preact/hooks'
import { EQUIPMENT, EQUIPMENT_LABEL, MUSCLES, MUSCLE_LABEL } from '../catalog'
import { previewLink } from '../preview'
import { deleteCustomExercise, saveCustomExercise } from '../store'
import { Select, Sheet, Stepper, TextArea, TextField, confirmDialog } from '../ui'
import { VideoCard } from './Video'
import type { CustomExercise, Equipment, Muscle, Reference } from '../types'

const lines = (t: string): string[] => t.split('\n').map((x) => x.trim()).filter(Boolean)

/** Create or edit your own exercise: everything a catalog entry has, including video links with previews. */
export function ExerciseEditor(props: { initial?: CustomExercise; onClose: () => void; onSaved: (key: string) => void }) {
  const i = props.initial
  const [name, setName] = useState(i?.name ?? '')
  const [group, setGroup] = useState<Muscle>(i?.group ?? 'chest')
  const [secondary, setSecondary] = useState<Muscle[]>(i?.secondary ?? [])
  const [equipment, setEquipment] = useState<Equipment>(i?.equipment ?? 'dumbbell')
  const [mechanic, setMechanic] = useState<'compound' | 'isolation'>(i?.mechanic ?? 'compound')
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>(i?.level ?? 'beginner')
  const [summary, setSummary] = useState(i?.summary ?? '')
  const [setup, setSetup] = useState((i?.setup ?? []).join('\n'))
  const [execution, setExecution] = useState((i?.execution ?? []).join('\n'))
  const [cues, setCues] = useState((i?.cues ?? []).join('\n'))
  const [mistakes, setMistakes] = useState((i?.mistakes ?? []).join('\n'))
  const [sets, setSets] = useState<number | null>(i?.defaultSets ?? 3)
  const [reps, setReps] = useState(i?.defaultReps ?? '10')
  const [refs, setRefs] = useState<Reference[]>(i?.references ?? [])
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [linkMsg, setLinkMsg] = useState('')
  const [err, setErr] = useState('')

  const toggle = (m: Muscle) => setSecondary((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))

  const addLink = async () => {
    if (!link.trim() || busy) return
    if (refs.some((r) => r.url === link.trim())) { setLinkMsg('This link is already added.'); return }
    setBusy(true)
    setLinkMsg('')
    const res = await previewLink(link)
    setBusy(false)
    if (!res.ok) { setLinkMsg(res.error); return }
    if (refs.some((r) => r.url === res.ref.url)) { setLinkMsg('This link is already added.'); return }
    setRefs([...refs, res.ref])
    setLink('')
  }

  const save = () => {
    if (!name.trim()) return setErr('Give the exercise a name.')
    const key = saveCustomExercise({
      name, group, equipment, mechanic, level,
      secondary: secondary.filter((m) => m !== group),
      summary: summary.trim(), setup: lines(setup), execution: lines(execution), cues: lines(cues), mistakes: lines(mistakes),
      defaultSets: Math.min(12, Math.max(1, Math.round(sets ?? 3))), defaultReps: reps.trim() || '10', references: refs,
    }, i?.id)
    props.onSaved(key)
  }

  return (
    <Sheet title={i ? 'Edit exercise' : 'New exercise'} onClose={props.onClose}>
      <TextField label="Name" value={name} live placeholder="e.g. Cable woodchopper" onCommit={setName} />
      <Select label="Main muscle" value={group} options={MUSCLES.map((m) => [m, MUSCLE_LABEL[m]])} onChange={setGroup} />
      <div class="field col">
        <label>Also works <small>(counts as half a set in stats)</small></label>
        <div class="chips">
          {MUSCLES.filter((m) => m !== group).map((m) => (
            <button key={m} type="button" class="chip" aria-pressed={secondary.includes(m)} onClick={() => toggle(m)}>{MUSCLE_LABEL[m]}</button>
          ))}
        </div>
      </div>
      <Select label="Equipment" value={equipment} options={EQUIPMENT.map((m) => [m, EQUIPMENT_LABEL[m]])} onChange={setEquipment} />
      <Select label="Type" value={mechanic} options={[['compound', 'Compound (several joints)'], ['isolation', 'Isolation (one joint)']]} onChange={setMechanic} />
      <Select label="Level" value={level} options={[['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']]} onChange={setLevel} />
      <Stepper label="Default sets" value={sets} step={1} min={1} max={12} onChange={setSets} />
      <TextField label="Default reps" value={reps} placeholder="8-12 or 30-60 s" onCommit={setReps} />

      <TextArea label="Description" rows={2} value={summary} placeholder="What it trains and why it is useful." onCommit={setSummary} />
      <TextArea label="Setup" hint="one step per line" rows={3} value={setup} onCommit={setSetup} />
      <TextArea label="How to do it" hint="one step per line" rows={4} value={execution} onCommit={setExecution} />
      <TextArea label="Cues" hint="one per line" rows={2} value={cues} onCommit={setCues} />
      <TextArea label="Common mistakes" hint="one per line" rows={2} value={mistakes} onCommit={setMistakes} />

      <h4 class="sub-h">Video links</h4>
      <p class="fine" style={{ marginTop: 0 }}>Paste a YouTube or TikTok link and the preview, title and author are filled in automatically. Other links are saved as plain links.</p>
      <div class="field">
        <input class="wide" type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={link}
          onInput={(e) => { setLink(e.currentTarget.value); setLinkMsg('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addLink() } }} />
        <button class="btn small" disabled={busy || !link.trim()} onClick={() => void addLink()}>{busy ? '…' : 'Add'}</button>
      </div>
      {linkMsg && <div class="focus err">{linkMsg}</div>}
      {refs.map((r) => (
        <div key={r.url}>
          <VideoCard r={r} onRemove={() => setRefs(refs.filter((x) => x.url !== r.url))} />
          <TextField label="Title" value={r.title} live onCommit={(v) => setRefs((cur) => cur.map((x) => (x.url === r.url ? { ...x, title: v } : x)))} />
        </div>
      ))}

      {err && <div class="focus err">{err}</div>}
      <div class="row">
        <button class="btn ghost" onClick={props.onClose}>Cancel</button>
        <button class="btn" onClick={save}>{i ? 'Save changes' : 'Create exercise'}</button>
      </div>
      {i && (
        <button class="link danger" onClick={async () => {
          if (await confirmDialog(`Delete “${i.name}”? It will be removed from all your plan days. Past workouts keep their records.`, 'Delete')) {
            deleteCustomExercise(i.id)
            props.onClose()
          }
        }}>Delete this exercise</button>
      )}
    </Sheet>
  )
}
