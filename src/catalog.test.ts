import { describe, expect, it } from 'vitest'
import { catalog, getExercise } from './catalog'
import { templateSlugs } from './data/templates'

describe('catalog', () => {
  it('is not empty and has unique slugs', () => {
    expect(catalog.length).toBeGreaterThan(50)
    expect(new Set(catalog.map((e) => e.slug)).size).toBe(catalog.length)
  })
  it('contains every exercise used by the starter templates', () => {
    const missing = templateSlugs().filter((s) => !getExercise(s))
    expect(missing).toEqual([])
  })
})
