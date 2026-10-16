import { describe, expect, it } from 'vitest'
import {
  findPromptCharacterMentions,
  resolveCharacterMentionPreviewUrl,
  segmentPromptWithCharacterMentions
} from './prompt-character-mentions'

const cast = [
  { id: 'a', name: 'Alex Rivera', portraitUrl: 'https://x/alex.jpg', plateUrls: [] },
  { id: 'd', name: 'Dog', portraitUrl: null, plateUrls: ['https://x/dog.png'] }
]

describe('prompt character mentions', () => {
  it('finds ALL CAPS cast tokens and loose human names', () => {
    const text = 'ALEX RIVERA walks past DOG near the alley.'
    const hits = findPromptCharacterMentions(text, cast)
    expect(hits.map(h => h.characterId)).toEqual(['a', 'd'])
    expect(hits[0].matchedText).toBe('ALEX RIVERA')
    expect(hits[1].matchedText).toBe('DOG')
  })

  it('does not match lowercase species-like names', () => {
    const hits = findPromptCharacterMentions('a dog runs by', cast)
    expect(hits).toHaveLength(0)
  })

  it('segments text around mentions', () => {
    const segs = segmentPromptWithCharacterMentions('Meet ALEX RIVERA today.', cast)
    expect(segs).toEqual([
      { type: 'text', text: 'Meet ' },
      {
        type: 'mention',
        text: 'ALEX RIVERA',
        mention: expect.objectContaining({ characterId: 'a', start: 5, end: 16 })
      },
      { type: 'text', text: ' today.' }
    ])
  })

  it('prefers portrait over plate urls', () => {
    expect(resolveCharacterMentionPreviewUrl(cast[0])).toBe('https://x/alex.jpg')
    expect(resolveCharacterMentionPreviewUrl(cast[1])).toBe('https://x/dog.png')
  })
})
