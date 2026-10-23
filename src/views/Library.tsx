import { useMemo, useState } from 'preact/hooks'
import { EQUIPMENT, EQUIPMENT_LABEL, MUSCLES, MUSCLE_LABEL, filterLibrary, libraryItems } from '../catalog'
import { addCustomExercise, useStore } from '../store'
import { Select, Sheet, TextField, openExercise } from '../ui'
import type { Equipment, Muscle } from '../types'

/** Browsable exercise library. With `onPick`, it works as a picker and shows an "add" action. */
export function Library(props: { onPick?: (key: string) => void }) {
  const custom = useStore((s) => s.custom)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<Muscle | ''>('')
  const [equipment, setEquipment] = useState<Equipment | ''>('')
  const [creating, setCreating] = useState(false)
  const all = useMemo(() => libraryItems(custom), [custom])
  const list = filterLibrary(all, q, group, equipment)

  return (
    <div>
      <input class="search" type="search" placeholder={`Search ${all.length} exercises…`} value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      <div class="filters">
        <select aria-label="Muscle" value={group} onChange={(e) => setGroup(e.currentTarget.value as Muscle | '')}>
          <option value="">All muscles</option>
          {MUSCLES.map((m) => <option value={m} key={m}>{MUSCLE_LABEL[m]}</option>)}
        </select>
        <select aria-label="Equipment" value={equipment} onChange={(e) => setEquipment(e.currentTarget.value as Equipment | '')}>
          <option value="">Any equipment</option>
          {EQUIPMENT.map((m) => <option value={m} key={m}>{EQUIPMENT_LABEL[m]}</option>)}
        </select>
      </div>
      {props.onPick && <button class="libitem" onClick={() => setCreating(true)}><div><b>+ Create your own exercise</b><span>name, muscle, equipment</span></div></button>}
      {list.length === 0 && <div class="empty">Nothing found.</div>}
      {list.map((i) => (
        <div class="libitem" key={i.key}>
          <button class="libmain" onClick={() => openExercise(i.key, props.onPick ? () => props.onPick!(i.key) : undefined)}>
            <b>{i.name}</b>
            <span>{MUSCLE_LABEL[i.group]} · {EQUIPMENT_LABEL[i.equipment]}{i.custom ? ' · custom' : ''}</span>
          </button>
          {props.onPick && <button class="icon add" aria-label={`Add ${i.name}`} onClick={() => props.onPick!(i.key)}>+</button>}
        </div>
      ))}
      {creating && <CreateSheet onClose={() => setCreating(false)} onCreate={(k) => { setCreating(false); props.onPick?.(k) }} />}
    </div>
  )
}

function CreateSheet(props: { onClose: () => void; onCreate: (key: string) => void }) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState<Muscle>('chest')
  const [equipment, setEquipment] = useState<Equipment>('dumbbell')
  const [err, setErr] = useState('')
  return (
    <Sheet title="Your own exercise" onClose={props.onClose}>
      <TextField label="Name" value={name} live onCommit={setName} />
      <Select label="Muscle" value={group} options={MUSCLES.map((m) => [m, MUSCLE_LABEL[m]])} onChange={setGroup} />
      <Select label="Equipment" value={equipment} options={EQUIPMENT.map((m) => [m, EQUIPMENT_LABEL[m]])} onChange={setEquipment} />
      {err && <div class="focus err">{err}</div>}
      <div class="row">
        <button class="btn ghost" onClick={props.onClose}>Cancel</button>
        <button class="btn" onClick={() => {
          if (!name.trim()) return setErr('Enter a name.')
          props.onCreate(addCustomExercise(name, group, equipment))
        }}>Create</button>
      </div>
    </Sheet>
  )
}
