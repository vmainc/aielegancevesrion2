import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

function relProjectId (v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && 'id' in v) return String((v as { id: string }).id)
  return ''
}

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

  const sid = relProjectId(scene.project)
  if (sid !== projectId) {
    throw createError({ statusCode: 400, message: 'Scene does not belong to this project' })
  }

  return {
    scene: {
      id: scene.id,
      sortOrder: typeof scene.sort_order === 'number' ? scene.sort_order : 0,
      heading: String(scene.heading || ''),
      summary: String(scene.summary || ''),
      body: String(scene.body || '')
    }
  }
})
