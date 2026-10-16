import { describe, expect, it } from 'vitest'
import { resolveCharacterVisualDescription } from './character-visual-description'

describe('signature lines that contradict the bible', () => {
  it('drops facial hair the appearance and never-show lists already ban', () => {
    const line = resolveCharacterVisualDescription({
      name: 'VANDERMUTH',
      appearanceDescription:
        'Clean-shaven: no beard, no mustache, no goatee. Four silver stars on each shoulder.',
      avoidDescription:
        'Goatee, mustache, beard, silver hair combed straight back, long hair',
      signatureDetails: [
        'Silver hair slicked straight back',
        'Silver mustache and goatee',
        'Four silver stars on each shoulder',
        'Dress-blue ribbon rack and command wings',
        'Nameplate on the right chest'
      ].join('\n'),
      portraitUrl: 'https://example.com/head.jpg'
    })
    expect(line).not.toMatch(/Silver mustache/)
    expect(line).not.toMatch(/slicked/i)
    expect(line).toMatch(/no goatee/i)
    expect(line).toMatch(/Four silver stars/)
    expect(line).toMatch(/Nameplate on the right chest/)
    expect(line).toMatch(/Match the attached reference plate/)
  })

  it('keeps clothes out of the face lock when a costume is locked', () => {
    const line = resolveCharacterVisualDescription({
      name: 'Mara',
      appearanceDescription: 'Late 20s, blonde braid. Red silk gown.',
      portraitUrl: 'https://example.com/face.jpg',
      wardrobeLocked: true
    })
    expect(line).toMatch(/Ignore any clothing/)
    expect(line).toMatch(/Do not copy clothes/)
    expect(line).not.toMatch(/and wardrobe/)
  })
})
