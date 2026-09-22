import { describe, expect, it } from 'vitest'
import {
  buildVoiceoverSpeechInput,
  defaultVoiceForModel,
  DEFAULT_VOICEOVER_MODEL_ID,
  getVoiceoverModel,
  isVoiceoverModelId
} from '~/lib/voiceover-generation-models'

describe('voiceover generation models', () => {
  it('has a default model with at least one voice', () => {
    expect(isVoiceoverModelId(DEFAULT_VOICEOVER_MODEL_ID)).toBe(true)
    const m = getVoiceoverModel(DEFAULT_VOICEOVER_MODEL_ID)
    expect(m?.voices.length).toBeGreaterThan(0)
    expect(defaultVoiceForModel(DEFAULT_VOICEOVER_MODEL_ID)).toBeTruthy()
  })

  it('trims spoken script and never invents lyrics', () => {
    expect(buildVoiceoverSpeechInput('  Hello world.  ')).toBe('Hello world.')
    expect(buildVoiceoverSpeechInput('')).toBe('')
  })
})
