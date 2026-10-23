import { describe, expect, it, vi } from 'vitest'

describe('health cache', () => {
  it('uses a different Today cache key for every account', async () => {
    vi.stubGlobal('navigator', { language: 'en-US', onLine: true })
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
    const { todayCacheKey } = await import('./health')

    expect(todayCacheKey('user-a')).not.toBe(todayCacheKey('user-b'))
    expect(todayCacheKey('user-a')).toBe('liftlog:today:user-a')
    vi.unstubAllGlobals()
  })
})
