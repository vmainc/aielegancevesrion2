import { createError, getQuery, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { buildVideoPanelPrefill } from '~/server/utils/project-video-panel-prefill'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const query = getQuery(event)
  const sceneId = typeof query.sceneId === 'string' ? query.sceneId.trim() : ''
  const shotId = typeof query.shotId === 'string' ? query.shotId.trim() : ''

  if (!projectId || !sceneId || !shotId) {
    throw createError({ statusCode: 400, message: 'Missing project, scene, or shot id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  if (pbRecordOwnerId(project as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  return buildVideoPanelPrefill({
    pb,
    userId,
    projectId,
    sceneId,
    shotId
  })
})
