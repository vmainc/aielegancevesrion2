import { describe, expect, it } from 'vitest'
import { buildFullVideoGenerationPrompt } from './shot-character-continuity'
import {
  buildVideoProjectLookHint,
  parseApplyProjectLookQuery,
  projectDirectorHasLookGuidance,
  stripProjectLookBlocksFromVideoPrompt
} from './video-project-look'

describe('video-project-look', () => {
  it('detects director look guidance', () => {
    expect(projectDirectorHasLookGuidance({ lighting_style: 'Hard sidelight' })).toBe(true)
    expect(projectDirectorHasLookGuidance({})).toBe(false)
  })

  it('parses applyProjectLook query', () => {
    expect(parseApplyProjectLookQuery(undefined)).toBe(true)
    expect(parseApplyProjectLookQuery('0')).toBe(false)
    expect(parseApplyProjectLookQuery('false')).toBe(false)
  })

  it('strips cast continuity from motion prompt', () => {
    const raw = 'Slow push in.\n\nCHARACTER CONTINUITY (mandatory — match these designs exactly):'
    expect(stripProjectLookBlocksFromVideoPrompt(raw)).toBe('Slow push in.')
  })

  it('builds hint when project look is on', () => {
    const hint = buildVideoProjectLookHint({
      applyProjectLook: true,
      director: { style: 'High contrast, shadows', lighting_style: 'Pools of darkness' },
      hasStoryboardStartFrame: true
    })
    expect(hint.show).toBe(true)
    expect(hint.title).toMatch(/steering/)
    expect(hint.detail).toMatch(/Director bible/)
  })

  it('buildFullVideoGenerationPrompt omits continuity when applyProjectLook is false', () => {
    const prompt = buildFullVideoGenerationPrompt({
      shot: {
        title: 'Wide',
        description: 'They look at the globe.',
        shotType: 'wide',
        cameraMove: 'static',
        imagePrompt: '',
        videoPrompt: 'Slow drift toward the hologram.'
      },
      cast: [{ id: 'a', name: 'Mara', roleDescription: 'Lead', portraitUrl: null }],
      applyProjectLook: false
    })
    expect(prompt).not.toMatch(/CHARACTER CONTINUITY/)
    expect(prompt).toMatch(/Slow drift/)
  })
})
