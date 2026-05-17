import { getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  downloadProjectAssetFileBuffer,
  loadWorkflowScreenplayParsedForProject,
  runFullImportFromParsed
} from '~/server/utils/import-script-core'
import { ApiErrorCode, throwApiError } from '~/server/utils/api-error-envelope'

/**
 * Full screenplay import into an existing project: director pass, scenes, cast, and storyboard seed.
 * Use when a script file is saved but analysis has not run (or the project was opened from Script Wizard without import).
 */
export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throwApiError(400, ApiErrorCode.VALIDATION_ERROR, 'Missing project id')
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const body = await readBody<{ assetId?: string }>(event).catch(() => ({}))
  const assetId = typeof body?.assetId === 'string' ? body.assetId.trim() : undefined

  const { parsed, filename, assetId: resolvedAssetId } = await loadWorkflowScreenplayParsedForProject({
    userId,
    pb,
    projectId,
    assetId
  })

  const assetRow = await pb.collection('project_assets').getOne(resolvedAssetId)
  const fileBuf = await downloadProjectAssetFileBuffer(pb, assetRow as Record<string, unknown>)

  let projectRow: Record<string, unknown>
  try {
    projectRow = await pb.collection('creative_projects').getOne(projectId) as Record<string, unknown>
  } catch {
    throwApiError(404, ApiErrorCode.PROJECT_NOT_FOUND, 'Project not found.', { projectId })
  }

  const aspectRatio =
    String(projectRow.aspect_ratio || '16:9') === '9:16'
      ? '9:16'
      : String(projectRow.aspect_ratio) === '1:1'
        ? '1:1'
        : '16:9'
  const goalRaw = String(projectRow.goal || 'film')
  const goal =
    goalRaw === 'social' || goalRaw === 'commercial' || goalRaw === 'other' ? goalRaw : 'film'

  const { project, scriptAsset } = await runFullImportFromParsed({
    userId,
    pb,
    fileBuf,
    filename,
    parsed,
    aspectRatio,
    goal,
    existingProjectId: projectId,
    reuseAssetId: resolvedAssetId
  })

  return { project, scriptAsset, importComplete: true }
})
