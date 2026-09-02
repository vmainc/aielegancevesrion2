import { describe, expect, it } from 'vitest'
import {
  ALEPH_UNTRUSTED_PIN_MAX_SECONDS,
  alephKeyframePinSeconds,
  buildAlephKeyframeEntries
} from './alephKeyframes'

describe('alephKeyframePinSeconds', () => {
  it('multi-pins a typical 3s trusted clip across the whole duration', () => {
    const pins = alephKeyframePinSeconds(3, { durationTrusted: true })
    expect(pins[0]).toBe(0)
    expect(pins[pins.length - 1]).toBe(2.99)
    expect(pins.length).toBeGreaterThanOrEqual(4)
    expect(pins.every(p => p <= 2.99)).toBe(true)
  })

  it('still multi-pins when duration is untrusted but never past the safe ceiling', () => {
    // Inflated client metadata (5s) must not emit a pin past ~3s.
    const pins = alephKeyframePinSeconds(5, { durationTrusted: false })
    expect(pins[0]).toBe(0)
    expect(pins.length).toBeGreaterThan(1)
    expect(Math.max(...pins)).toBeLessThanOrEqual(ALEPH_UNTRUSTED_PIN_MAX_SECONDS)
  })

  it('uses safe absolute pins when duration is unknown', () => {
    const pins = alephKeyframePinSeconds()
    expect(pins[0]).toBe(0)
    expect(pins.length).toBeGreaterThan(1)
    expect(Math.max(...pins)).toBeLessThanOrEqual(ALEPH_UNTRUSTED_PIN_MAX_SECONDS)
  })
})

describe('buildAlephKeyframeEntries', () => {
  it('reuses one uri at each pin', () => {
    const uri = 'https://example.com/ref.jpg'
    const entries = buildAlephKeyframeEntries(uri, 3, { durationTrusted: true })
    expect(entries.every(e => e.uri === uri)).toBe(true)
    expect(entries.map(e => e.seconds)).toEqual(alephKeyframePinSeconds(3, { durationTrusted: true }))
  })
})
