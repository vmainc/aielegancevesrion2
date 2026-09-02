import { describe, expect, it } from 'vitest'
import {
  clampPrompt,
  parseModelsConfig,
  resolveMessages,
  sanitizeProviderError
} from './compare'

describe('parseModelsConfig', () => {
  it('falls back to defaults when empty or invalid', () => {
    const empty = parseModelsConfig('')
    expect(empty.length).toBeGreaterThan(0)
    expect(parseModelsConfig('not-json')[0]?.id).toBe(empty[0]?.id)
  })

  it('reads enabled models from JSON and skips disabled', () => {
    const models = parseModelsConfig(JSON.stringify([
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', provider: 'OpenAI' },
      { id: 'skip/me', name: 'Skip', provider: 'X', enabled: false }
    ]))
    expect(models).toEqual([
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', provider: 'OpenAI' }
    ])
  })
})

describe('sanitizeProviderError', () => {
  it('never echoes provider bodies', () => {
    expect(sanitizeProviderError(401, false)).toBe('This model is unavailable right now.')
    expect(sanitizeProviderError(429, false)).toContain('busy')
    expect(sanitizeProviderError(0, true)).toContain('Timed out')
  })
})

describe('resolveMessages', () => {
  it('uses prompt for a fresh comparison', () => {
    expect(resolveMessages({ prompt: 'Hello' })).toEqual([{ role: 'user', content: 'Hello' }])
  })

  it('prefers messages when present (follow-up shape)', () => {
    expect(
      resolveMessages({
        prompt: 'ignored',
        conversationId: 'c1',
        messages: [{ role: 'user', content: 'Follow up' }]
      })
    ).toEqual([{ role: 'user', content: 'Follow up' }])
  })
})

describe('clampPrompt', () => {
  it('trims and caps length', () => {
    expect(clampPrompt('  hi  ', 100)).toBe('hi')
    expect(clampPrompt('abcdef', 3)).toBe('abc')
  })
})
