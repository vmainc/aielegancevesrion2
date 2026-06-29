import { createError, getRouterParam, readBody } from 'h3'
import { requireOwnedProjectRow, requireProjectOwner } from '~/server/utils/bible-project-access'
import { assertBibleEndpointInProject } from '~/server/utils/bible-endpoint-access'
import {
  pbRecordToBibleRelationship,
  projectIdOnBibleRelationshipRow
} from '~/server/utils/bible-relationship-map'
import {
  BIBLE_RELATIONSHIP_ROLE_MAX,
  BIBLE_RELATIONSHIP_TYPE_MAX,
  BIBLE_SOURCE_ID_MAX,
  BIBLE_SOURCE_TYPE_MAX,
  BIBLE_ACTOR_ID_MAX,
  parseBibleActorType,
  parseBibleConfidence,
  parseBibleEndpointId,
  parseBibleEndpointType,
  parseBibleRelationshipStatus,
  parseOptionalProjectId
} from '~/server/utils/bible-validation'
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const relationshipId = getRouterParam(event, 'relationshipId')
  if (!relationshipId) {
    throw createError({ statusCode: 400, message: 'Missing relationship id' })
  }

  const { userId, pb } = await requireProjectOwner(event, projectId || '')
  const existing = await requireOwnedProjectRow(
    pb,
    userId,
    'bible_relationships',
    relationshipId,
    projectId || '',
    projectIdOnBibleRelationshipRow,
    'Relationship'
  )

  const body = await readBody<{
    projectId?: string
    fromType?: string
    fromId?: string
    toType?: string
    toId?: string
    relationshipType?: string
    role?: string
    strength?: number | null
    status?: string
    sourceType?: string
    sourceId?: string
    actorType?: string
    actorId?: string
  }>(event).catch(() => ({}))

  parseOptionalProjectId(body?.projectId, projectId || '')

  const patch: Record<string, unknown> = {}

  if (body?.fromType !== undefined || body?.fromId !== undefined) {
    const fromType = parseBibleEndpointType(
      body?.fromType ?? String(existing.from_type || ''),
      'fromType'
    )
    const fromId = parseBibleEndpointId(body?.fromId ?? String(existing.from_id || ''), 'fromId')
    await assertBibleEndpointInProject(pb, userId, projectId || '', fromType, fromId)
    patch.from_type = fromType
    patch.from_id = fromId
  }
  if (body?.toType !== undefined || body?.toId !== undefined) {
    const toType = parseBibleEndpointType(
      body?.toType ?? String(existing.to_type || ''),
      'toType'
    )
    const toId = parseBibleEndpointId(body?.toId ?? String(existing.to_id || ''), 'toId')
    await assertBibleEndpointInProject(pb, userId, projectId || '', toType, toId)
    patch.to_type = toType
    patch.to_id = toId
  }
  if (body?.relationshipType !== undefined) {
    const relationshipType =
      typeof body.relationshipType === 'string'
        ? body.relationshipType.trim().slice(0, BIBLE_RELATIONSHIP_TYPE_MAX)
        : ''
    if (!relationshipType) {
      throw createError({ statusCode: 400, message: 'relationshipType cannot be empty' })
    }
    patch.relationship_type = relationshipType
  }
  if (body?.role !== undefined && typeof body.role === 'string') {
    patch.role = body.role.trim().slice(0, BIBLE_RELATIONSHIP_ROLE_MAX)
  }
  if (body?.strength !== undefined) {
    const strength = parseBibleConfidence(body.strength)
    if (strength !== null) patch.strength = strength
  }
  if (body?.status !== undefined) {
    patch.status = parseBibleRelationshipStatus(body.status, 'active')
  }
  if (body?.sourceType !== undefined && typeof body.sourceType === 'string') {
    patch.source_type = body.sourceType.trim().slice(0, BIBLE_SOURCE_TYPE_MAX)
  }
  if (body?.sourceId !== undefined && typeof body.sourceId === 'string') {
    patch.source_id = body.sourceId.trim().slice(0, BIBLE_SOURCE_ID_MAX)
  }
  if (body?.actorType !== undefined) {
    const actorType = parseBibleActorType(body.actorType)
    if (actorType) patch.actor_type = actorType
  }
  if (body?.actorId !== undefined && typeof body.actorId === 'string') {
    patch.actor_id = body.actorId.trim().slice(0, BIBLE_ACTOR_ID_MAX)
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  try {
    const updated = await pb.collection('bible_relationships').update(relationshipId, patch)
    return {
      relationship: pbRecordToBibleRelationship(updated as Parameters<typeof pbRecordToBibleRelationship>[0])
    }
  } catch (e: unknown) {
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not update bible relationship'
    })
  }
})
