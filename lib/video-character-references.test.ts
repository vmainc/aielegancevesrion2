import { describe, expect, it } from 'vitest'
import { planVideoCharacterReferences } from './video-character-references'

describe('planVideoCharacterReferences', () => {
  it('keeps start and end frames when no character images are selected', () => {
    const plan = planVideoCharacterReferences({
      prompt: 'Push in.',
      model: 'bytedance/seedance-2.5',
      firstFrameUrl: 'https://example.com/start.jpg',
      lastFrameUrl: 'https://example.com/end.jpg'
    })
    expect(plan.mode).toBe('frames')
    if (plan.mode !== 'frames') return
    expect(plan.firstFrameUrl).toBe('https://example.com/start.jpg')
    expect(plan.lastFrameUrl).toBe('https://example.com/end.jpg')
  })

  it('labels the headshot with that character', () => {
    const plan = planVideoCharacterReferences({
      prompt: 'Vandermuth turns.',
      model: 'bytedance/seedance-2.5',
      firstFrameUrl: 'https://example.com/start.jpg',
      characterReferences: [{
        name: 'Vandermuth',
        description: 'VANDERMUTH: clean-shaven, gray work jacket.',
        imageUrl: 'https://example.com/head.jpg'
      }]
    })
    expect(plan.mode).toBe('references')
    if (plan.mode !== 'references') return
    expect(plan.prompt).toContain('VANDERMUTH')
    expect(plan.prompt).toContain('clean-shaven, gray work jacket')
  })

  it('sends headshots with the frames so Seedance does not drop the faces', () => {
    const plan = planVideoCharacterReferences({
      prompt: 'Vandermuth turns.',
      model: 'bytedance/seedance-2.5',
      firstFrameUrl: 'https://example.com/start.jpg',
      lastFrameUrl: 'https://example.com/end.jpg',
      characterReferenceUrls: ['https://example.com/head.jpg']
    })
    expect(plan.mode).toBe('references')
    if (plan.mode !== 'references') return
    expect(plan.referenceUrls).toEqual([
      'https://example.com/start.jpg',
      'https://example.com/end.jpg',
      'https://example.com/head.jpg'
    ])
    expect(plan.prompt).toContain('Image 1 (@image1): opening frame')
    expect(plan.prompt).toContain('Image 3 (@image3): character identity headshot')
    expect(plan.prompt).toContain('Vandermuth turns.')
  })

  it('does not switch other video models off frame mode', () => {
    const plan = planVideoCharacterReferences({
      prompt: 'Hold.',
      model: 'google/veo-3.1',
      firstFrameUrl: 'https://example.com/start.jpg',
      characterReferenceUrls: ['https://example.com/head.jpg']
    })
    expect(plan.mode).toBe('frames')
  })
})
