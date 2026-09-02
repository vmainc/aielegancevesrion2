import { describe, expect, it } from 'vitest'
import { allowRequest } from '../server/utils/compare-rate-limit'

describe('allowRequest', () => {
  it('allows up to max then blocks inside the window', () => {
    const key = `t-${Date.now()}-${Math.random()}`
    expect(allowRequest(key, 2, 60_000)).toBe(true)
    expect(allowRequest(key, 2, 60_000)).toBe(true)
    expect(allowRequest(key, 2, 60_000)).toBe(false)
  })
})
