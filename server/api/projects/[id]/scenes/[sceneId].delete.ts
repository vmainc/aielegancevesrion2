import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { projectIdOnSceneRow } from '~/server/utils/creative-scene-map'
import { isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const sceneId = getRouterParam(event, 'sceneId')
  if (!projectId || !sceneId) {
    throw createError({ statusCode: 400, message: 'Missing project or scene id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  if (pbRecordOwnerId(project as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const existing = await pb.collection('creative_scenes').getOne(sceneId)
  if (pbRecordOwnerId(existing as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

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

  return { ok: true, shotsDeleted }
})
