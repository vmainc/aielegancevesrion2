import {
  DEFAULT_VOICEOVER_MODEL_ID,
  VOICEOVER_GENERATION_MODELS
} from '~/lib/voiceover-generation-models'

export default defineEventHandler(() => {
  return {
    source: 'curated',
    defaultModelId: DEFAULT_VOICEOVER_MODEL_ID,
    models: VOICEOVER_GENERATION_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      voices: m.voices,
      supportsInstructions: Boolean(m.supportsInstructions),
      supportsSpeed: Boolean(m.supportsSpeed),
      priceHint: m.priceHint
    })),
    notice:
      'Voiceover is spoken dialogue/narration only — use Generate → Music for score and songs.'
  }
})
