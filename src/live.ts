import { useEffect, useState } from 'preact/hooks'
import { call, healthEnabled } from './health'
import { shouldAlertHr } from './logic'
import { beep } from './feedback'
import { getState } from './store'

export interface LiveReading { bpm: number; atMs: number; fetchedAt: number }

let reading: LiveReading | null = null
let alertMessage: { text: string; at: number } | null = null
let lastAlertAt = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export function useLiveHr(): { reading: LiveReading | null; alert: string | null } {
  const [, force] = useState(0)
  useEffect(() => {
    const f = () => force((n) => n + 1)
    subs.add(f)
    return () => { subs.delete(f) }
  }, [])
  const alert = alertMessage && Date.now() - alertMessage.at < 20_000 ? alertMessage.text : null
  return { reading, alert }
}

async function poll(): Promise<void> {
  const r = await call<{ bpm: number | null; atMs: number | null }>({ action: 'live' })
  if (!r.ok || r.data.bpm === null || r.data.atMs === null) return
  reading = { bpm: r.data.bpm, atMs: r.data.atMs, fetchedAt: Date.now() }
  const { settings } = getState()
  if (settings.hrAlert && shouldAlertHr(reading.bpm, settings.maxHr, settings.hrAlertPct, lastAlertAt, reading.atMs)) {
    lastAlertAt = Date.now()
    alertMessage = { text: `Heart rate ${reading.bpm} bpm: ${Math.round((reading.bpm / settings.maxHr) * 100)}% of your max. Ease off or rest.`, at: lastAlertAt }
    if (settings.vibrate && 'vibrate' in navigator) navigator.vibrate([300, 150, 300, 150, 300])
    if (settings.sound) beep()
    setTimeout(emit, 20_500) // hide the banner
  }
  emit()
}

/** Polls the latest heart rate every ~20 s while a workout is running. Mount once, near the top of the app. */
export function useLiveHrPoller(active: boolean, connected: boolean): void {
  useEffect(() => {
    if (!healthEnabled || !active || !connected) { reading = null; emit(); return }
    let stop = false
    const tick = () => { if (!stop && document.visibilityState === 'visible') void poll() }
    tick()
    const id = setInterval(tick, 20_000)
    const vis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', vis)
    return () => { stop = true; clearInterval(id); document.removeEventListener('visibilitychange', vis) }
  }, [active, connected])
}
