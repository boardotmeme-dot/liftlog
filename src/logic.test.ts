import { describe, expect, it } from 'vitest'
import { buildLog, clock, daysSinceTrained, defaultReps, e1rm, findRecords, mergeLogs, nextDayIndex, normalizeState, platesFor, restFor, hrZone, mergeById, weightChange, liveBody, recovery, vsBaseline, shouldAlertHr, setsByGroup, setsInGroups, isTimed, stalledExercises, topReps, warmupRamp, weekStart, weekStreak, workoutsThisWeek } from './logic'
import { DEFAULT_SETTINGS, type PlanDay, type Session, type WorkoutLog } from './types'

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
  sets: { a: [{ kg: 100, reps: 5 }, { kg: 105, reps: 4 }, null], b: [null, null, null] },
  kg: {}, reps: {}, restEnd: null, restNotified: false, lastActiveAt: 60_000,
}

describe('buildLog', () => {
  it('counts only ticked sets and uses overrides', () => {
    const log = buildLog(day, session, (k) => ({ name: k, group: 'quads', equipment: 'barbell' }), 60_000)
    expect(log.items).toHaveLength(1)
    expect(log.items[0]).toMatchObject({ kg: 105, reps: 4, done: 2 })
    expect(log.items[0].sets).toHaveLength(2)
    expect(log.volume).toBe(100 * 5 + 105 * 4)
    expect(log.durationSec).toBe(60)
  })
})

const mk = (id: string, endedAt: number, updatedAt = endedAt, deletedAt: number | null = null, kg = 50): WorkoutLog => ({
  id, startedAt: endedAt - 1000, endedAt, title: 't', focus: '', durationSec: 1, warmSec: 0, sets: 1, volume: 0, updatedAt, deletedAt,
  items: [{ key: 'x', name: 'X', group: 'chest', equipment: 'barbell', kg, reps: 5, done: 1, planned: 1, sets: [{ kg, reps: 5 }] }],
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
    expect(s?.settings.restSec).toBe(120)
  })

  it('removes executable URLs from imported custom exercises', () => {
    const s = normalizeState({
      plan: [],
      custom: [{
        id: 'custom-1', name: 'Imported', group: 'chest', equipment: 'bodyweight',
        references: [
          { type: 'video', platform: 'youtube', url: 'javascript:alert(1)', title: 'Bad', author: '', checked: '' },
          { type: 'article', platform: 'web', url: 'https://example.com/guide', title: 'Guide', author: 'Example', checked: '2026-10-23', thumbnail: 'data:image/svg+xml,bad', embedUrl: 'javascript:alert(2)' },
        ],
      }],
    })
    expect(s?.custom[0].references).toEqual([{
      type: 'article', platform: 'web', url: 'https://example.com/guide', title: 'Guide', author: 'Example', checked: '2026-10-23', thumbnail: undefined, embedUrl: undefined,
    }])
  })
})

describe('records', () => {
  it('detects a heavier set but not a first result', () => {
    const first = mk('1', 10, 10, null, 60)
    expect(findRecords(first, [])).toEqual([])
    const heavier = mk('2', 20, 20, null, 65)
    expect(findRecords(heavier, [first])).toEqual([{ key: 'x', name: 'X', kind: 'weight', value: 65, previous: 60 }])
    expect(findRecords(mk('3', 30, 30, null, 60), [first])).toEqual([])
  })
  it('estimates one-rep max', () => {
    expect(e1rm(100, 5)).toBe(116.7)
    expect(e1rm(null, 10)).toBe(0)
  })
})

describe('warmupRamp', () => {
  it('ramps up to the work weight', () => {
    expect(warmupRamp(100, 20)).toEqual([{ kg: 20, reps: 8 }, { kg: 50, reps: 5 }, { kg: 70, reps: 3 }, { kg: 85, reps: 1 }])
  })
  it('skips for light weights', () => {
    expect(warmupRamp(25, 20)).toEqual([])
  })
})

describe('rest', () => {
  it('uses a shorter rest for isolation when smart rest is on', () => {
    expect(restFor('isolation', DEFAULT_SETTINGS)).toBe(60)
    expect(restFor('compound', DEFAULT_SETTINGS)).toBe(120)
    expect(restFor('isolation', { ...DEFAULT_SETTINGS, smartRest: false })).toBe(120)
  })
})

describe('weeks and streaks', () => {
  const wed = new Date(2026, 9, 21, 12).getTime() // Wednesday
  it('starts the week on Monday', () => {
    expect(new Date(weekStart(wed)).getDay()).toBe(1)
  })
  it('counts workouts this week and consecutive weeks meeting the goal', () => {
    const day = 86_400_000
    const logs = [mk('a', wed), mk('b', wed - day), mk('c', wed - 7 * day), mk('d', wed - 8 * day), mk('e', wed - 14 * day)]
    expect(workoutsThisWeek(logs, wed)).toBe(2)
    expect(weekStreak(logs, 2, wed)).toBe(2)
    expect(weekStreak(logs, 3, wed)).toBe(0)
  })
})

