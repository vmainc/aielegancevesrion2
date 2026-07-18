import { getRouterParam, readBody, setResponseStatus } from 'h3'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { createScriptImportJob } from '~/server/utils/script-import-job-registry'
import { runProjectFullImportJob } from '~/server/utils/run-project-full-import-job'
import { ApiErrorCode, throwApiError } from '~/server/utils/api-error-envelope'

/**
 * Full screenplay import into an existing project (async — can take several minutes).
 * Poll GET /api/script-import/jobs/:jobId
 */
export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Missing project id')
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const body: { assetId?: string; chosenModelId?: string } =
    await readBody<{ assetId?: string; chosenModelId?: string }>(event).catch(() => ({}))
  const assetId = typeof body?.assetId === 'string' ? body.assetId.trim() : undefined
  const chosenModelId =
    typeof body?.chosenModelId === 'string' && body.chosenModelId.trim()
      ? body.chosenModelId.trim()
      : 'gpt-4o'

  const jobId = createScriptImportJob(userId)

  void runProjectFullImportJob({
    jobId,
    userId,
    projectId,
    assetId: assetId || undefined,
    chosenModelId
  })

  setResponseStatus(event, 202)
  return {
    async: true,
    jobId,
    status: 'running'
  }
})
