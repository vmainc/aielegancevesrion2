import { readBody, setResponseStatus } from 'h3'
import { buildMusicGenerationPrompt } from '~/lib/music-generation-prompt'
import { isMusicGenerationModelId, DEFAULT_MUSIC_MODEL_ID } from '~/lib/music-generation-models'
import {
  musicResultPlaybackPath,
  newMusicGenerationResultId,
  pruneOldMusicGenerationResults,
  saveMusicGenerationResult
} from '~/server/utils/music-generation-store'
import {
  newMusicGenerationJobId,
  registerMusicGenerationJob,
  updateMusicGenerationJob
} from '~/server/utils/music-generation-job-registry'
import { openRouterGenerateMusic } from '~/server/utils/openrouter-generate-music'
import { resolveReferenceImageUrlForServerFetch } from '~/server/utils/resolve-pocketbase-proxied-url-for-fetch'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'

async function runMusicGenerationJob (args: {
  jobId: string
  prompt: string
  model: string
  apiKey: string
  referenceImageUrl?: string
}) {
  try {
    const { buffer, transcript } = await openRouterGenerateMusic({
      prompt: args.prompt,
      model: args.model,
      apiKey: args.apiKey,
      referenceImageUrl: args.referenceImageUrl
    })
    const resultId = newMusicGenerationResultId()
    await saveMusicGenerationResult(resultId, buffer)
    updateMusicGenerationJob(args.jobId, {
      status: 'completed',
      resultId,
      playbackUrl: musicResultPlaybackPath(resultId),
      transcript
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Music generation failed'
    updateMusicGenerationJob(args.jobId, {
      status: 'failed',
      message: message.trim() || 'Music generation failed'
    })
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const rawPrompt = typeof body?.prompt === 'string' ? body.prompt : ''
  const modelRaw = typeof body?.model === 'string' ? body.model.trim() : DEFAULT_MUSIC_MODEL_ID
  const model = isMusicGenerationModelId(modelRaw) ? modelRaw : DEFAULT_MUSIC_MODEL_ID
  const instrumental = body?.instrumental !== false && body?.instrumental !== 'false'
  const lyrics = typeof body?.lyrics === 'string' ? body.lyrics : ''
  const bpmRaw = body?.bpm
  const bpm =
    typeof bpmRaw === 'number' && Number.isFinite(bpmRaw)
      ? bpmRaw
      : typeof bpmRaw === 'string' && bpmRaw.trim()
        ? Number(bpmRaw)
        : null

  const referenceImageUrl =
    typeof body?.referenceImageUrl === 'string'
      ? body.referenceImageUrl.trim()
      : typeof body?.reference_image_url === 'string'
        ? body.reference_image_url.trim()
        : ''

  const syncBlocking = body?.sync === true || body?.sync === 'true'

  const prompt = buildMusicGenerationPrompt({
    prompt: rawPrompt,
    instrumental,
    lyrics,
    bpm
  })

  if (!prompt.trim()) {
    throw createError({ statusCode: 400, message: 'Prompt is required' })
  }

  const config = useRuntimeConfig()
  const apiKey = resolveOpenRouterApiKey(config)
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env.'
    })
  }

  if (referenceImageUrl.startsWith('data:')) {
    throw createError({
      statusCode: 400,
      message: 'Reference image is too large to send inline. Upload a smaller image or use a project asset URL.'
    })
  }

  const userId = await getPocketBaseUserIdFromRequest(event).catch(() => null)

  const internalPb = String(config.pocketbaseInternalUrl || '').trim()
  const publicPb = String(config.public?.pocketbaseUrl || '').trim()
  const resolvedReference = referenceImageUrl
    ? await resolveReferenceImageUrlForServerFetch(referenceImageUrl, {
        pocketbaseInternalUrl: internalPb,
        publicPocketbaseUrl: publicPb || undefined
      })
    : ''

  void pruneOldMusicGenerationResults()

  if (syncBlocking) {
    try {
      const { buffer, transcript } = await openRouterGenerateMusic({
        prompt,
        model,
        apiKey,
        referenceImageUrl: resolvedReference || undefined
      })
      const resultId = newMusicGenerationResultId()
      await saveMusicGenerationResult(resultId, buffer)
      return {
        async: false,
        status: 'completed',
        model,
        resultId,
        playbackUrl: musicResultPlaybackPath(resultId),
        transcript
      }
    } catch (e: unknown) {
      const anyErr = e as { statusCode?: number; message?: string }
      const status = anyErr?.statusCode && Number.isFinite(anyErr.statusCode) ? anyErr.statusCode : 502
      const message = anyErr?.message?.trim() || 'Music generation failed'
      throw createError({ statusCode: status, message })
    }
  }

  const jobId = newMusicGenerationJobId()
  registerMusicGenerationJob(jobId, {
    status: 'running',
    model,
    userId: userId || undefined
  })

  void runMusicGenerationJob({
    jobId,
    prompt,
    model,
    apiKey,
    referenceImageUrl: resolvedReference || undefined
  })

  setResponseStatus(event, 202)
  return {
    async: true,
    jobId,
    status: 'running',
    model
  }
})
