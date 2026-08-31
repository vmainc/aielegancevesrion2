import { createError, getRequestURL, readBody, setResponseStatus } from 'h3'
import {
  hasVoiceOnlyRepair,
  parseRepairCategoryIds,
  visualRepairCategories
} from '~/lib/video-repair/categories'
import { buildVideoRepairPrompt } from '~/lib/video-repair/promptBuilder'
import { resolveRepairEngine } from '~/lib/video-repair/routing'
import {
  parseRepairEngineChoice,
  parseRepairMode,
  type VideoRepairReferenceFrame
} from '~/lib/video-repair/types'
import { audioRepairUnavailableMessage } from '~/server/services/audioRepair'
import { repairVideo } from '~/server/services/videoRepair'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'
import {
  estimateRepairCostUsd,
  getLumaModifyModel,
  getVideoRepairDefaultModel,
  getVideoRepairDefaultProvider,
  getVideoRepairLimits,
  resolveLumaApiKey
} from '~/server/utils/video-repair-config'
import {
  assertConcurrentRepairAllowed,
  newVideoRepairJobId,
  pruneOldVideoRepairJobs,
  publicJobView,
  saveVideoRepairJob,
  type StoredVideoRepairJob
} from '~/server/utils/video-repair-job-store'
import {
  newVideoRepairPublicToken,
  pruneOldVideoRepairMedia,
  videoRepairResultPath
} from '~/server/utils/video-repair-media-store'
import { buildProviderFetchableUrl } from '~/server/utils/video-repair-public-url'
import {
  imageDataUriFromMedia,
  loadProjectAssetVideoBuffer,
  sourceUrlForOpenRouter,
  stageBufferAsRepairMedia,
  stageRemoteVideoUrl
} from '~/server/utils/video-repair-source'

