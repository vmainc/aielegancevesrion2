import { createError, getRouterParam } from 'h3'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { getScriptImportJob } from '~/server/utils/script-import-job-registry'

export default defineEventHandler(async (event) => {
  const jobId = getRouterParam(event, 'jobId')
  if (!jobId) {
    throw createError({ statusCode: 400, message: 'Missing job id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const job = getScriptImportJob(jobId, userId)
  if (!job) {
    throw createError({ statusCode: 404, message: 'Import job not found or expired' })
  }

  if (job.status === 'completed') {
    return {
      status: 'completed',
      projectId: job.projectId,
      project: job.project,
      scriptAsset: job.scriptAsset,
      storyboard: job.storyboard,
      sceneCount: job.sceneCount
    }
  }

  if (job.status === 'failed') {
    return {
      status: 'failed',
      message: job.error || 'Import failed'
    }
  }

  return { status: 'running' }
})
