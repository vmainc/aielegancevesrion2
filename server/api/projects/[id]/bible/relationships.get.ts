import { createError, getRouterParam, getQuery } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import {
  pbRecordToBibleRelationship,
  projectIdOnBibleRelationshipRow
} from '~/server/utils/bible-relationship-map'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import type { BibleRelationship } from '~/types/bible-relationship'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { pb } = await requireProjectOwner(event, projectId || '')

  const query = getQuery(event)
  const fromId = typeof query.fromId === 'string' ? query.fromId.trim() : ''
  const toId = typeof query.toId === 'string' ? query.toId.trim() : ''

  let filter = `project="${projectId}"`
  if (fromId) filter += ` && from_id="${fromId.replace(/"/g, '')}"`
  if (toId) filter += ` && to_id="${toId.replace(/"/g, '')}"`

  let rows: unknown[]
  try {
    rows = await pb.collection('bible_relationships').getFullList({
      filter,
      sort: '-created',
      batch: 200
    })
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'bible_relationships collection is missing or not provisioned on PocketBase.'
      })
    }
    const st = pocketBaseErrorStatus(e)
    if (st !== 400) throw e
    const all = await pb.collection('bible_relationships').getFullList({ batch: 400 })
    rows = all.filter((r) => projectIdOnBibleRelationshipRow(r as Record<string, unknown>) === projectId)
    if (fromId) {
      rows = rows.filter((r) => String((r as Record<string, unknown>).from_id || '') === fromId)
    }
    if (toId) {
      rows = rows.filter((r) => String((r as Record<string, unknown>).to_id || '') === toId)
    }
  }

  const relationships: BibleRelationship[] = rows.map((r) =>
    pbRecordToBibleRelationship(r as Parameters<typeof pbRecordToBibleRelationship>[0])
  )

  return { relationships }
})