function str (v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  checkRateLimit(rateLimitKey(userId, 'repair-video'), 6, 60_000)
  void pruneOldVideoRepairJobs()
  void pruneOldVideoRepairMedia()

  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  const categories = parseRepairCategoryIds(body.categories)
  const visual = visualRepairCategories(categories)
  if (hasVoiceOnlyRepair(categories)) {
    throw createError({
      statusCode: 400,
      message: audioRepairUnavailableMessage()
    })
  }
  if (!visual.length) {
    throw createError({
      statusCode: 400,
      message: 'Select at least one visual issue to repair.'
    })
  }

  const userDescription = str(body.description ?? body.userDescription)
  if (!userDescription) {
    throw createError({
      statusCode: 400,
      message: 'Describe what needs fixing.'
    })
  }

  const repairMode = parseRepairMode(body.repairMode)
  const engineChoice = parseRepairEngineChoice(body.engine)
  const projectId = str(body.projectId)
  const sceneId = str(body.sceneId)
  const shotId = str(body.shotId)
  const characterId = str(body.characterId)
  const sourceAssetId = str(body.sourceAssetId)
  const sourceMediaIdIn = str(body.sourceMediaId)
  const sourceUrlIn = str(body.sourceVideoUrl)
  const referenceMediaId = str(body.referenceMediaId)
  const referenceImageUrl = str(body.referenceImageUrl)
  const durationRaw = Number(body.durationSeconds ?? body.duration)
  const durationSeconds = Number.isFinite(durationRaw) ? durationRaw : null
  const limits = getVideoRepairLimits()
  if (durationSeconds != null && durationSeconds > limits.maxDurationSeconds) {
    throw createError({
      statusCode: 400,
      message: `Clip is too long (max ${limits.maxDurationSeconds}s). Trim it before repairing.`
    })
  }

  if (projectId) {
    await requireProjectOwner(event, projectId)
  }

  await assertConcurrentRepairAllowed(userId)

  let sourceMediaId = sourceMediaIdIn
  if (!sourceMediaId && sourceAssetId) {
    if (!projectId) {
      throw createError({ statusCode: 400, message: 'projectId is required when using a library clip.' })
    }
    const loaded = await loadProjectAssetVideoBuffer(projectId, sourceAssetId)
    const staged = await stageBufferAsRepairMedia(loaded.data, loaded.mime)
    sourceMediaId = staged.mediaId
  }
  if (!sourceMediaId && sourceUrlIn && /^https?:\/\//i.test(sourceUrlIn)) {
    const staged = await stageRemoteVideoUrl(sourceUrlIn)
    sourceMediaId = staged.mediaId
  }
  if (!sourceMediaId) {
    throw createError({ statusCode: 400, message: 'Select or upload a source video.' })
  }

  const config = useRuntimeConfig()
  const routing = resolveRepairEngine({
    choice: engineChoice,
    categories: visual,
    config: {
      defaultProvider: getVideoRepairDefaultProvider(),
      defaultModel: getVideoRepairDefaultModel(),
      lumaConfigured: Boolean(resolveLumaApiKey(config)),
      lumaModel: getLumaModifyModel()
    }
  })

  const prompt = buildVideoRepairPrompt({
    categories: visual,
    userDescription,
    repairMode,
    hasReferenceFrame: Boolean(referenceMediaId || referenceImageUrl),
    characterName: str(body.characterName),
    characterAppearance: str(body.characterAppearance),
    characterNotes: str(body.characterNotes),
    sceneHeading: str(body.sceneHeading),
    sceneSummary: str(body.sceneSummary),
    shotTitle: str(body.shotTitle),
    shotDescription: str(body.shotDescription),
    shotType: str(body.shotType),
    cameraMove: str(body.cameraMove)
  })

  const publicToken = newVideoRepairPublicToken()
  const origin = getRequestURL(event).origin
  const publicBase = buildProviderFetchableUrl({ publicToken, requestOrigin: origin })
  const publicSource = publicBase ? `${publicBase}?kind=source` : null
  const publicRef = publicBase && (referenceMediaId || referenceImageUrl)
    ? `${publicBase}?kind=reference`
    : null

  const referenceFrames: VideoRepairReferenceFrame[] = []
  if (referenceImageUrl) {
    referenceFrames.push({ url: referenceImageUrl, source: 'character' })
  } else if (referenceMediaId) {
    referenceFrames.push({
      url: publicRef || (await imageDataUriFromMedia(referenceMediaId)),
      timestampSeconds: Number.isFinite(Number(body.referenceTimestampSeconds))
        ? Number(body.referenceTimestampSeconds)
        : undefined,
      source: 'extracted_frame'
    })
  }

  let sourceVideoUrl: string
  if (routing.provider === 'luma') {
    if (!publicSource) {
      throw createError({
        statusCode: 400,
        message:
          'Luma Modify needs a publicly reachable source URL. Use Auto / Runway Aleph locally, or set VIDEO_REPAIR_PUBLIC_BASE_URL to a tunnel.'
      })
    }
    sourceVideoUrl = publicSource
  } else {
    sourceVideoUrl = await sourceUrlForOpenRouter({
      publicUrl: publicSource,
      mediaId: sourceMediaId
    })
  }

  const jobId = newVideoRepairJobId()
  const now = new Date().toISOString()
  const estimatedCost = estimateRepairCostUsd({
    provider: routing.provider,
    model: routing.model,
    durationSeconds
  })

  // Persist before calling the provider so public token URLs resolve when
  // OpenRouter / Luma fetch the source (and optional reference) video.
  const job: StoredVideoRepairJob = {
    id: jobId,
    userId,
    provider: routing.provider,
    model: routing.model,
    status: 'pending',
    sourceVideo: videoRepairResultPath(sourceMediaId),
    outputVideo: null,
    createdAt: now,
    completedAt: null,
    error: null,
    estimatedCost,
    actualCost: null,
    durationSeconds,
    providerJobId: '',
    pollUrl: '',
    publicToken,
    sourceMediaId,
    referenceMediaId: referenceMediaId || undefined,
    projectId: projectId || undefined,
    sceneId: sceneId || undefined,
    shotId: shotId || undefined,
    characterId: characterId || undefined,
    sourceAssetId: sourceAssetId || undefined,
    categories: visual,
    repairMode,
    engineChoice,
    userDescription,
    prompt,
    referenceTimestampSeconds: Number.isFinite(Number(body.referenceTimestampSeconds))
      ? Number(body.referenceTimestampSeconds)
      : undefined
  }
  await saveVideoRepairJob(job)

  let started
  try {
    started = await repairVideo(
      {
        sourceVideo: sourceVideoUrl,
        prompt,
        referenceFrames,
        repairMode,
        duration: durationSeconds ?? undefined,
        provider: routing.provider,
        model: routing.model,
        publicSourceVideoUrl: publicSource || undefined,
        publicReferenceImageUrl: publicRef || undefined
      },
      {
        openRouterApiKey: resolveOpenRouterApiKey(config),
        lumaApiKey: resolveLumaApiKey(config)
      }
    )
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
        ? (e as { message: string }).message
        : 'The repair service could not start this job.'
    job.status = 'failed'
    job.error = msg
    job.completedAt = new Date().toISOString()
    await saveVideoRepairJob(job)
    throw e
  }

  job.model = started.model || routing.model
  job.status = started.status === 'completed' ? 'completed' : started.status
  job.providerJobId = started.providerJobId
  job.pollUrl = started.pollUrl
  job.actualCost = started.actualCost ?? null
  job.completedAt = started.status === 'completed' ? new Date().toISOString() : null
  if (started.outputVideoUrl) {
    job.outputVideo = started.outputVideoUrl
  }
  await saveVideoRepairJob(job)

  if (job.status === 'completed' && job.outputVideo) {
    return publicJobView(job)
  }

  setResponseStatus(event, 202)
  return {
    async: true,
    ...publicJobView(job)
  }
})
