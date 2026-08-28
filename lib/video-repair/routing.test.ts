import { describe, expect, it } from 'vitest'
import { resolveRepairEngine } from './routing'

const config = {
  defaultProvider: 'openrouter' as const,
  defaultModel: 'runway/aleph-2',
  lumaConfigured: true,
  lumaModel: 'ray-2'
}

describe('resolveRepairEngine', () => {
  it('AUTO uses the configured default without category-specific routing yet', () => {
    const face = resolveRepairEngine({
      choice: 'auto',
      categories: ['face_eyes'],
      config
    })
    const env = resolveRepairEngine({
      choice: 'auto',
      categories: ['background'],
      config
    })
    expect(face.provider).toBe('openrouter')
    expect(face.model).toBe('runway/aleph-2')
    expect(env.provider).toBe(face.provider)
    expect(env.model).toBe(face.model)
  })

  it('maps Advanced engine choices without exposing provider jargon to callers', () => {
    expect(
      resolveRepairEngine({ choice: 'luma', categories: ['object_prop'], config }).provider
    ).toBe('luma')
    expect(
      resolveRepairEngine({ choice: 'openrouter', categories: ['hair'], config }).model
    ).toBe('runway/aleph-2')
  })

  it('falls back when Luma is requested but unconfigured', () => {
    const r = resolveRepairEngine({
      choice: 'luma',
      categories: ['lighting_color'],
      config: { ...config, lumaConfigured: false }
    })
    expect(r.provider).toBe('openrouter')
    expect(r.reason).toBe('luma_requested_but_unconfigured')
  })
})
