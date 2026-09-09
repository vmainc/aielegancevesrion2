import { describe, expect, it } from 'vitest'
import { conversationTitleFromQuestion } from './conversation-title'

describe('conversationTitleFromQuestion', () => {
  it('returns a fallback for blank input', () => {
    expect(conversationTitleFromQuestion('   ')).toBe('New conversation')
  })

  it('keeps short questions intact', () => {
    expect(conversationTitleFromQuestion('  How do I import a script?  ')).toBe(
      'How do I import a script?'
    )
  })

  it('truncates long questions around 50–70 characters on a word boundary', () => {
    const q =
      'I want to make a tense nighttime thriller about two detectives who chase a stolen reel of film across the city'
    const title = conversationTitleFromQuestion(q)
    expect(title.length).toBeLessThanOrEqual(70)
    expect(title.length).toBeGreaterThanOrEqual(50)
    expect(q.startsWith(title)).toBe(true)
    expect(title.endsWith(' ')).toBe(false)
  })
})
