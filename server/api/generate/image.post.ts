import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { openRouterGenerateImage } from '~/server/utils/openrouter-generate-image'

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

  try {
    const { urls, model } = await openRouterGenerateImage({
      prompt,
      modelId: typeof modelId === 'string' ? modelId : 'flux-klein',
      apiKey
    })
    return { urls, model }
  } catch (err: unknown) {
    const anyErr = err as { statusCode?: number; status?: number; data?: { error?: { message?: string } }; message?: string }
    const status = anyErr?.statusCode ?? anyErr?.status ?? 502
    let message =
      anyErr?.data?.error?.message ?? anyErr?.message ?? String(err)
    if (status === 401) {
      message =
        message ||
        'OpenRouter API key is invalid or missing. Check OPENROUTER_API_KEY in .env and restart the dev server.'
    } else if (!message) {
      message = 'Image generation failed'
    }
    throw createError({
      statusCode: status === 200 ? 502 : status,
      message
    })
  }
})
