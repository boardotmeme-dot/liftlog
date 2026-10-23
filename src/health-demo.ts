/**
 * Fake tracker data for screenshots and for trying the interface without a Fitbit.
 * Only compiled in when the build sets VITE_HEALTH_DEMO=true; never used in a normal build.
 * All numbers are invented.
 */

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function today() {
  const now = new Date()
  const back = (n: number) => dayKey(new Date(now.getTime() - n * 86_400_000))
  const steps = [8420, 10210, 5630, 9120, 11840, 7450, 6420]
  const kcal = [2480, 2710, 2290, 2560, 2890, 2430, 1620]
  const dist = [6200, 7900, 4100, 6900, 9100, 5600, 4700]
  const azm = [24, 41, 8, 33, 52, 27, 12]
  const rhr = [56, 58, 58, 59, 58, 57, 60, 59, 58, 58, 59, 58, 57, 58]
  const hrv = [72, 64, 66, 61, 63, 65, 62, 60, 66, 64, 63, 62, 65, 61]
  return {
    todayKey: back(0),
    days: steps.map((s, i) => ({ date: back(6 - i), steps: s, kcal: kcal[i], distanceM: dist[i], azm: azm[i] })),
    resting: rhr.map((bpm, i) => ({ date: back(i), bpm })),
    hrv: hrv.map((ms, i) => ({ date: back(i), ms })),
    respiratoryRate: 14.8,
    weight: { kg: 82.4, atMs: now.getTime() - 2 * 86_400_000 },
    sleep: {
      startMs: now.getTime() - 9 * 3_600_000, endMs: now.getTime() - 1.6 * 3_600_000, minutesAsleep: 441, minutesAwake: 32,
      stages: [{ type: 'DEEP', minutes: 78 }, { type: 'REM', minutes: 96 }, { type: 'LIGHT', minutes: 267 }, { type: 'AWAKE', minutes: 32 }],
    },
  }
}

let phase = 0

/** A plausible workout heart-rate curve: warm-up, sets with peaks, rest valleys, cool-down. */
function workoutPoints(): number[] {
  return Array.from({ length: 90 }, (_, i) => {
    const x = i / 89
    const base = 88 + 40 * Math.min(1, x * 5)
    const sets = 22 * Math.abs(Math.sin(x * Math.PI * 7)) * (x < 0.9 ? 1 : 0.2)
    return Math.round(base + sets - 18 * Math.max(0, x - 0.88) * 6)
  })
}

export function demoCall(body: Record<string, unknown>): unknown {
  switch (body.action) {
    case 'status':
      return { configured: true, allowed: true, connected: true, connectedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), expiresAt: null, canWrite: true }
    case 'today':
      return today()
    case 'live': {
      phase += 1
      const bpm = Math.round(132 + 24 * Math.sin(phase / 2.2))
      return { bpm, atMs: Date.now() - 12_000 }
    }
    case 'workout': {
      const points = workoutPoints()
      return {
        heartRate: { avg: 121, max: 162, min: 84, count: 1480, points },
        exercise: { name: 'Strength training', type: 'STRENGTH_TRAINING', avgHr: 121, kcal: 318 },
        latestSampleMs: Date.now(),
      }
    }
    case 'exportWorkout':
    case 'exportWeight':
      return { created: true, name: 'users/demo/dataTypes/exercise/dataPoints/1' }
    case 'deleteExport':
    case 'disconnect':
      return { ok: true }
    case 'connect':
      return { error: 'Demo mode: nothing to connect.' }
    default:
      return {}
  }
}
