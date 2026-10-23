import { describe, expect, it } from 'vitest'
import { defaultUnit, fmtVolume, fmtWeight, fromDisplay, toDisplay } from './units'
import { platesFor, warmupRamp } from './logic'

describe('units', () => {
  it('round-trips pounds without drift', () => {
    for (const lb of [45, 95, 135, 185, 225, 315, 12.5]) expect(toDisplay(fromDisplay(lb, 'lb'), 'lb')).toBe(lb)
  })
  it('keeps kilograms as they are', () => {
    expect(toDisplay(62.5, 'kg')).toBe(62.5)
    expect(fromDisplay(62.5, 'kg')).toBe(62.5)
  })
  it('formats weights and volume', () => {
    expect(fmtWeight(61.2349, 'lb')).toBe('135 lb')
    expect(fmtWeight(null, 'kg')).toBe('—')
    expect(fmtVolume(0, 'kg')).toBe('—')
    expect(fmtVolume(850, 'kg')).toBe('850 kg')
    expect(fmtVolume(12_340, 'kg')).toBe('12.3 t')
    expect(fmtVolume(1000, 'lb')).toBe('2,205 lb')
  })
  it('picks pounds for US locales only', () => {
    expect(defaultUnit('en-US')).toBe('lb')
    expect(defaultUnit('en-GB')).toBe('kg')
    expect(defaultUnit('uk-UA')).toBe('kg')
    expect(defaultUnit(undefined)).toBe('kg')
  })
  it('loads a 225 lb bar with US plates', () => {
    expect(platesFor(225, { barKg: 45, plates: [45, 35, 25, 10, 5, 2.5] })).toEqual({ perSide: 90, plates: [45, 45], leftover: 0 })
  })
  it('builds a warm-up ramp in 5 lb steps', () => {
    const ramp = warmupRamp(225, 45, 5)
    expect(ramp[0]).toEqual({ kg: 45, reps: 8 })
    expect(ramp.every((r) => (r.kg ?? 0) % 5 === 0)).toBe(true)
    expect(ramp[ramp.length - 1].kg ?? 0).toBeLessThan(225)
  })
})
