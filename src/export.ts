import { useEffect } from 'preact/hooks'
import { exportWorkout, healthEnabled, useHealthStatus } from './health'
import { useCloud } from './cloud'
import { liveLogs, workoutNotes } from './logic'
import { getState, markWorkoutExport, useStore } from './store'
import { fmtWeight } from './units'

const TWO_HOURS = 2 * 3_600_000
const WEEK = 7 * 86_400_000

/** Sends one workout to Google Health and records the outcome on it. Returns an error message or null. */
export async function sendWorkout(logId: string): Promise<string | null> {
  const { logs, settings } = getState()
  const log = logs.find((l) => l.id === logId)
  if (!log) return 'Workout not found.'
  const notes = workoutNotes(log, (kg) => fmtWeight(kg, settings.units))
  const r = await exportWorkout(log, notes)
  if (!r.ok) return r.error
  markWorkoutExport(logId, { status: r.data.status, name: r.data.name, at: Date.now() })
  return null
}

let running = false

/**
 * When "send workouts" is on: after a workout is at least two hours old (so the tracker has had time to sync its own
 * session and we do not duplicate it), send it, unless the tracker recorded it already.
 */
export function useAutoExport(): void {
  const user = useCloud().user
  const status = useHealthStatus(!!user)
  const enabled = useStore((s) => s.settings.exportWorkouts)
  const ready = healthEnabled && enabled && !!status?.connected && !!status.canWrite

  useEffect(() => {
    if (!ready) return
    const run = async () => {
      if (running) return
      running = true
      try {
        const now = Date.now()
        const due = liveLogs(getState().logs)
          .filter((l) => !l.healthExport && now - l.endedAt >= TWO_HOURS && now - l.endedAt <= WEEK && l.sets > 0)
          .slice(0, 3)
        for (const l of due) if (await sendWorkout(l.id)) break
      } finally { running = false }
    }
    void run()
    const vis = () => { if (document.visibilityState === 'visible') void run() }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [ready])
}
