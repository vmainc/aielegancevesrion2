import { describe, expect, it } from 'vitest'
import { openRouterImageModalities, resolveOpenRouterImageSlug } from '~/server/utils/openrouter-image-models'

describe('openRouterImageModalities', () => {
  it('requests image+text for OpenAI GPT image models', () => {
    expect(openRouterImageModalities('openai/gpt-5-image')).toEqual(['image', 'text'])
    expect(openRouterImageModalities('openai/gpt-5-image-mini')).toEqual(['image', 'text'])
    expect(openRouterImageModalities(resolveOpenRouterImageSlug('dalle-3'))).toEqual(['image', 'text'])
  })

  it('requests image+text for Gemini image models', () => {
    expect(openRouterImageModalities('google/gemini-2.5-flash-image')).toEqual(['image', 'text'])
  })

  it('requests image-only for Flux', () => {
    expect(openRouterImageModalities('black-forest-labs/flux.2-klein-4b')).toEqual(['image'])
  })
})
