import { createError, getRouterParam } from 'h3'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { publicJobView, readVideoRepairJob } from '~/server/utils/video-repair-job-store'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const jobId = String(getRouterParam(event, 'jobId') || '').trim()
  const job = await readVideoRepairJob(jobId)
  if (!job) {
    throw createError({ statusCode: 404, message: 'Unknown or expired repair job.' })
  }
  if (job.userId !== userId) {
    throw createError({ statusCode: 403, message: 'Not authorized to access this repair.' })
  }
  return publicJobView(job)
})
