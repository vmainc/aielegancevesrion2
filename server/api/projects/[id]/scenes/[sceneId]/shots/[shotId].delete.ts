import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { deleteSceneShot } from '~/server/utils/persist-scene-shots'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const sceneId = getRouterParam(event, 'sceneId')
  const shotId = getRouterParam(event, 'shotId')
  if (!projectId || !sceneId || !shotId) {
    throw createError({ statusCode: 400, message: 'Missing ids' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  const owner = pbRecordOwnerId(project as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const remaining = await pb.collection('creative_shots').getFullList({
    filter: `scene="${sceneId}"`,
    batch: 500
  })
  if (remaining.length <= 1) {
    throw createError({ statusCode: 400, message: 'A scene needs at least one board' })
  }

  try {
    await deleteSceneShot(pb, userId, projectId, sceneId, shotId)
    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/forbidden/i.test(msg)) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
    throw createError({ statusCode: 400, message: msg || 'Could not delete board' })
  }
})
