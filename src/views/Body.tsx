import { useState } from 'preact/hooks'
import { liveBody, weightChange } from '../logic'
import { addWeight, deleteWeight, useStore } from '../store'
import { WeightStepper, confirmDialog, dateShort } from '../ui'
import { fmtWeight, toDisplay } from '../units'
import { HrSpark } from './Health'

/** Body-weight log: add a measurement, see the trend. Optionally mirrored to Google Health (see health.ts). */
export function BodyCard(props: { onAdded?: (id: string, kg: number, t: number) => void }) {
  const body = useStore((s) => s.body)
  const unit = useStore((s) => s.settings.units)
  const entries = liveBody(body)
  const [kg, setKg] = useState<number | null>(entries[0]?.kg ?? null)
  const change = weightChange(body)
  const spark = [...entries].slice(0, 20).reverse().map((e) => toDisplay(e.kg, unit))

  const add = () => {
    if (kg === null || kg <= 0) return
    const t = Date.now()
    const id = addWeight(kg, t)
    props.onAdded?.(id, kg, t)
  }

  return (
    <>
      <h2 class="sec">Body weight</h2>
      <div class="card">
        {entries.length > 0 ? (
          <div class="statrow">
            <span>Latest: <b>{fmtWeight(entries[0].kg, unit)}</b> · {dateShort(entries[0].t)}</span>
            {change !== null && <span>{change > 0 ? '+' : ''}{toDisplay(Math.abs(change), unit) * Math.sign(change)} {unit} / 30 days</span>}
          </div>
        ) : <div class="sub">Log your weight to see the trend next to your training.</div>}
        {spark.length > 1 && <HrSpark points={spark} color="var(--blue)" />}
        <WeightStepper label="Weight" value={kg} unit={unit} onChange={setKg} />
        <button class="btn full" onClick={add} disabled={kg === null}>Add today's weight</button>
        {entries.slice(0, 6).map((e) => (
          <div class="statrow" key={e.id} style={{ marginTop: '8px' }}>
            <span>{dateShort(e.t)}{e.exported ? ' · in Google Health' : ''}</span>
            <span>
              {fmtWeight(e.kg, unit)}{' '}
              <button class="link" onClick={async () => { if (await confirmDialog('Delete this weight entry?', 'Delete')) deleteWeight(e.id) }}>delete</button>
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
