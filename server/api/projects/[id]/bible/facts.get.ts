import { createError, getRouterParam, getQuery } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { pbRecordToBibleFact, projectIdOnBibleFactRow } from '~/server/utils/bible-fact-map'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import type { BibleFact } from '~/types/bible-fact'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { pb } = await requireProjectOwner(event, projectId || '')

  const query = getQuery(event)
  const entityId = typeof query.entityId === 'string' ? query.entityId.trim() : ''

  let filter = `project="${projectId}"`
  if (entityId) {
    filter += ` && entity="${entityId.replace(/"/g, '')}"`
  }

  let rows: unknown[]
  try {
    rows = await pb.collection('bible_facts').getFullList({
      filter,
      sort: '-created',
      batch: 200
    })
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'bible_facts collection is missing or not provisioned on PocketBase.'
      })
    }
    const st = pocketBaseErrorStatus(e)
    if (st !== 400) throw e
    const all = await pb.collection('bible_facts').getFullList({ batch: 400 })
    rows = all.filter((r) => projectIdOnBibleFactRow(r as Record<string, unknown>) === projectId)
    if (entityId) {
      rows = rows.filter((r) => {
        const ent = (r as Record<string, unknown>).entity
        const id = typeof ent === 'string' ? ent : (ent as { id?: string } | undefined)?.id
        return id === entityId
      })
    }
  }

  const facts: BibleFact[] = rows.map((r) =>
    pbRecordToBibleFact(r as Parameters<typeof pbRecordToBibleFact>[0])
  )

  return { facts }
})
