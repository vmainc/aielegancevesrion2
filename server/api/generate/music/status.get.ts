import { createError, getQuery } from 'h3'
import { takeMusicGenerationJob } from '~/server/utils/music-generation-job-registry'

export default defineEventHandler(async (event) => {
  const jobId = String(getQuery(event).jobId || '').trim()
  if (!jobId) {
    throw createError({ statusCode: 400, message: 'Query jobId is required' })
  }

  const job = takeMusicGenerationJob(jobId)
  if (!job) {
    throw createError({
      statusCode: 404,
      message: 'Unknown or expired job. Start a new render, or the server may have restarted.'
    })
  }

  return {
    jobId,
    status: job.status,
    model: job.model,
    playbackUrl: job.playbackUrl,
    resultId: job.resultId,
    transcript: job.transcript,
    message: job.message
  }
})
