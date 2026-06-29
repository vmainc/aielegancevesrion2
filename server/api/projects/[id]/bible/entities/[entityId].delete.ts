import { createError, getRouterParam } from 'h3'
import { requireOwnedProjectRow, requireProjectOwner } from '~/server/utils/bible-project-access'
import { projectIdOnBibleEntityRow } from '~/server/utils/bible-entity-map'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const entityId = getRouterParam(event, 'entityId')
  if (!entityId) {
    throw createError({ statusCode: 400, message: 'Missing entity id' })
  }

  const { userId, pb } = await requireProjectOwner(event, projectId || '')
  await requireOwnedProjectRow(
    pb,
    userId,
    'bible_entities',
    entityId,
    projectId || '',
    projectIdOnBibleEntityRow,
    'Entity'
  )

  await pb.collection('bible_entities').delete(entityId)
  return { ok: true }
})
