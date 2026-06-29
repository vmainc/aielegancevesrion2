import { createError, getRouterParam } from 'h3'
import { requireOwnedProjectRow, requireProjectOwner } from '~/server/utils/bible-project-access'
import {
  pbRecordToBibleRelationship,
  projectIdOnBibleRelationshipRow
} from '~/server/utils/bible-relationship-map'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const relationshipId = getRouterParam(event, 'relationshipId')
  if (!relationshipId) {
    throw createError({ statusCode: 400, message: 'Missing relationship id' })
  }

  const { userId, pb } = await requireProjectOwner(event, projectId || '')
  const row = await requireOwnedProjectRow(
    pb,
    userId,
    'bible_relationships',
    relationshipId,
    projectId || '',
    projectIdOnBibleRelationshipRow,
    'Relationship'
  )

  return {
    relationship: pbRecordToBibleRelationship(row as Parameters<typeof pbRecordToBibleRelationship>[0])
  }
})
