import { createError, getQuery, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  const owner = pbRecordOwnerId(project as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const q = getQuery(event)
  const kind = typeof q.kind === 'string' ? q.kind.trim() : ''

  let filter = `project = "${projectId}" && owned_by = "${userId}"`
  if (kind && ['script', 'character', 'storyboard', 'video', 'other'].includes(kind)) {
    filter += ` && kind = "${kind}"`
  }

  try {
    const items = await pb.collection('project_assets').getFullList({
      filter,
      sort: 'sort_order,created',
      requestKey: `assets_${projectId}_${kind}`
    })
    return {
      items: items.map((r) => pbRecordToProjectAsset(r as Record<string, unknown>, pb))
    }
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : String(e)
    if (/wasn't found|not found|404|Missing collection/i.test(msg)) {
      throw createError({
        statusCode: 503,
        message:
          'project_assets collection is missing. Run: node scripts/setup-collections.js (adds project_assets).'
      })
    }
    throw createError({ statusCode: 500, message: msg })
  }
})