describe('next day and recovery', () => {
  it('suggests the day after the last workout', () => {
    const plan = [{ id: '1', title: 'A', focus: '', exercises: [] }, { id: '2', title: 'B', focus: '', exercises: [] }]
    expect(nextDayIndex(plan, [])).toBe(0)
    expect(nextDayIndex(plan, [{ ...mk('x', 5), title: 'A' }])).toBe(1)
    expect(nextDayIndex(plan, [{ ...mk('x', 5), title: 'B' }])).toBe(0)
  })
  it('reports days since each muscle was trained', () => {
    const r = daysSinceTrained([mk('x', 10 * 86_400_000)], 13 * 86_400_000)
    expect(r).toEqual([{ group: 'chest', days: 3 }])
  })
})

describe('forgotten workouts', () => {
  it('cuts a workout left open overnight at its last activity', () => {
    const forgotten = { ...session, startedAt: 0, lastActiveAt: 45 * 60_000 }
    const log = buildLog(day, forgotten, (k) => ({ name: k, group: 'quads', equipment: 'barbell' }), 20 * 3_600_000)
    expect(log.durationSec).toBe(45 * 60)
    expect(log.endedAt).toBe(45 * 60_000)
  })
  it('uses the real finish time when recently active', () => {
    const log = buildLog(day, { ...session, startedAt: 0, lastActiveAt: 50 * 60_000 }, (k) => ({ name: k, group: 'quads', equipment: 'barbell' }), 60 * 60_000)
    expect(log.durationSec).toBe(3600)
  })
})

describe('secondary muscles', () => {
  it('counts secondary muscles at half weight', () => {
    const l = mk('1', 100)
    l.items[0] = { ...l.items[0], done: 4, group: 'chest', secondary: ['triceps'] }
    expect(setsInGroups([l], ['chest'], 0)).toBe(4)
    expect(setsInGroups([l], ['triceps'], 0)).toBe(2)
    expect(setsByGroup([l], 0).map((g) => [g.group, g.sets])).toEqual([['chest', 4], ['triceps', 2]])
  })
})

describe('timed sets', () => {
  it('detects hold-based exercises', () => {
    expect(isTimed('30-60 s')).toBe(true)
    expect(isTimed('45 sec')).toBe(true)
    expect(isTimed('8-12')).toBe(false)
    expect(isTimed('to failure')).toBe(false)
  })
})

describe('next day by id', () => {
  it('survives renaming a day', () => {
    const plan = [{ id: '1', title: 'Renamed', focus: '', exercises: [] }, { id: '2', title: 'B', focus: '', exercises: [] }]
    expect(nextDayIndex(plan, [{ ...mk('x', 5), title: 'Old name', dayId: '1' }])).toBe(1)
  })
})

describe('heart-rate zones and alerts', () => {
  it('maps bpm to zones of max heart rate', () => {
    expect(hrZone(100, 190).zone).toBe(1)
    expect(hrZone(125, 190).zone).toBe(2)
    expect(hrZone(145, 190).zone).toBe(3)
    expect(hrZone(160, 190).zone).toBe(4)
    expect(hrZone(175, 190).zone).toBe(5)
    expect(hrZone(0, 190).zone).toBe(0)
  })
  it('alerts once per cooldown and ignores stale readings', () => {
    const now = 1_000_000
    expect(shouldAlertHr(160, 190, 90, 0, now - 10_000, now)).toBe(false) // threshold is 171
    expect(shouldAlertHr(172, 190, 90, 0, now - 10_000, now)).toBe(true)
    expect(shouldAlertHr(172, 190, 90, now - 60_000, now - 10_000, now)).toBe(false) // cooldown
    expect(shouldAlertHr(172, 190, 90, 0, now - 5 * 60_000, now)).toBe(false) // stale
  })
})

describe('recovery score', () => {
  const base = (v: number) => Array.from({ length: 10 }, () => v)
  it('is high when sleep, HRV and resting HR are at or better than baseline', () => {
    const r = recovery(480, [60, ...base(55)], [52, ...base(56)])!
    expect(r.score).toBeGreaterThanOrEqual(90)
    expect(r.label).toBe('Ready to push')
  })
  it('is low after a short night with poor HRV and elevated resting HR', () => {
    const r = recovery(270, [38, ...base(55)], [66, ...base(56)])!
    expect(r.score).toBeLessThan(55)
    expect(r.label).toBe('Take it easy')
  })
  it('works with missing data and returns null with none', () => {
    expect(recovery(420, [], [])!.parts.hrv).toBeNull()
    expect(recovery(null, [], [])).toBeNull()
  })
  it('compares with baseline in percent', () => {
    expect(vsBaseline([110, 100, 100, 100, 100])).toBe(10)
    expect(vsBaseline([1, 2])).toBeNull()
  })
})

describe('body weight', () => {
  const e = (id: string, t: number, kg: number, updatedAt = t, deletedAt: number | null = null) => ({ id, t, kg, updatedAt, deletedAt })
  it('merges entries from two devices and keeps deletions', () => {
    const merged = mergeById([e('a', 1, 90), e('b', 2, 89)], [e('b', 2, 89, 50, 50), e('c', 3, 88)])
    expect(liveBody(merged).map((x) => x.id)).toEqual(['c', 'a'])
  })
  it('computes the change over a month', () => {
    const now = 100 * 86_400_000
    const day = 86_400_000
    expect(weightChange([e('a', now - 20 * day, 91), e('b', now - day, 89.5)], 30, now)).toBe(-1.5)
    expect(weightChange([e('a', now - 90 * day, 95), e('b', now - day, 89.5)], 30, now)).toBeNull()
  })
})
