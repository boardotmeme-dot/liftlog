import { describe, expect, it } from 'vitest'
import { buildLog, clock, defaultReps, mergeLogs, normalizeState, platesFor, stalledExercises, topReps } from './logic'
import type { PlanDay, Session, WorkoutLog } from './types'

const settings = { barKg: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] }

describe('platesFor', () => {
  it('loads one side', () => {
    expect(platesFor(100, settings)).toEqual({ perSide: 40, plates: [25, 15], leftover: 0 })
  })
  it('handles the empty bar', () => {
    expect(platesFor(20, settings)).toEqual({ perSide: 0, plates: [], leftover: 0 })
  })
  it('returns null below the bar', () => {
    expect(platesFor(15, settings)).toBeNull()
  })
  it('reports what cannot be loaded', () => {
    expect(platesFor(21, { barKg: 20, plates: [5] })?.leftover).toBe(0.5)
  })
})

describe('reps parsing', () => {
  it('reads ranges', () => {
    expect(defaultReps('8-12')).toBe(8)
    expect(topReps('8-12')).toBe(12)
    expect(topReps('AMRAP')).toBe(0)
  })
})

describe('clock', () => {
  it('formats', () => {
    expect(clock(65)).toBe('01:05')
    expect(clock(3725)).toBe('1:02:05')
    expect(clock(-3)).toBe('00:00')
  })
})

const day: PlanDay = {
  id: 'd1', title: 'Day 1', focus: '',
  exercises: [
    { id: 'a', key: 'barbell-back-squat', kg: 100, sets: 3, reps: '5', note: '' },
    { id: 'b', key: 'push-up', kg: null, sets: 3, reps: '10', note: '' },
  ],
}
const session: Session = {
  id: 's', dayId: 'd1', startedAt: 0, warmStart: null, warmSec: 0,
  sets: { a: [true, true, false], b: [false, false, false] },
  kg: { a: 105 }, reps: {}, restEnd: null, restNotified: false,
}

describe('buildLog', () => {
  it('counts only ticked sets and uses overrides', () => {
    const log = buildLog(day, session, (k) => ({ name: k, group: 'quads', equipment: 'barbell' }), 60_000)
    expect(log.items).toHaveLength(1)
    expect(log.items[0]).toMatchObject({ kg: 105, reps: 5, done: 2 })
    expect(log.volume).toBe(105 * 5 * 2)
    expect(log.durationSec).toBe(60)
  })
})

const mk = (id: string, endedAt: number, updatedAt = endedAt, deletedAt: number | null = null, kg = 50): WorkoutLog => ({
  id, startedAt: endedAt - 1000, endedAt, title: 't', focus: '', durationSec: 1, warmSec: 0, sets: 1, volume: 0, updatedAt, deletedAt,
  items: [{ key: 'x', name: 'X', group: 'chest', equipment: 'barbell', kg, reps: 5, done: 1, planned: 1 }],
})

describe('mergeLogs', () => {
  it('keeps the newest version and tombstones', () => {
    const merged = mergeLogs([mk('1', 10, 10), mk('2', 20, 20)], [mk('1', 10, 99, 99), mk('3', 30)])
    expect(merged.map((l) => l.id)).toEqual(['3', '2', '1'])
    expect(merged.find((l) => l.id === '1')?.deletedAt).toBe(99)
  })
})

describe('stalledExercises', () => {
  it('flags a lift that has not progressed for weeks', () => {
    const now = 100 * 86_400_000
    const logs = [mk('1', now - 50 * 86_400_000, undefined, null, 60), mk('2', now - 30 * 86_400_000, undefined, null, 60), mk('3', now - 5 * 86_400_000, undefined, null, 60)]
    expect(stalledExercises(logs, now)[0]).toMatchObject({ key: 'x', kg: 60 })
  })
})

describe('normalizeState', () => {
  it('rejects garbage and repairs partial data', () => {
    expect(normalizeState(null)).toBeNull()
    expect(normalizeState({ plan: 'nope' })).toBeNull()
    const s = normalizeState({ plan: [{ title: 'A', exercises: [{ key: 'push-up', sets: 99 }] }] })
    expect(s?.plan[0].exercises[0].sets).toBe(12)
    expect(s?.logs).toEqual([])
    expect(s?.settings.restSec).toBe(90)
  })
})
