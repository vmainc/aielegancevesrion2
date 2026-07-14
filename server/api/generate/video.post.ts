import { readBody, setResponseStatus } from 'h3'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { openRouterGenerateVideo } from '~/server/utils/openrouter-generate-video'
import { startOpenRouterVideoJob } from '~/server/utils/openrouter-video-job'
import { resolveReferenceImageUrlForServerFetch } from '~/server/utils/resolve-pocketbase-proxied-url-for-fetch'
import {
  getOpenRouterVideoModelSupportedDurations,
  snapVideoDurationToOpenRouterModel
} from '~/server/utils/openrouter-video-model-durations'
import {
  applyVideoGenerationPromptPolicy,
  resolveVideoGenerationAudioFromBody
} from '~/lib/video-generation-audio-policy'
import { registerVideoGenerationJob } from '~/server/utils/video-generation-job-registry'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'

type Aspect =
  | '16:9'
  | '9:16'
  | '1:1'
  | '4:3'
  | '3:4'
  | '21:9'
  | '9:21'

function clampInt (v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function normalizeAspect (v: unknown): Aspect | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim() as Aspect
  const allowed: Aspect[] = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21']
  return allowed.includes(s) ? s : undefined
}

function normalizeResolution (v: unknown): '480p' | '720p' | '1080p' | '1K' | '2K' | '4K' | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim() as '480p' | '720p' | '1080p' | '1K' | '2K' | '4K'
  const allowed = new Set(['480p', '720p', '1080p', '1K', '2K', '4K'])
  return allowed.has(s) ? s : undefined
}

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody(event).catch(() => ({}))
  const prompt = typeof body?.prompt === 'string' ? body.prompt : ''
  const model = typeof body?.model === 'string' ? body.model : ''

  const aspectRatio = normalizeAspect(body?.aspectRatio ?? body?.aspect_ratio)
  const resolution = normalizeResolution(body?.resolution)
  const durationRaw = clampInt(body?.durationSeconds ?? body?.duration, 5, 1, 60)

  const frameImageUrl =
    typeof body?.frameImageUrl === 'string'
      ? body.frameImageUrl.trim()
      : typeof body?.frame_image_url === 'string'
        ? body.frame_image_url.trim()
        : ''

  const lastFrameImageUrl =
    typeof body?.lastFrameImageUrl === 'string'
      ? body.lastFrameImageUrl.trim()
      : typeof body?.last_frame_image_url === 'string'
        ? body.last_frame_image_url.trim()
        : ''

  /** Blocking mode (holds connection ~minutes) — for local dev only; production uses async + polling. */
  const syncBlocking = body?.sync === true || body?.sync === 'true'

  if (!prompt.trim()) {
    throw createError({ statusCode: 400, message: 'Prompt is required' })
  }
  if (!model.trim()) {
    throw createError({ statusCode: 400, message: 'Model is required' })
  }
  if (frameImageUrl.startsWith('data:')) {
    throw createError({
      statusCode: 400,
      message:
        'Starting frame image is too large to send inline. Remove it and generate or upload the frame again (we compress it automatically).'
    })
  }
  if (lastFrameImageUrl.startsWith('data:')) {
    throw createError({
      statusCode: 400,
      message:
        'Ending frame image is too large to send inline. Remove it and generate or upload the frame again (we compress it automatically).'
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

  const internalPb = String(config.pocketbaseInternalUrl || '').trim()
  const publicPb = String(config.public?.pocketbaseUrl || '').trim()
  const resolveOpts = {
    pocketbaseInternalUrl: internalPb,
    publicPocketbaseUrl: publicPb || undefined
  }
  const resolvedFrame = frameImageUrl
    ? await resolveReferenceImageUrlForServerFetch(frameImageUrl, resolveOpts)
    : ''
  const resolvedLastFrame = lastFrameImageUrl
    ? await resolveReferenceImageUrlForServerFetch(lastFrameImageUrl, resolveOpts)
    : ''

  let supportedDurations: number[] | null = null
  try {
    supportedDurations = await getOpenRouterVideoModelSupportedDurations(model)
  } catch {
    supportedDurations = null
  }
  const durationSeconds = snapVideoDurationToOpenRouterModel(durationRaw, supportedDurations)

  const { includeSpokenDialogue, includeAmbientSound, generateAudio } =
    resolveVideoGenerationAudioFromBody(body as Record<string, unknown>)

  const negativePrompt =
    typeof body?.negativePrompt === 'string'
      ? body.negativePrompt.trim()
      : typeof body?.negative_prompt === 'string'
        ? body.negative_prompt.trim()
        : ''

  const jobArgs = {
    prompt: applyVideoGenerationPromptPolicy(prompt, {
      includeSpokenDialogue,
      includeAmbientSound
    }),
    model,
    apiKey,
    aspectRatio,
    resolution,
    durationSeconds,
    firstFrameImageUrl: resolvedFrame || undefined,
    lastFrameImageUrl: resolvedLastFrame || undefined,
    generateAudio,
    negativePrompt: negativePrompt || undefined
  }

  try {
    if (syncBlocking) {
      const out = await openRouterGenerateVideo(jobArgs)
      return {
        async: false,
        jobId: out.jobId,
        videoUrl: out.videoUrl,
        model: out.model,
        status: out.status
      }
    }

    const started = await startOpenRouterVideoJob(jobArgs)
    if (started.status === 'completed' && started.videoUrl) {
      return {
        async: false,
        jobId: started.jobId,
        videoUrl: started.videoUrl,
        model: started.model,
        status: 'completed'
      }
    }

    registerVideoGenerationJob(started.jobId, {
      pollUrl: started.pollUrl,
      apiKey,
      model: started.model,
      userId
    })

    setResponseStatus(event, 202)
    return {
      async: true,
      jobId: started.jobId,
      status: started.status,
      model: started.model
    }
  } catch (e: unknown) {
    const anyErr = e as { statusCode?: number; message?: string }
    const status = anyErr?.statusCode && Number.isFinite(anyErr.statusCode) ? anyErr.statusCode : 502
    const message = anyErr?.message?.trim() || 'Video generation failed'
    throw createError({ statusCode: status, message })
  }
})
