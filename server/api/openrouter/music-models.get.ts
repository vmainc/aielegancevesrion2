import {
  DEFAULT_MUSIC_MODEL_ID,
  MUSIC_GENERATION_MODELS
} from '~/lib/music-generation-models'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)

  const models = MUSIC_GENERATION_MODELS.map(m => ({
    id: m.id,
    name: m.label,
    description: m.description,
    durationHint: m.durationHint,
    priceHint: m.priceHint
  }))

  if (!apiKey) {
    return {
      source: 'fallback' as const,
      models,
      defaultModelId: DEFAULT_MUSIC_MODEL_ID,
      notice: 'Set OPENROUTER_API_KEY in your environment to generate music with Lyria.'
    }
  }

  return {
    source: 'catalog' as const,
    models,
    defaultModelId: DEFAULT_MUSIC_MODEL_ID
  }
})
