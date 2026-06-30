import { createError, getRouterParam } from 'h3'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { getScriptAnalyzeJob } from '~/server/utils/script-analyze-job-registry'

export default defineEventHandler(async (event) => {
  const jobId = getRouterParam(event, 'jobId')
  if (!jobId) {
    throw createError({ statusCode: 400, message: 'Missing job id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const job = getScriptAnalyzeJob(jobId, userId)
  if (!job) {
    throw createError({ statusCode: 404, message: 'Analysis job not found or expired' })
  }

  if (job.status === 'completed') {
    if (job.kind === 'preview') {
      return {
        status: 'completed',
        kind: 'preview',
        candidates: job.candidates ?? [],
        assetId: job.assetId
      }
    }
    return {
      status: 'completed',
      kind: 'apply',
      project: job.project,
      scriptAsset: job.scriptAsset
    }
  }

  if (job.status === 'failed') {
    return {
      status: 'failed',
      message: job.error || 'Analysis failed'
    }
  }

  return { status: 'running' }
})
