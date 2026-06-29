import { createError, getRouterParam, getQuery } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { pbRecordToBibleEntity, projectIdOnBibleEntityRow } from '~/server/utils/bible-entity-map'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import type { BibleEntity } from '~/types/bible-entity'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { pb } = await requireProjectOwner(event, projectId || '')

  const query = getQuery(event)
  const entityType = typeof query.entityType === 'string' ? query.entityType.trim() : ''

  let filter = `project="${projectId}"`
  if (entityType) {
    filter += ` && entity_type="${entityType.replace(/"/g, '')}"`
  }

  let rows: unknown[]
  try {
    rows = await pb.collection('bible_entities').getFullList({
      filter,
      sort: 'name',
      batch: 200
    })
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'bible_entities collection is missing or not provisioned on PocketBase.'
      })
    }
    const st = pocketBaseErrorStatus(e)
    if (st !== 400) throw e
    const all = await pb.collection('bible_entities').getFullList({ batch: 400 })
    rows = all.filter((r) => projectIdOnBibleEntityRow(r as Record<string, unknown>) === projectId)
    if (entityType) {
      rows = rows.filter((r) => String((r as Record<string, unknown>).entity_type || '') === entityType)
    }
  }

  const entities: BibleEntity[] = rows.map((r) =>
    pbRecordToBibleEntity(r as Parameters<typeof pbRecordToBibleEntity>[0])
  )

  return { entities }
})
