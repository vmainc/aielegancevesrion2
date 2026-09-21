import { describe, expect, it } from 'vitest'
import { filmControlsFromShot, imagePromptFromShot } from '~/lib/shot-to-film-controls'

describe('filmControlsFromShot', () => {
  it('maps wide / low angle shot fields', () => {
    const controls = filmControlsFromShot({
      title: 'Approach',
      description: 'Hero enters',
      shotType: 'wide establishing',
      cameraMove: 'low angle push in'
    })
    expect(controls.shotSize).toBe('Extreme Wide')
    expect(controls.cameraAngle).toBe('Low Angle')
    expect(controls.style).toBe('Film Still')
  })

  it('maps close-up', () => {
    const controls = filmControlsFromShot({
      title: '',
      description: '',
      shotType: 'close-up',
      cameraMove: 'static'
    })
    expect(controls.shotSize).toBe('Close-Up')
  })
})

describe('imagePromptFromShot', () => {
  it('prefers imagePrompt over description', () => {
    expect(
      imagePromptFromShot({
        title: 'T',
        description: 'desc',
        imagePrompt: 'full still prompt',
        shotType: 'medium',
        cameraMove: ''
      })
    ).toBe('full still prompt')
  })

  it('falls back to title + shot type', () => {
    expect(
      imagePromptFromShot({
        title: 'Doorway',
        description: '',
        imagePrompt: '',
        shotType: 'medium',
        cameraMove: 'pan left'
      })
    ).toContain('Doorway')
  })
})
