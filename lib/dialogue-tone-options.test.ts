import { describe, expect, it } from 'vitest'
import { dialogueToneGroups, dialogueToneOptions } from '~/lib/dialogue-tone-options'

describe('dialogue tone options', () => {
  it('keeps unique values that read as a delivery', () => {
    const values = dialogueToneOptions.map((t) => t.value)
    expect(new Set(values).size).toBe(values.length)
    for (const value of values) {
      expect(value).toMatch(/^[a-z]+(?:-[a-z]+)*$/)
    }
  })

  it('includes the human deliveries used in the war-room clips', () => {
    const values = new Set(dialogueToneOptions.map((t) => t.value))
    for (const tone of ['sharp', 'dry', 'clipped', 'measured', 'tense', 'deadpan', 'direct', 'controlled', 'uneasy']) {
      expect(values.has(tone)).toBe(true)
    }
    expect(dialogueToneGroups.map((g) => g.label)).toEqual([
      'How they talk',
      'With an edge',
      'Under pressure',
      'Feeling'
    ])
  })
})
