import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'

/* ---------- tiny global UI state: confirm dialog + exercise detail ---------- */

interface ConfirmState { message: string; yes: string; resolve: (v: boolean) => void }
let confirmState: ConfirmState | null = null
let detail: { key: string; onAdd?: () => void } | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export function useUi(): { confirm: ConfirmState | null; detail: typeof detail } {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((n) => n + 1)
    subs.add(f)
    return () => { subs.delete(f) }
  }, [])
  return { confirm: confirmState, detail }
}

export function confirmDialog(message: string, yes = 'Yes'): Promise<boolean> {
  return new Promise((resolve) => { confirmState = { message, yes, resolve }; emit() })
}
export function answerConfirm(v: boolean): void {
  const c = confirmState
  confirmState = null
  emit()
  c?.resolve(v)
}

export function openExercise(key: string, onAdd?: () => void): void { detail = { key, onAdd }; emit() }
export function closeExercise(): void { detail = null; emit() }

/* ---------- components ---------- */

export function Sheet(props: { title: string; onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props.onClose])
  return (
    <div class="overlay" onClick={(e) => { if (e.target === e.currentTarget) props.onClose() }}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={props.title}>
        <div class="sheet-head">
          <h3>{props.title}</h3>
          <button class="icon" aria-label="Close" onClick={props.onClose}>✕</button>
        </div>
        {props.children}
      </div>
    </div>
  )
}

export function Dialogs() {
  const { confirm } = useUi()
  if (!confirm) return null
  return (
    <Sheet title="Please confirm" onClose={() => answerConfirm(false)}>
      <p class="focus" style={{ margin: '0 0 16px' }}>{confirm.message}</p>
      <div class="row">
        <button class="btn ghost" onClick={() => answerConfirm(false)}>Cancel</button>
        <button class="btn" onClick={() => answerConfirm(true)}>{confirm.yes}</button>
      </div>
    </Sheet>
  )
}

/** Numeric field with − / + buttons. `value` null means empty. */
export function Stepper(props: { label: string; value: number | null; step: number; min?: number; max?: number; unit?: string; onChange: (v: number | null) => void }) {
  const { value, step, min = 0, max = 9999, onChange } = props
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100))
  const [text, setText] = useState(value === null ? '' : String(value))
  useEffect(() => { setText(value === null ? '' : String(value)) }, [value])
  const commit = () => {
    const t = text.trim().replace(',', '.')
    if (t === '') return onChange(null)
    const n = Number(t)
    if (Number.isFinite(n)) onChange(clamp(n)); else setText(value === null ? '' : String(value))
  }
  return (
    <div class="field">
      <label>{props.label}</label>
      <button class="step" aria-label={`Decrease ${props.label}`} onClick={() => onChange(clamp((value ?? 0) - step))}>−</button>
      <input inputMode="decimal" value={text} onInput={(e) => setText(e.currentTarget.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
      <button class="step" aria-label={`Increase ${props.label}`} onClick={() => onChange(clamp((value ?? 0) + step))}>+</button>
      {props.unit && <span class="unit">{props.unit}</span>}
    </div>
  )
}

export function TextField(props: { label: string; value: string; placeholder?: string; type?: string; autocomplete?: string; onCommit: (v: string) => void; live?: boolean }) {
  const [text, setText] = useState(props.value)
  useEffect(() => { setText(props.value) }, [props.value])
  return (
    <div class="field">
      <label>{props.label}</label>
      <input class="wide" type={props.type ?? 'text'} value={text} placeholder={props.placeholder} autocomplete={props.autocomplete}
        onInput={(e) => { setText(e.currentTarget.value); if (props.live) props.onCommit(e.currentTarget.value) }}
        onBlur={() => { if (!props.live) props.onCommit(text) }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !props.live) e.currentTarget.blur() }} />
    </div>
  )
}

export function Select<T extends string>(props: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div class="field">
      <label>{props.label}</label>
      <select class="wide" value={props.value} onChange={(e) => props.onChange(e.currentTarget.value as T)}>
        {props.options.map(([v, l]) => <option value={v} key={v}>{l}</option>)}
      </select>
    </div>
  )
}

/** Re-renders every second while `active`. */
export function useTick(active: boolean): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

export const dateLong = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
export const dateShort = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
export const timeShort = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
