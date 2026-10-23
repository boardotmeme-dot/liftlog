import { describe, expect, it } from 'vitest'
import { catalog, getExercise } from './catalog'
import { templateSlugs } from './data/templates'
import { collections } from './collections'

describe('catalog', () => {
  it('is not empty and has unique slugs', () => {
    expect(catalog.length).toBeGreaterThan(50)
    expect(new Set(catalog.map((e) => e.slug)).size).toBe(catalog.length)
  })
  it('contains every exercise used by the starter templates', () => {
    const missing = templateSlugs().filter((s) => !getExercise(s))
    expect(missing).toEqual([])
  })
  it('has collections that only reference existing exercises', () => {
    expect(collections.length).toBeGreaterThan(3)
    for (const c of collections) for (const x of c.exercises) expect(getExercise(x.slug), `${c.id}: ${x.slug}`).toBeDefined()
  })
  it('has plenty of home-friendly exercises', () => {
    expect(catalog.filter((e) => ['bodyweight', 'dumbbell', 'band', 'kettlebell'].includes(e.equipment)).length).toBeGreaterThan(40)
  })
})
