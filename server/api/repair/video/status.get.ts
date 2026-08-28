import { createError, getQuery } from 'h3'
import { pollVideoRepair } from '~/server/services/videoRepair'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { resolveOpenRouterApiKey } from '~/server/utils/server-env'
import { resolveLumaApiKey } from '~/server/utils/video-repair-config'
import {
  publicJobView,
  readVideoRepairJob,
  saveVideoRepairJob
} from '~/server/utils/video-repair-job-store'
import {
  saveVideoRepairMedia,
  newVideoRepairMediaId,
  videoRepairResultPath
} from '~/server/utils/video-repair-media-store'
import { fetchBinaryFromUrlForIngest } from '~/server/utils/fetch-url-for-project-ingest'
import { getVideoRepairMaxBytes } from '~/server/utils/video-repair-config'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const jobId = String(getQuery(event).jobId || '').trim()
  if (!jobId) {
    throw createError({ statusCode: 400, message: 'Query jobId is required.' })
  }

  const job = await readVideoRepairJob(jobId)
  if (!job) {
    throw createError({
      statusCode: 404,
      message: 'Unknown or expired repair job. Start a new repair.'
    })
  }
  if (job.userId !== userId) {
    throw createError({ statusCode: 403, message: 'Not authorized to access this repair.' })
  }

  if (
    job.status === 'completed' ||
    job.status === 'failed' ||
    job.status === 'cancelled' ||
    job.status === 'expired'
  ) {
    return publicJobView(job)
  }

  const config = useRuntimeConfig()
  const r = await pollVideoRepair(
    job.provider,
    job.pollUrl,
    job.providerJobId,
    job.model,
    {
      openRouterApiKey: resolveOpenRouterApiKey(config),
      lumaApiKey: resolveLumaApiKey(config)
    }
  )

  if (r.status === 'completed') {
    job.status = 'completed'
    job.completedAt = new Date().toISOString()
    job.actualCost = r.actualCost ?? job.actualCost
    try {
      const fetched = await fetchBinaryFromUrlForIngest(r.outputVideoUrl, {
        openRouterApiKey: resolveOpenRouterApiKey(config),
        maxBytes: getVideoRepairMaxBytes(),
        timeoutMs: 180_000,
        mediaKind: 'video'
      })
      const mediaId = newVideoRepairMediaId()
      await saveVideoRepairMedia({ id: mediaId, data: fetched.buffer, mime: 'video/mp4' })
      job.outputMediaId = mediaId
      job.outputVideo = videoRepairResultPath(mediaId)
    } catch (e: unknown) {
      console.error('[video-repair] ingest output failed; keeping provider URL', e)
      job.outputVideo = r.outputVideoUrl
    }
    await saveVideoRepairJob(job)
    return publicJobView(job)
  }

  if (r.status === 'failed' || r.status === 'cancelled' || r.status === 'expired') {
    job.status = r.status
    job.error = r.message
    job.completedAt = new Date().toISOString()
    await saveVideoRepairJob(job)
    console.error('[video-repair] provider failed', job.provider, job.model, r.message)
    return publicJobView(job)
  }

  job.status = r.status
  await saveVideoRepairJob(job)
  return publicJobView(job)
})
