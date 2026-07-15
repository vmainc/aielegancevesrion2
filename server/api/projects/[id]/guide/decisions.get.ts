import { createError, getQuery, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { pbRecordToCreativeDecision } from '~/server/utils/creative-decision-map'
import { isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { userId, pb } = await requireProjectOwner(event, projectId || '')

  const query = getQuery(event)
  const limitRaw = typeof query.limit === 'string' ? Number(query.limit) : 50
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 100) : 50

  try {
    const rows = await pb.collection('creative_decisions').getList(1, limit, {
      filter: `project = "${projectId}" && owned_by = "${userId}"`,
      sort: '-created'
    })

    return {
      items: rows.items.map((row) =>
        pbRecordToCreativeDecision(row as Record<string, unknown>)
      )
    }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'creative_decisions collection is missing. Run npm run setup-db.'
      })
    }
    throw e
  }
})
