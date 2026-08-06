import { buildCharacterImagePrompt, finalizeCharacterCreatorPrompt, isValidStylePreset } from '~/lib/character-image-prompt'
import {
  appendProductionBibleToPrompt,
  buildProductionBibleGenerationDebug,
  mergeProductionBibleGenerationOptions
} from '~/lib/production-bible-generation-context'
import { CHARACTER_CREATOR_MODEL_IDS } from '~/lib/character-creator-models'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { openRouterGenerateImage } from '~/server/utils/openrouter-generate-image'
import { resolveProductionBibleForGeneration } from '~/server/utils/resolve-production-bible-for-generation'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import type { CharacterCreatorImageResult } from '~/types/character-creator'

const PB_ID = /^[a-z0-9]{15}$/

export default defineEventHandler(async (event): Promise<CharacterCreatorImageResult[]> => {
  const body = await readBody<{
    name?: string
    description?: string
    stylePreset?: string
    models?: string[]
    projectId?: string
    characterId?: string
    entityIds?: string[]
    sceneId?: string
    shotId?: string
  }>(event)

  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
  const characterId = typeof body.characterId === 'string' ? body.characterId.trim() : ''
  const entityIds = Array.isArray(body.entityIds)
    ? body.entityIds.filter((id): id is string => typeof id === 'string' && PB_ID.test(id.trim()))
    : []
  const sceneId = typeof body.sceneId === 'string' ? body.sceneId.trim() : ''
  const shotId = typeof body.shotId === 'string' ? body.shotId.trim() : ''

  let pb
  if (projectId && PB_ID.test(projectId)) {
    ;({ pb } = await requireProjectOwner(event, projectId))
  } else {
    await getPocketBaseUserIdFromRequest(event)
    pb = await getAuthenticatedPocketBase()
  }

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

  let productionBibleDebug
  let prompt_used = buildCharacterImagePrompt(name, description, stylePreset)

  if (projectId && PB_ID.test(projectId)) {
    const characterIds = characterId && PB_ID.test(characterId) ? [characterId] : undefined
    const { context, failOpenReason } = await resolveProductionBibleForGeneration(pb, projectId, {
      ...mergeProductionBibleGenerationOptions(),
      characterIds,
      entityIds: entityIds.length ? entityIds : undefined,
      sceneId: sceneId || undefined,
      shotId: shotId || undefined
    })
    productionBibleDebug = buildProductionBibleGenerationDebug(context, failOpenReason)
    prompt_used = appendProductionBibleToPrompt(prompt_used, context)
  }

  prompt_used = finalizeCharacterCreatorPrompt(prompt_used)

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

  const results = settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    return {
      model: models[i] ?? 'unknown',
      image_url: null,
      prompt_used,
      error: r.reason?.message ?? 'Generation failed'
    }
  })

  if (productionBibleDebug && results[0]) {
    results[0] = { ...results[0], productionBibleDebug }
  }

  return results
})
