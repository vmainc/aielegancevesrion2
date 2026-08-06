import { createError, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { deleteSceneShot } from '~/server/utils/persist-scene-shots'
import { syncProjectToBibleSafe } from '~/server/utils/sync-project-to-bible'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const sceneId = getRouterParam(event, 'sceneId')
  const shotId = getRouterParam(event, 'shotId')
  if (!projectId || !sceneId || !shotId) {
    throw createError({ statusCode: 400, message: 'Missing ids' })
  }
  const { userId, pb, access } = await requireProjectOwner(event, projectId)

  const remaining = await pb.collection('creative_shots').getFullList({
    filter: `scene="${sceneId}"`,
    batch: 500
  })
  if (remaining.length <= 1) {
    throw createError({ statusCode: 400, message: 'A scene needs at least one board' })
  }

  try {
    await deleteSceneShot(pb, userId, projectId, sceneId, shotId)
    await syncProjectToBibleSafe({
      pb,
      userId: access.ownerId,
      projectId,
      scopes: ['shots']
    })
    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/forbidden/i.test(msg)) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
    throw createError({ statusCode: 400, message: msg || 'Could not delete board' })
  }
})
