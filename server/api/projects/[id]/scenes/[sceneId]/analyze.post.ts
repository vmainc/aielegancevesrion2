import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { analyzeProjectScene } from '~/server/utils/analyze-project-scene'
import { syncProjectToBibleSafe } from '~/server/utils/sync-project-to-bible'

/**
 * Per-scene analyser: detect cast gaps in this scene's script and generate storyboard panels.
 */
export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const sceneId = getRouterParam(event, 'sceneId')
  if (!projectId || !sceneId) {
    throw createError({ statusCode: 400, message: 'Missing project or scene id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const result = await analyzeProjectScene({ userId, pb, projectId, sceneId })
  await syncProjectToBibleSafe({
    pb,
    userId,
    projectId,
    scopes: ['characters', 'scenes', 'shots']
  })
  return { ok: true, ...result }
})
