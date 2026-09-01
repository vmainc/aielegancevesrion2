import { describe, expect, it } from 'vitest'
import { lookbookFaceCropRect } from './faceCropLookbook'

describe('lookbookFaceCropRect', () => {
  it('crops upper-center on tall full-body plates', () => {
    const r = lookbookFaceCropRect(800, 1400)
    expect(r.y).toBeLessThan(140)
    expect(r.h).toBeLessThan(700)
    expect(r.w).toBeLessThan(800)
    expect(r.x + r.w).toBeLessThanOrEqual(800)
    expect(r.y + r.h).toBeLessThanOrEqual(1400)
  })

  it('keeps most of a close-up portrait', () => {
    const r = lookbookFaceCropRect(900, 1000)
    expect(r.h / 1000).toBeGreaterThan(0.6)
    expect(r.w / 900).toBeGreaterThan(0.7)
  })
})
