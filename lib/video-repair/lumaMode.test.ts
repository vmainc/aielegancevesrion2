import { describe, expect, it } from 'vitest'
import { lumaModeForRepairMode } from './lumaMode'

describe('lumaModeForRepairMode', () => {
  it('maps user strength to Luma families without exposing those names in the UI layer', () => {
    expect(lumaModeForRepairMode('preserve')).toBe('adhere_2')
    expect(lumaModeForRepairMode('balanced')).toBe('flex_2')
    expect(lumaModeForRepairMode('reimagine')).toBe('reimagine_2')
  })
})
