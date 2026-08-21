import { createError, getQuery } from 'h3'
import { pollAtlasCloudVideoOnce } from '~/server/utils/atlascloud-video-job'
import { pollOpenRouterVideoOnce } from '~/server/utils/openrouter-video-job'
import { removeVideoGenerationJob, takeVideoGenerationJob } from '~/server/utils/video-generation-job-registry'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const jobId = String(getQuery(event).jobId || '').trim()
  if (!jobId) {
    throw createError({ statusCode: 400, message: 'Query jobId is required' })
  }

  const job = takeVideoGenerationJob(jobId)
  if (!job) {
    throw createError({
      statusCode: 404,
      message: 'Unknown or expired job. Start a new render, or the server may have restarted.'
    })
  }
  if (job.userId !== userId) {
    throw createError({
      statusCode: 403,
      message: 'Not authorized to access this video job. Start a new render from your account.'
    })
  }

  const useAtlas =
    job.provider === 'atlascloud' || job.pollUrl.includes('atlascloud.ai')

  const r = useAtlas
    ? await pollAtlasCloudVideoOnce(job.pollUrl, job.apiKey, jobId, job.model)
    : await pollOpenRouterVideoOnce(job.pollUrl, job.apiKey, jobId, job.model)

  if (r.status === 'completed') {
    removeVideoGenerationJob(jobId)
    return {
      jobId: r.jobId,
      status: r.status,
      model: r.model,
      videoUrl: r.videoUrl
    }
  }

  if (r.status === 'failed' || r.status === 'cancelled' || r.status === 'expired') {
    removeVideoGenerationJob(jobId)
    return {
      jobId: r.jobId,
      status: r.status,
      model: r.model,
      message: r.message
    }
  }

  return {
    jobId: r.jobId,
    status: r.status,
    model: r.model
  }
})
