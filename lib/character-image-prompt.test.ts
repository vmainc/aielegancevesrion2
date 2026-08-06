import { describe, expect, it } from 'vitest'
import {
  buildCharacterImagePrompt,
  finalizeCharacterCreatorPrompt,
  sanitizeCharacterCreatorDescription
} from './character-image-prompt'
import {
  extractVisualBriefFromNarrative,
  isStoryHeavyDescription,
  visualBriefForCharacterCreator
} from './character-visual-description'

describe('sanitizeCharacterCreatorDescription', () => {
  it('strips leap/action beats down to an appearance opening', () => {
    const raw =
      'An energetic golden retriever who playfully leaps over the CAT, seeking attention and validation. The DOG is enthusiastic and proud of its leap, engaging with the CAT in a lighthearted manner.'
    const cleaned = sanitizeCharacterCreatorDescription('DOG', raw)
    expect(cleaned.toLowerCase()).toContain('golden retriever')
    expect(cleaned.toLowerCase()).not.toMatch(/leaps? over/)
    expect(cleaned.toLowerCase()).not.toContain('engaging with')
  })
})

describe('buildCharacterImagePrompt', () => {
  it('requires one isolated subject on solid green/black', () => {
    const prompt = buildCharacterImagePrompt(
      'DOG',
      'An energetic golden retriever who playfully leaps over the CAT.',
      'cinematic'
    )
    expect(prompt).toMatch(/Exactly ONE character/i)
    expect(prompt).toMatch(/chroma-key green|#00FF00/i)
    expect(prompt).toMatch(/Appearance \(look & feel only\)/i)
    expect(prompt.toLowerCase()).not.toMatch(/leaps? over the cat/)
  })
})

describe('finalizeCharacterCreatorPrompt', () => {
  it('appends plate override after bible notes', () => {
    const out = finalizeCharacterCreatorPrompt('base prompt\n\nPRODUCTION BIBLE\nscene park')
    expect(out).toContain('CHARACTER PLATE OVERRIDE:')
    expect(out).toMatch(/ONE subject/i)
  })
})

describe('visualBriefForCharacterCreator', () => {
  it('prefills look-focused text instead of full action role blurbs', () => {
    const brief = visualBriefForCharacterCreator({
      name: 'DOG',
      roleDescription:
        'An energetic golden retriever who playfully leaps over the CAT, seeking attention and validation.'
    })
    expect(brief.toLowerCase()).toContain('golden retriever')
    expect(brief.toLowerCase()).not.toMatch(/leaps? over/)
  })
})

describe('isStoryHeavyDescription / extractVisualBriefFromNarrative', () => {
  it('treats playful leap blurbs as story-heavy when mixed with visuals', () => {
    const raw =
      'An energetic golden retriever who playfully leaps over the CAT, seeking attention and validation.'
    expect(isStoryHeavyDescription(raw)).toBe(true)
    const brief = extractVisualBriefFromNarrative(raw, 'DOG')
    expect(brief.toLowerCase()).toContain('golden retriever')
    expect(brief.toLowerCase()).not.toMatch(/leaps? over/)
  })
})
