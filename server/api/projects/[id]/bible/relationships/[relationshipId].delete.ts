import { createError, getRouterParam } from 'h3'
import { requireOwnedProjectRow, requireProjectOwner } from '~/server/utils/bible-project-access'
import { projectIdOnBibleRelationshipRow } from '~/server/utils/bible-relationship-map'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const relationshipId = getRouterParam(event, 'relationshipId')
  if (!relationshipId) {
    throw createError({ statusCode: 400, message: 'Missing relationship id' })
  }

  const { userId, pb } = await requireProjectOwner(event, projectId || '')
  await requireOwnedProjectRow(
    pb,
    userId,
    'bible_relationships',
    relationshipId,
    projectId || '',
    projectIdOnBibleRelationshipRow,
    'Relationship'
  )

  await pb.collection('bible_relationships').delete(relationshipId)
  return { ok: true }
})
