import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { assertUserHasProjectAccess } from '~/server/utils/project-access'

function projectIdOnAsset (raw: Record<string, unknown>): string {
  const p = raw.project
  if (typeof p === 'string') return p
  if (p && typeof p === 'object' && 'id' in p && typeof (p as { id?: string }).id === 'string') {
    return (p as { id: string }).id
  }
  return ''
}

export default defineEventHandler(async (event) => {
  const assetId = getRouterParam(event, 'assetId')
  if (!assetId) {
    throw createError({ statusCode: 400, message: 'Missing asset id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()
  const rec = await pb.collection('project_assets').getOne(assetId) as Record<string, unknown>

  const projectId = projectIdOnAsset(rec)
  if (projectId) {
    await assertUserHasProjectAccess(pb, userId, projectId)
  } else {
    const owner = pbRecordOwnerId(rec as { owned_by?: unknown; owner?: unknown; user?: unknown })
    if (owner !== userId) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
  }

  await pb.collection('project_assets').delete(assetId)
  return { ok: true }
})
