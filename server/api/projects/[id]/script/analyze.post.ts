import { createError, getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { analyzeScriptImportForProject } from '~/server/utils/import-script-core'

/**
 * Run full AI import (synopsis, treatment, scenes, characters, storyboard seed) from the saved screenplay asset.
 */
export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const body = await readBody<{ assetId?: string }>(event).catch(() => ({} as { assetId?: string }))
  const raw = body && typeof body.assetId === 'string' ? body.assetId.trim() : ''
  const assetId = raw || undefined

  return analyzeScriptImportForProject({
    userId,
    pb,
    projectId,
    assetId
  })
})
