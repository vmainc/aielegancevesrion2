import { readBody, setResponseStatus } from 'h3'
import {
  normalizeVideoModelToOpenRouter,
  shouldRouteSeedance25ViaAtlas,
  snapAtlasSeedanceDuration
} from '~/lib/atlas-cloud-video'
import { shouldRouteSeedance25ViaWaveSpeed } from '~/lib/wavespeed-video'
import {
  resolveAtlasCloudApiKey,
  resolveOpenRouterApiKey,
  resolveWaveSpeedApiKey
} from '~/server/utils/server-env'
import { atlasCloudGenerateVideo, startAtlasCloudVideoJob } from '~/server/utils/atlascloud-video-job'
import { openRouterGenerateVideo } from '~/server/utils/openrouter-generate-video'
import { startOpenRouterVideoJob } from '~/server/utils/openrouter-video-job'
import {
  startWaveSpeedVideoJob,
  waveSpeedGenerateVideo
} from '~/server/utils/wavespeed-video-job'
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
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'
import { getVideoRepairPublicBaseUrl } from '~/server/utils/video-repair-config'
import type { CharacterReferenceImage } from '~/lib/video-character-references'

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
  checkRateLimit(rateLimitKey(userId, 'generate-video'), 8, 60_000)
  const body = await readBody(event).catch(() => ({}))
  const prompt = typeof body?.prompt === 'string' ? body.prompt : ''
  const modelRaw = typeof body?.model === 'string' ? body.model : ''
  // Legacy Atlas Seedance ids → OpenRouter catalog ids.
  const model = normalizeVideoModelToOpenRouter(modelRaw)

  const aspectRatio = normalizeAspect(body?.aspectRatio ?? body?.aspect_ratio)
  let resolution = normalizeResolution(body?.resolution) ?? '720p'
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

  const rawGuideFrames = Array.isArray(body?.guideFrameUrls)
    ? body.guideFrameUrls
    : Array.isArray(body?.inputReferenceImageUrls)
      ? body.inputReferenceImageUrls
      : []
  const guideFrameUrls = rawGuideFrames
    .filter((u: unknown): u is string => typeof u === 'string' && Boolean(u.trim()))
    .map((u: string) => u.trim())
    .slice(0, 4)
  const referenceImageUrlsRaw = body?.referenceImageUrls ?? body?.reference_image_urls
  const referenceImageUrls = (Array.isArray(referenceImageUrlsRaw) ? referenceImageUrlsRaw : [])
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter(Boolean)
    .slice(0, 6)

  const characterReferencesRaw = body?.characterReferences ?? body?.character_references
  const characterReferencesIn: CharacterReferenceImage[] = []
  if (Array.isArray(characterReferencesRaw)) {
    for (const row of characterReferencesRaw) {
      if (!row || typeof row !== 'object') continue
      const rec = row as Record<string, unknown>
      const imageUrl = typeof rec.imageUrl === 'string'
        ? rec.imageUrl.trim()
        : typeof rec.image_url === 'string'
          ? rec.image_url.trim()
          : ''
      if (!imageUrl) continue
      characterReferencesIn.push({
        name: typeof rec.name === 'string' ? rec.name.trim().slice(0, 120) : '',
        description: typeof rec.description === 'string' ? rec.description.trim().slice(0, 1200) : '',
        imageUrl
      })
      if (characterReferencesIn.length >= 6) break
    }
  }

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
  if (guideFrameUrls.some(u => u.startsWith('data:'))) {
    throw createError({
      statusCode: 400,
      message:
        'A timeline guide frame is too large to send inline. Remove it and generate or upload the frame again (we compress it automatically).'
    })
  }
  if (referenceImageUrls.some((u) => u.startsWith('data:'))) {
    throw createError({
      statusCode: 400,
      message: 'A character reference image is too large to send inline. Re-select the cast and try again.'
    })
  }

  const config = useRuntimeConfig()
  const waveSpeedKey = resolveWaveSpeedApiKey(config)
  const atlasKey = resolveAtlasCloudApiKey(config)
  const hdKeyConfigured = Boolean(waveSpeedKey || atlasKey)
  // OpenRouter Seedance 2.5 has no 1080p — without WaveSpeed/Atlas, snap down so the job still runs.
  if (
    !hdKeyConfigured &&
    shouldRouteSeedance25ViaWaveSpeed({
      modelId: model,
      resolution,
      waveSpeedKeyConfigured: true
    })
  ) {
    resolution = '720p'
  }
  // Prefer WaveSpeed (cheaper) for all Seedance 2.x when keyed; Atlas is the 1080p fallback.
  let useWaveSpeed = shouldRouteSeedance25ViaWaveSpeed({
    modelId: model,
    resolution,
    waveSpeedKeyConfigured: Boolean(waveSpeedKey)
  })
  let useAtlas =
    !useWaveSpeed &&
    shouldRouteSeedance25ViaAtlas({
      modelId: model,
      resolution,
      atlasKeyConfigured: Boolean(atlasKey)
    })

  const openRouterKey = resolveOpenRouterApiKey(config)

  if (useWaveSpeed && !waveSpeedKey) {
    throw createError({
      statusCode: 500,
      message: 'WaveSpeed API key not configured. Set WAVESPEED_API_KEY in .env for Seedance 2.5 1080p.'
    })
  }
  if (useAtlas && !atlasKey) {
    throw createError({
      statusCode: 500,
      message: 'Atlas Cloud API key not configured. Set ATLASCLOUD_API_KEY in .env for Seedance 2.5 1080p.'
    })
  }
  if (!useWaveSpeed && !useAtlas && !openRouterKey) {
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
  const resolvedGuideFrames: string[] = []
  for (const url of guideFrameUrls) {
    const resolved = await resolveReferenceImageUrlForServerFetch(url, resolveOpts)
    if (resolved) resolvedGuideFrames.push(resolved)
  }
  const resolvedCharacterRefs: string[] = []
  const resolvedCharacterReferences: CharacterReferenceImage[] = []
  const labeledUrls = new Set(characterReferencesIn.map((c) => c.imageUrl))
  for (const ref of characterReferencesIn) {
    const resolved = await resolveReferenceImageUrlForServerFetch(ref.imageUrl, resolveOpts)
    if (!resolved) continue
    resolvedCharacterReferences.push({ ...ref, imageUrl: resolved })
    resolvedCharacterRefs.push(resolved)
  }
  for (const url of referenceImageUrls) {
    if (labeledUrls.has(url)) continue
    const resolved = await resolveReferenceImageUrlForServerFetch(url, resolveOpts)
    if (resolved && !resolvedCharacterRefs.includes(resolved)) resolvedCharacterRefs.push(resolved)
  }

  let durationSeconds: number
  if (useWaveSpeed || useAtlas) {
    durationSeconds = snapAtlasSeedanceDuration(durationRaw)
  } else {
    let supportedDurations: number[] | null = null
    try {
      supportedDurations = await getOpenRouterVideoModelSupportedDurations(model)
    } catch {
      supportedDurations = null
    }
    durationSeconds = snapVideoDurationToOpenRouterModel(durationRaw, supportedDurations)
  }

  const { includeSpokenDialogue, includeAmbientSound, generateAudio } =
    resolveVideoGenerationAudioFromBody(body as Record<string, unknown>)

  const negativePrompt =
    typeof body?.negativePrompt === 'string'
      ? body.negativePrompt.trim()
      : typeof body?.negative_prompt === 'string'
        ? body.negative_prompt.trim()
        : ''

  const promptForJob = applyVideoGenerationPromptPolicy(prompt, {
    includeSpokenDialogue,
    includeAmbientSound
  })

  try {
    if (useWaveSpeed && waveSpeedKey) {
      // Prefer original client paths for public URL rewriting (staged frames /pb).
      const jobArgs = {
        prompt: promptForJob,
        modelId: model,
        apiKey: waveSpeedKey,
        aspectRatio,
        resolution,
        durationSeconds,
        firstFrameImageUrl: frameImageUrl || resolvedFrame || undefined,
        lastFrameImageUrl: lastFrameImageUrl || resolvedLastFrame || undefined,
        generateAudio,
        characterReferenceImageUrls: referenceImageUrls,
        characterReferences: characterReferencesIn,
        publicPocketbaseUrl: publicPb || undefined,
        sitePublicBaseUrl: getVideoRepairPublicBaseUrl() || undefined
      }
      if (syncBlocking) {
        const out = await waveSpeedGenerateVideo(jobArgs)
        return {
          async: false,
          jobId: out.jobId,
          videoUrl: out.videoUrl,
          model: out.model,
          status: out.status
        }
      }
      const started = await startWaveSpeedVideoJob(jobArgs)
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
        apiKey: waveSpeedKey,
        model: started.model,
        userId,
        provider: 'wavespeed'
      })
      setResponseStatus(event, 202)
      return {
        async: true,
        jobId: started.jobId,
        status: started.status,
        model: started.model
      }
    }

    if (useAtlas && atlasKey) {
      const jobArgs = {
        prompt: promptForJob,
        model,
        apiKey: atlasKey,
        aspectRatio,
        resolution,
        durationSeconds,
        firstFrameImageUrl: resolvedFrame || undefined,
        lastFrameImageUrl: resolvedLastFrame || undefined,
        generateAudio,
        characterReferenceImageUrls: resolvedCharacterRefs,
        characterReferences: resolvedCharacterReferences
      }
      if (syncBlocking) {
        const out = await atlasCloudGenerateVideo(jobArgs)
        return {
          async: false,
          jobId: out.jobId,
          videoUrl: out.videoUrl,
          model: out.model,
          status: out.status
        }
      }
      const started = await startAtlasCloudVideoJob(jobArgs)
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
        apiKey: atlasKey,
        model: started.model,
        userId,
        provider: 'atlascloud'
      })
      setResponseStatus(event, 202)
      return {
        async: true,
        jobId: started.jobId,
        status: started.status,
        model: started.model
      }
    }

    const jobArgs = {
      prompt: promptForJob,
      model,
      apiKey: openRouterKey!,
      aspectRatio,
      resolution,
      durationSeconds,
      firstFrameImageUrl: resolvedFrame || undefined,
      lastFrameImageUrl: resolvedLastFrame || undefined,
      inputReferenceImageUrls: resolvedGuideFrames.length ? resolvedGuideFrames : undefined,
      generateAudio,
      negativePrompt: negativePrompt || undefined,
      characterReferenceImageUrls: resolvedCharacterRefs,
      characterReferences: resolvedCharacterReferences
    }

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
      apiKey: openRouterKey!,
      model: started.model,
      userId,
      provider: 'openrouter'
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
