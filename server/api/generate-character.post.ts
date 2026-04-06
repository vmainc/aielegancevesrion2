import { buildCharacterImagePrompt, isValidStylePreset } from '~/lib/character-image-prompt'
import { CHARACTER_CREATOR_MODEL_IDS } from '~/lib/character-creator-models'
import { openRouterGenerateImage } from '~/server/utils/openrouter-generate-image'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import type { CharacterCreatorImageResult } from '~/types/character-creator'

export default defineEventHandler(async (event): Promise<CharacterCreatorImageResult[]> => {
  const body = await readBody<{
    name?: string
    description?: string
    stylePreset?: string
    models?: string[]
  }>(event)

  const name = typeof body.name === 'string' ? body.name : ''
  const description = typeof body.description === 'string' ? body.description : ''
  const stylePreset = typeof body.stylePreset === 'string' ? body.stylePreset : 'custom'
  const models = Array.isArray(body.models) ? body.models.filter(m => typeof m === 'string') : []

  if (!isValidStylePreset(stylePreset)) {
    throw createError({ statusCode: 400, message: 'Invalid style preset' })
  }
  if (!models.length) {
    throw createError({ statusCode: 400, message: 'Select at least one model' })
  }
  for (const id of models) {
    if (!CHARACTER_CREATOR_MODEL_IDS.has(id)) {
      throw createError({ statusCode: 400, message: `Unknown model: ${id}` })
    }
  }

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env.'
    })
  }

  const prompt_used = buildCharacterImagePrompt(name, description, stylePreset)

  const settled = await Promise.allSettled(
    models.map(async (modelId): Promise<CharacterCreatorImageResult> => {
      try {
        const { urls } = await openRouterGenerateImage({
          prompt: prompt_used,
          modelId,
          apiKey
        })
        const first = urls[0] ?? null
        if (!first) {
          return { model: modelId, image_url: null, prompt_used, error: 'No image returned' }
        }
        return { model: modelId, image_url: first, prompt_used }
      } catch (e: unknown) {
        const msg =
          e && typeof e === 'object' && 'data' in e
            ? String((e as { data?: { message?: string } }).data?.message ?? '')
            : e instanceof Error
              ? e.message
              : 'Generation failed'
        return {
          model: modelId,
          image_url: null,
          prompt_used,
          error: msg.slice(0, 200) || 'Generation failed'
        }
      }
    })
  )

  return settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return {
      model: models[i] ?? 'unknown',
      image_url: null,
      prompt_used,
      error: r.reason?.message ?? 'Generation failed'
    }
  })
})
