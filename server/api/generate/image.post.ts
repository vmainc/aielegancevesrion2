import { DEFAULT_IMAGE_MODEL_ID, IMAGE_MODEL_FALLBACK_IDS } from '~/lib/character-creator-models'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { openRouterGenerateImage } from '~/server/utils/openrouter-generate-image'
import { resolveReferenceImageUrlForServerFetch } from '~/server/utils/resolve-pocketbase-proxied-url-for-fetch'
import { stageImageForVideoStartFrame } from '~/server/utils/stage-image-for-video-start-frame'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'

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
  await getPocketBaseUserIdFromRequest(event)

  const body = await readBody(event)
  const { prompt, model: modelId } = body || {}
  const referenceImageUrl =
    typeof body?.referenceImageUrl === 'string'
      ? body.referenceImageUrl.trim()
      : typeof body?.reference_image_url === 'string'
        ? body.reference_image_url.trim()
        : ''
  const referenceImageUrlsRaw = body?.referenceImageUrls ?? body?.reference_image_urls
  const referenceImageUrls: string[] = Array.isArray(referenceImageUrlsRaw)
    ? referenceImageUrlsRaw
        .filter((u): u is string => typeof u === 'string')
        .map(u => u.trim())
        .filter(Boolean)
    : []
  const aspectRatio =
    typeof body?.aspectRatio === 'string'
      ? body.aspectRatio.trim()
      : typeof body?.aspect_ratio === 'string'
        ? body.aspect_ratio.trim()
        : '16:9'
  const purpose =
    body?.purpose === 'video_start_frame' || body?.purpose === 'video_seed'
      ? 'video_start_frame' as const
      : undefined

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
    const requestedModel =
      typeof modelId === 'string' && modelId.trim() ? modelId.trim() : DEFAULT_IMAGE_MODEL_ID
    const candidates = [requestedModel, ...IMAGE_MODEL_FALLBACK_IDS]
      .map(m => m.trim())
      .filter(Boolean)
      .filter((m, idx, arr) => arr.indexOf(m) === idx)

    const internalPb = String(config.pocketbaseInternalUrl || '').trim()
    const publicPb = String(config.public?.pocketbaseUrl || '').trim()
    const fetchOpts = {
      pocketbaseInternalUrl: internalPb,
      publicPocketbaseUrl: publicPb || undefined
    }
    const refCandidates = [
      ...referenceImageUrls,
      ...(referenceImageUrl ? [referenceImageUrl] : [])
    ].filter((u, i, arr) => arr.indexOf(u) === i).slice(0, 4)

    const resolvedRefs: string[] = []
    for (const raw of refCandidates) {
      try {
        const resolved = await resolveReferenceImageUrlForServerFetch(raw, fetchOpts)
        if (resolved) resolvedRefs.push(resolved)
      } catch {
        /* skip */
      }
    }

    let lastErr: unknown = null
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!
      try {
        const { urls, model } = await openRouterGenerateImage({
          prompt,
          modelId: candidate,
          apiKey,
          referenceImageUrl: resolvedRefs[0],
          referenceImageUrls: resolvedRefs.length ? resolvedRefs : undefined,
          aspectRatio,
          purpose
        })
        if (purpose === 'video_start_frame') {
          const staged: string[] = []
          for (const raw of urls) {
            staged.push(await stageImageForVideoStartFrame(raw))
          }
          return { urls: staged, model, videoStartFrame: true }
        }
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
