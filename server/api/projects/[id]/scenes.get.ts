import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(id)
  const owner = pbRecordOwnerId(project as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const filter = `project="${id}"`
  const list = await pb.collection('creative_scenes').getFullList({
    filter,
    sort: 'sort_order',
    batch: 500
  })

  return {
    scenes: list.map(s => {
      const so = Number(s.sort_order)
      return {
        id: s.id,
        sortOrder: Number.isFinite(so) ? so : 0,
        heading: s.heading,
        summary: s.summary || '',
        bodyLength: String(s.body || '').length
      }
    })
  }
})
