import {
  openRouterImageAspectRatio,
  SINGLE_STORYBOARD_FRAME_DIRECTIVE
} from '~/lib/storyboard-frame-image'
import { resolveOpenRouterImageSlug } from '~/server/utils/openrouter-image-models'
import { fetchReferenceImageAsDataUrl } from '~/server/utils/reference-image-data-url'

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
  /** Featured character portrait — image-to-image style guidance when the model supports vision input. */
  referenceImageUrl?: string
  aspectRatio?: string
}): Promise<OpenRouterGenerateImageResult> {
  const aspect = openRouterImageAspectRatio(options.aspectRatio)
  const aspectHint =
    aspect === '9:16'
      ? 'Output one 9:16 vertical frame.'
      : aspect === '1:1'
        ? 'Output one 1:1 square frame.'
        : 'Output one 16:9 landscape frame.'
  const prompt = [
    SINGLE_STORYBOARD_FRAME_DIRECTIVE,
    aspectHint,
    options.prompt.trim()
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000)
  if (!prompt) {
    throw createError({ statusCode: 400, message: 'Prompt is required' })
  }

  const openRouterModel = resolveOpenRouterImageSlug(options.modelId)
  const apiKey = options.apiKey.trim()

  let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = prompt
  const refUrl = (options.referenceImageUrl || '').trim()
  if (refUrl) {
    try {
      const dataUrl = await fetchReferenceImageAsDataUrl(refUrl, 4_000_000)
      userContent = [
        {
          type: 'text',
          text:
            `${prompt}\n\nUse the attached reference image as the exact character design (face, proportions, materials, colors). Match it closely; do not redesign the character.`
        },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    } catch {
      userContent = `${prompt}\n\n(Match the established character design from the project cast bible.)`
    }
  }

  const response = await $fetch<{
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; image_url?: { url?: string } }>
        images?: string[]
      }
    }>
  }>('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    // Keep below common proxy/gateway limits so clients get a clear API error instead of 504.
    timeout: 45000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: {
      model: openRouterModel,
      messages: [{ role: 'user', content: userContent }],
      modalities: ['image'],
      image_config: {
        aspect_ratio: aspect
      }
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
