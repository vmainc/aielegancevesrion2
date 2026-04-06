import { resolveOpenRouterImageSlug } from '~/server/utils/openrouter-image-models'

export interface OpenRouterGenerateImageResult {
  urls: string[]
  model: string
}

/**
 * Single image generation via OpenRouter (shared by /api/generate/image and batch routes).
 */
export async function openRouterGenerateImage (options: {
  prompt: string
  modelId: string
  apiKey: string
}): Promise<OpenRouterGenerateImageResult> {
  const prompt = options.prompt.trim().slice(0, 4000)
  if (!prompt) {
    throw createError({ statusCode: 400, message: 'Prompt is required' })
  }

  const openRouterModel = resolveOpenRouterImageSlug(options.modelId)
  const apiKey = options.apiKey.trim()

  const response = await $fetch<{
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; image_url?: { url?: string } }>
        images?: string[]
      }
    }>
  }>('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    timeout: 240000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: {
      model: openRouterModel,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image']
    }
  })

  const message = response?.choices?.[0]?.message
  const urls: string[] = []

  function addUrl (value: unknown) {
    if (typeof value === 'string' && (value.startsWith('data:') || value.startsWith('http'))) {
      urls.push(value)
    }
  }

  if (message?.images?.length) {
    for (const img of message.images) {
      if (typeof img === 'string') addUrl(img)
      else if (img && typeof img === 'object') {
        const u = (img as { image_url?: { url?: string }; imageUrl?: { url?: string } }).image_url?.url ??
          (img as { imageUrl?: { url?: string } }).imageUrl?.url
        addUrl(u)
      }
    }
  }
  if (Array.isArray(message?.content)) {
    for (const part of message.content) {
      if (part?.type === 'image_url') {
        const u = (part as { image_url?: { url?: string }; imageUrl?: { url?: string } }).image_url?.url ??
          (part as { imageUrl?: { url?: string } }).imageUrl?.url
        addUrl(u)
      }
    }
  }
  if (urls.length === 0 && message) {
    function findDataUrls (obj: unknown): void {
      if (typeof obj === 'string' && obj.startsWith('data:image/')) {
        urls.push(obj)
        return
      }
      if (Array.isArray(obj)) obj.forEach(findDataUrls)
      else if (obj && typeof obj === 'object') Object.values(obj).forEach(findDataUrls)
    }
    findDataUrls(message)
  }

  if (urls.length === 0) {
    throw createError({
      statusCode: 502,
      message: 'No image returned from OpenRouter. Try another model or prompt.'
    })
  }

  return { urls, model: options.modelId }
}
