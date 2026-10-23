import { useMemo, useState } from 'preact/hooks'
import { EQUIPMENT, EQUIPMENT_LABEL, MUSCLES, MUSCLE_LABEL, filterLibrary, getExercise, getFull, libraryItems } from '../catalog'
import { firstThumb } from './Video'
import { collections, type Collection } from '../collections'
import { addDayWithExercises, useStore } from '../store'
import { Sheet, openExercise } from '../ui'
import { ExerciseEditor } from './ExerciseEditor'
import type { Equipment, Muscle } from '../types'

/** Browsable exercise library. With `onPick`, it works as a picker and shows an "add" action. */
const HOME: Equipment[] = ['bodyweight', 'dumbbell', 'kettlebell', 'band']

export function Library(props: { onPick?: (key: string) => void; onDayCreated?: (index: number) => void; initialGroup?: Muscle }) {
  const custom = useStore((s) => s.custom)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<Muscle | ''>(props.initialGroup ?? '')
  const [equipment, setEquipment] = useState<Equipment | ''>('')
  const [creating, setCreating] = useState(false)
  const [home, setHome] = useState(false)
  const [open, setOpen] = useState<Collection | null>(null)
  const all = useMemo(() => libraryItems(custom), [custom])
  const list = filterLibrary(all, q, group, equipment).filter((i) => !home || HOME.includes(i.equipment))

  return (
    <div>
      {!props.onPick && collections.length > 0 && (
        <>
          <h2 class="sec">Top lists</h2>
          <div class="tops">
            {collections.map((c) => (
              <button key={c.id} class="top-card" onClick={() => setOpen(c)}>
                <b>{c.title}</b>
                <span>{c.exercises.length} exercises</span>
                <div class="tagrow">{c.tags.map((t) => <i key={t}>{t}</i>)}</div>
              </button>
            ))}
          </div>
          <h2 class="sec">All exercises</h2>
        </>
      )}
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
      <label class="check"><input type="checkbox" checked={home} onChange={(e) => setHome(e.currentTarget.checked)} /> Home-friendly only (bodyweight, dumbbell, kettlebell, band)</label>
      <button class="libitem create" onClick={() => setCreating(true)}><div><b>+ Create your own exercise</b><span>description, steps, video links with previews</span></div></button>
      {list.length === 0 && <div class="empty">Nothing found.</div>}
      {list.map((i) => (
        <div class="libitem" key={i.key}>
          <span class="lthumb">{(() => { const t = firstThumb(getFull(i.key, custom)); return t ? <img src={t} loading="lazy" referrerPolicy="no-referrer" alt="" /> : null })()}</span>
          <button class="libmain" onClick={() => openExercise(i.key, props.onPick ? () => props.onPick!(i.key) : undefined)}>
            <b>{i.name}</b>
            <span>{MUSCLE_LABEL[i.group]} · {EQUIPMENT_LABEL[i.equipment]}{i.custom ? ' · custom' : ''}</span>
          </button>
          {props.onPick && <button class="icon add" aria-label={`Add ${i.name}`} onClick={() => props.onPick!(i.key)}>+</button>}
        </div>
      ))}
      {open && <CollectionSheet c={open} onClose={() => setOpen(null)} onCreate={(index) => { setOpen(null); props.onDayCreated?.(index) }} />}
      {creating && <ExerciseEditor onClose={() => setCreating(false)} onSaved={(k) => { setCreating(false); props.onPick?.(k) }} />}
    </div>
  )
}

function CollectionSheet(props: { c: Collection; onClose: () => void; onCreate: (dayIndex: number) => void }) {
  const { c } = props
  return (
    <Sheet title={c.title} onClose={props.onClose}>
      <p class="summary">{c.description}</p>
      <ol class="toplist">
        {c.exercises.map((x, i) => {
          const ex = getExercise(x.slug)
          const t = firstThumb(ex)
          return (
            <li key={x.slug}>
              <button class="toprow" onClick={() => openExercise(x.slug)}>
                <span class="rank">{i + 1}</span>
                <span class="lthumb">{t ? <img src={t} loading="lazy" referrerPolicy="no-referrer" alt="" /> : null}</span>
                <span class="tb"><b>{ex?.name ?? x.slug}</b><span>{x.why}</span></span>
              </button>
            </li>
          )
        })}
      </ol>
      <button class="btn full" onClick={() => props.onCreate(addDayWithExercises(c.title, c.exercises.map((x) => x.slug)))}>Create a workout day from this list</button>
    </Sheet>
  )
}
