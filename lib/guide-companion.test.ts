import { describe, expect, it } from 'vitest'
import { resolveGuideCompanionMode } from '~/lib/guide-companion'

describe('resolveGuideCompanionMode', () => {
  it('hides on marketing and auth routes', () => {
    expect(resolveGuideCompanionMode('/').kind).toBe('hidden')
    expect(resolveGuideCompanionMode('/login').kind).toBe('hidden')
    expect(resolveGuideCompanionMode('/signup').kind).toBe('hidden')
    expect(resolveGuideCompanionMode('/forgot-password').kind).toBe('hidden')
    expect(resolveGuideCompanionMode('/reset-password').kind).toBe('hidden')
  })

  it('hides on full Guide pages', () => {
    expect(resolveGuideCompanionMode('/guide').kind).toBe('hidden')
    expect(resolveGuideCompanionMode('/projects/abcdefghijklmno/guide').kind).toBe('hidden')
  })

  it('uses project mode under a project workspace', () => {
    expect(resolveGuideCompanionMode('/projects/abcdefghijklmno/storyboard')).toEqual({
      kind: 'project',
      projectId: 'abcdefghijklmno'
    })
    expect(resolveGuideCompanionMode('/projects/abcdefghijklmno')).toEqual({
      kind: 'project',
      projectId: 'abcdefghijklmno'
    })
  })

  it('uses studio mode elsewhere when signed-in surfaces apply', () => {
    expect(resolveGuideCompanionMode('/projects').kind).toBe('studio')
    expect(resolveGuideCompanionMode('/tools/video-generation').kind).toBe('studio')
    expect(resolveGuideCompanionMode('/assets').kind).toBe('studio')
    expect(resolveGuideCompanionMode('/account').kind).toBe('studio')
  })
})
