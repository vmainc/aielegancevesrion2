import { createError, getRouterParam } from 'h3'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { getGenerateShotsJob } from '~/server/utils/generate-shots-job-registry'

export default defineEventHandler(async (event) => {
  const jobId = getRouterParam(event, 'jobId')
  if (!jobId) {
    throw createError({ statusCode: 400, message: 'Missing job id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const job = getGenerateShotsJob(jobId, userId)
  if (!job) {
    throw createError({ statusCode: 404, message: 'Shot generation job not found or expired' })
  }

  if (job.status === 'completed') {
    return {
      status: 'completed',
      projectId: job.projectId,
      sceneId: job.sceneId,
      shots: job.shots,
      persisted: job.persisted,
      warning: job.warning,
      continuity: job.continuity
    }
  }

  if (job.status === 'failed') {
    return {
      status: 'failed',
      message: job.error || 'Shot generation failed'
    }
  }

  return { status: 'running', projectId: job.projectId, sceneId: job.sceneId }
})
