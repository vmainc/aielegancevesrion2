import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeScene } from '~/server/utils/creative-scene-map'
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

  const scene = await pb.collection('creative_scenes').getOne(sceneId)
  if (pbRecordOwnerId(scene as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const mapped = pbRecordToCreativeScene(scene as Parameters<typeof pbRecordToCreativeScene>[0])
  if (mapped.projectId !== projectId) {
    throw createError({ statusCode: 400, message: 'Scene does not belong to this project' })
  }

  return {
    scene: {
      id: mapped.id,
      sortOrder: mapped.sortOrder,
      heading: mapped.heading,
      summary: mapped.summary,
      body: mapped.body
    }
  }
})
