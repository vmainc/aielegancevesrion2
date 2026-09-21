import { getImageModels } from '~/server/utils/openrouter-images-models'
import { formatImageModelPrice } from '~/lib/normalize-image-model'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'

/**
 * Live OpenRouter image model catalog (Images API).
 * GET https://openrouter.ai/api/v1/images/models — cached server-side ~45 minutes.
 * Backward compatible: still returns { id, name, description, provider, defaultModelId }.
 */
export default defineEventHandler(async () => {
  const apiKey = resolveOpenRouterApiKey(useRuntimeConfig())
  const result = await getImageModels({ apiKey })

  return {
    source: result.source,
    defaultModelId: result.defaultModelId,
    notice: result.notice,
    cachedAt: result.cachedAt,
    models: result.models.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      provider: m.provider,
      pricing: m.pricing,
      priceLabel: formatImageModelPrice(m),
      aspectRatios: m.aspectRatios,
      resolutions: m.resolutions,
      maxImages: m.maxImages,
      supportsReferences: m.supportsReferences,
      supportsEditing: m.supportsEditing,
      badges: m.badges,
      supportedParameterKeys: m.supportedParameterKeys,
      supportedParameters: m.supportedParameters
    }))
  }
})
