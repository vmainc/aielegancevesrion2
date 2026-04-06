import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const assetId = getRouterParam(event, 'assetId')
  if (!projectId || !assetId) {
    throw createError({ statusCode: 400, message: 'Missing project or asset id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  const owner = pbRecordOwnerId(project as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const existing = await pb.collection('project_assets').getOne(assetId)
  const p = typeof existing.project === 'string' ? existing.project : (existing.project as { id?: string })?.id
  const u = pbRecordOwnerId(existing as { owner?: unknown; user?: unknown })
  if (p !== projectId || u !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  await pb.collection('project_assets').delete(assetId)
  return { ok: true }
})
