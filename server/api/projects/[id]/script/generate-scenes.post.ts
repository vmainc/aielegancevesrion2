import { createError, getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { generateScenesFromScriptForProject } from '~/server/utils/import-script-core'

/**
 * Replace all creative_scenes with a Claude breakdown from the saved screenplay,
 * using the project’s current Director notes and genre/tone.
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

  return generateScenesFromScriptForProject({
    userId,
    pb,
    projectId,
    assetId
  })
})
