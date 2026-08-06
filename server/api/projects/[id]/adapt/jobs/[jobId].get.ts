import { createError, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { getJob } from '~/server/utils/adapt-to-film-job-registry'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const jobId = getRouterParam(event, 'jobId')
  if (!id || !jobId) {
    throw createError({ statusCode: 400, message: 'Missing project id or job id' })
  }

  const { userId } = await requireProjectOwner(event, id)
  const job = getJob(jobId)
  if (!job || job.projectId !== id || job.userId !== userId) {
    throw createError({ statusCode: 404, message: 'Job not found.' })
  }

  return {
    jobId: job.jobId,
    kind: job.kind,
    status: job.status,
    message: job.message,
    result: job.status === 'completed' ? job.result : undefined,
    error: job.status === 'failed' ? job.message : undefined
  }
})
