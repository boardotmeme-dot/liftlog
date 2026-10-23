let ctx: AudioContext | null = null

/** Browsers only allow sound after a tap: call this from a click handler (ticking a set). */
export function unlockAudio(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch { /* no audio */ }
}

/** Three short beeps. Silent if audio was never unlocked. */
export function beep(): void {
  if (!ctx || ctx.state !== 'running') return
  const t0 = ctx.currentTime
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, t0 + i * 0.25)
    g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.25 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.25 + 0.18)
    o.connect(g).connect(ctx.destination)
    o.start(t0 + i * 0.25)
    o.stop(t0 + i * 0.25 + 0.2)
  }
}

type Lock = { release: () => Promise<void> }
let lock: Lock | null = null

/** Keeps the screen on during a workout (where the browser supports it). */
export async function keepAwake(on: boolean): Promise<void> {
  try {
    if (!on) { await lock?.release(); lock = null; return }
    if (lock || document.visibilityState !== 'visible') return
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }).wakeLock
    lock = (await wl?.request('screen')) ?? null
  } catch { lock = null }
}

function tone(freq: number, at: number, len: number, vol = 0.25): void {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, ctx.currentTime + at)
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + at + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + len)
  o.connect(g).connect(ctx.destination)
  o.start(ctx.currentTime + at)
  o.stop(ctx.currentTime + at + len + 0.02)
}

/** Cardio cues: high double beep to start work, low beep to rest, rising triple when done, short tick for the last seconds. */
export function cue(kind: 'work' | 'rest' | 'done' | 'tick'): void {
  if (!ctx || ctx.state !== 'running') return
  if (kind === 'work') { tone(990, 0, 0.14); tone(1320, 0.18, 0.2) }
  else if (kind === 'rest') { tone(520, 0, 0.3) }
  else if (kind === 'done') { tone(660, 0, 0.15); tone(880, 0.2, 0.15); tone(1100, 0.4, 0.3) }
  else tone(760, 0, 0.07, 0.15)
}
