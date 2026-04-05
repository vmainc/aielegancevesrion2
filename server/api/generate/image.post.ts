import { resolveOpenRouterApiKey } from '~/server/utils/server-env'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { prompt, model: modelId } = body || {}

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Prompt is required'
    })
  }

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env.'
    })
  }

  // OpenRouter image model IDs (https://openrouter.ai/collections/image-models)
  const openRouterModelMap: Record<string, string> = {
    'flux-klein': 'black-forest-labs/flux.2-klein-4b',
    'flux-pro': 'black-forest-labs/flux.2-pro',
    'flux-max': 'black-forest-labs/flux.2-max',
    'flux-flex': 'black-forest-labs/flux.2-flex',
    'gemini-flash': 'google/gemini-2.5-flash-image',
    'gemini-pro-image': 'google/gemini-3-pro-image-preview',
    'gpt-5-image': 'openai/gpt-5-image',
    'gpt-5-image-mini': 'openai/gpt-5-image-mini'
  }

  const openRouterModel = openRouterModelMap[modelId as keyof typeof openRouterModelMap] ?? openRouterModelMap['flux-klein']

  try {
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
        Authorization: `Bearer ${apiKey.trim()}`
      },
      body: {
        model: openRouterModel,
        messages: [{ role: 'user', content: prompt.trim().slice(0, 4000) }],
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
          const u = (img as any).image_url?.url ?? (img as any).imageUrl?.url
          addUrl(u)
        }
      }
    }
    if (Array.isArray(message?.content)) {
      for (const part of message.content) {
        if (part?.type === 'image_url') {
          const u = (part as any).image_url?.url ?? (part as any).imageUrl?.url
          addUrl(u)
        }
      }
    }
    // Fallback: recursively find any data:image URL in the message
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

    return { urls, model: modelId }
  } catch (err: any) {
    const status = err?.statusCode ?? err?.status ?? 502
    let message = err?.data?.error?.message ?? err?.message ?? String(err)
    if (status === 401) {
      message = message || 'OpenRouter API key is invalid or missing. Check OPENROUTER_API_KEY in .env and restart the dev server.'
    } else if (!message) {
      message = 'Image generation failed'
    }
    throw createError({
      statusCode: status === 200 ? 502 : status,
      message
    })
  }
})
