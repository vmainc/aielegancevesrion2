import { getRouterParam, readBody, setResponseStatus } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { ApiErrorCode, throwApiError } from '~/server/utils/api-error-envelope'
import {
  isPocketBaseMissingCollectionError,
  pocketBaseErrorStatus
} from '~/server/utils/pb-missing-collection-error'
import {
  createScriptAnalyzeJob
} from '~/server/utils/script-analyze-job-registry'
import {
  runScriptAnalyzeApplyJob,
  runScriptAnalyzePreviewJob
} from '~/server/utils/run-project-analyze-job'

/**
 * Cold-read analyze pass: synopsis, observations, three-act map, director bible from the saved screenplay.
 *
 * Async (PASS fix): the model calls can take minutes and 504 behind the proxy, so this starts a
 * background job and returns a jobId. Poll GET /api/script-analyze/jobs/:jobId.
 */
export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Missing project id')
  }

  let userId: string
  try {
    ;({ userId } = await requireProjectOwner(event, projectId))
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throwApiError(
        503,
        ApiErrorCode.MISSING_COLLECTION,
        'PocketBase creative_projects collection is missing or not provisioned. Run npm run setup-db against this environment.',
        { collection: 'creative_projects' }
      )
    }
    if (pocketBaseErrorStatus(e) === 404) {
      throwApiError(404, ApiErrorCode.PROJECT_NOT_FOUND, 'Project not found.', { projectId })
    }
    const status =
      e && typeof e === 'object' && 'statusCode' in e
        ? Number((e as { statusCode?: number }).statusCode)
        : 0
    if (status === 403) {
      throwApiError(403, ApiErrorCode.FORBIDDEN, 'Forbidden', { resource: 'project' })
    }
    throw e
  }

  const body = await readBody<{
    assetId?: string
    selectedModels?: string[]
    chosenModelId?: string
    mode?: 'preview' | 'apply'
  }>(event).catch(() => ({} as {
    assetId?: string
    selectedModels?: string[]
    chosenModelId?: string
    mode?: 'preview' | 'apply'
  }))

  const raw = body && typeof body.assetId === 'string' ? body.assetId.trim() : ''
  const assetId = raw || undefined
  const selectedModels = Array.isArray(body?.selectedModels)
    ? [...new Set(body!.selectedModels.map(m => String(m).trim()).filter(Boolean))]
    : []
  const previewMode = body?.mode === 'preview'
  const chosenModelId = typeof body?.chosenModelId === 'string' ? body.chosenModelId.trim() : ''

  if (previewMode && selectedModels.length) {
    const jobId = createScriptAnalyzeJob(userId, 'preview')
    void runScriptAnalyzePreviewJob({ jobId, userId, projectId, assetId, selectedModels })
    setResponseStatus(event, 202)
    return { async: true, jobId, status: 'running' }
  }

  const jobId = createScriptAnalyzeJob(userId, 'apply')
  void runScriptAnalyzeApplyJob({
    jobId,
    userId,
    projectId,
    assetId,
    chosenModelId: chosenModelId || undefined
  })
  setResponseStatus(event, 202)
  return { async: true, jobId, status: 'running' }
})
