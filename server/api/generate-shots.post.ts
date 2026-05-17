import { readBody, setResponseStatus } from 'h3'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { createGenerateShotsJob } from '~/server/utils/generate-shots-job-registry'
import { runGenerateShotsJob } from '~/server/utils/run-generate-shots-job'
import { ApiErrorCode, throwApiError } from '~/server/utils/api-error-envelope'

/**
 * Async shot generation (OpenRouter can take 1–3+ minutes).
 * Poll GET /api/generate-shots/jobs/:jobId
 */
export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody(event).catch(() => null) as {
    project_id?: string
    scene_id?: string
  } | null

  const projectId = body?.project_id?.trim()
  const sceneId = body?.scene_id?.trim()
  if (!projectId || !sceneId) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'project_id and scene_id are required')
  }

  const jobId = createGenerateShotsJob(userId, projectId, sceneId)
  void runGenerateShotsJob({ jobId, userId, projectId, sceneId })

  setResponseStatus(event, 202)
  return {
    async: true,
    jobId,
    status: 'running'
  }
})
