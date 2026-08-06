import { createError, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { projectIdOnSceneRow } from '~/server/utils/creative-scene-map'
import { isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'
import { syncProjectToBibleSafe } from '~/server/utils/sync-project-to-bible'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const sceneId = getRouterParam(event, 'sceneId')
  if (!projectId || !sceneId) {
    throw createError({ statusCode: 400, message: 'Missing project or scene id' })
  }

  const { pb, access } = await requireProjectOwner(event, projectId)

  const existing = await pb.collection('creative_scenes').getOne(sceneId)
  if (projectIdOnSceneRow(existing as Record<string, unknown>) !== projectId) {
    throw createError({ statusCode: 400, message: 'Scene does not belong to this project' })
  }

  let shotsDeleted = 0
  try {
    const shots = await pb.collection('creative_shots').getFullList({
      filter: `scene="${sceneId}"`,
      batch: 500
    })
    for (const shot of shots) {
      await pb.collection('creative_shots').delete(shot.id)
      shotsDeleted += 1
    }
  } catch (e: unknown) {
    if (!isPocketBaseMissingCollectionError(e)) {
      throw e
    }
  }

  await pb.collection('creative_scenes').delete(sceneId)
  await syncProjectToBibleSafe({
    pb,
    userId: access.ownerId,
    projectId,
    scopes: ['scenes', 'shots', 'characters', 'assets']
  })

  return { ok: true, shotsDeleted }
})
