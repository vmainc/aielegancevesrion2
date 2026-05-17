import { createError, getQuery } from 'h3'
import { pollOpenRouterVideoOnce } from '~/server/utils/openrouter-video-job'
import { removeVideoGenerationJob, takeVideoGenerationJob } from '~/server/utils/video-generation-job-registry'

export default defineEventHandler(async (event) => {
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

  const r = await pollOpenRouterVideoOnce(job.pollUrl, job.apiKey, jobId, job.model)

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
