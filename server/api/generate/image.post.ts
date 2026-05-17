import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { openRouterGenerateImage } from '~/server/utils/openrouter-generate-image'

function imageErrorMessage (err: unknown): string {
  const anyErr = err as { data?: { error?: { message?: string } }; message?: string }
  return anyErr?.data?.error?.message ?? anyErr?.message ?? String(err)
}

function imageErrorStatus (err: unknown): number {
  const anyErr = err as { statusCode?: number; status?: number }
  return anyErr?.statusCode ?? anyErr?.status ?? 502
}

function isRetryableImageError (err: unknown): boolean {
  const status = imageErrorStatus(err)
  if (status === 400 || status === 404 || status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true
  }
  const msg = imageErrorMessage(err).toLowerCase()
  return (
    msg.includes('no endpoints found') ||
    msg.includes('model not found') ||
    msg.includes('unsupported model') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('gateway') ||
    msg.includes('temporarily') ||
    msg.includes('rate limit')
  )
}

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
    const requestedModel = typeof modelId === 'string' && modelId.trim() ? modelId : 'flux-klein'
    const candidates = [requestedModel, 'flux-klein', 'flux-pro', 'gemini-flash']
      .map(m => m.trim())
      .filter(Boolean)
      .filter((m, idx, arr) => arr.indexOf(m) === idx)

    let lastErr: unknown = null
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!
      try {
        const { urls, model } = await openRouterGenerateImage({
          prompt,
          modelId: candidate,
          apiKey
        })
        return { urls, model }
      } catch (err: unknown) {
        lastErr = err
        if (!isRetryableImageError(err) || i === candidates.length - 1) {
          break
        }
      }
    }
    throw lastErr
  } catch (err: unknown) {
    const status = imageErrorStatus(err)
    let message = imageErrorMessage(err)
    if (status === 401) {
      message =
        message ||
        'OpenRouter API key is invalid or missing. Check OPENROUTER_API_KEY in .env and restart the dev server.'
    } else if (status === 504 || message.toLowerCase().includes('timeout') || message.toLowerCase().includes('gateway')) {
      message = 'Image provider timed out. Try again or switch to a faster model (Flux Klein / Gemini Flash).'
    } else if (!message) {
      message = 'Image generation failed'
    }
    throw createError({
      statusCode: status === 200 ? 502 : status,
      message
    })
  }
})
