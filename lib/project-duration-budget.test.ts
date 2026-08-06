import { describe, expect, it } from 'vitest'
import {
  buildDurationBudgetFromSeconds,
  clampTargetDurationSeconds,
  describeDurationClipPlan
} from './project-duration-budget'

describe('clampTargetDurationSeconds', () => {
  it('allows 5s and 10s micro spots', () => {
    expect(clampTargetDurationSeconds(5)).toBe(5)
    expect(clampTargetDurationSeconds(10)).toBe(10)
    expect(clampTargetDurationSeconds(4)).toBeUndefined()
  })
})

describe('buildDurationBudgetFromSeconds', () => {
  it('maps ~10s to a single 10s clip / one board', () => {
    const b = buildDurationBudgetFromSeconds(10)
    expect(b.maxPanelsTotal).toBe(1)
    expect(b.maxScenesForImport).toBe(1)
    expect(b.clipSeconds).toBe(10)
  })

  it('maps ~5s to a single 5s clip', () => {
    const b = buildDurationBudgetFromSeconds(5)
    expect(b.maxPanelsTotal).toBe(1)
    expect(b.clipSeconds).toBe(5)
  })

  it('maps ~20s to two 10s clips', () => {
    const b = buildDurationBudgetFromSeconds(20)
    expect(b.maxPanelsTotal).toBe(2)
    expect(b.clipSeconds).toBe(10)
    expect(b.maxScenesForImport).toBe(1)
  })
})

describe('describeDurationClipPlan', () => {
  it('explains a single-clip plan in plain language', () => {
    expect(describeDurationClipPlan(10)).toContain('one ~10s video clip')
  })
})
