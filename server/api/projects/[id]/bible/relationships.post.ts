import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { assertBibleEndpointInProject } from '~/server/utils/bible-endpoint-access'
import { pbRecordToBibleRelationship } from '~/server/utils/bible-relationship-map'
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
  const { userId, pb } = await requireProjectOwner(event, projectId || '')

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

  const fromType = parseBibleEndpointType(body?.fromType, 'fromType')
  const fromId = parseBibleEndpointId(body?.fromId, 'fromId')
  const toType = parseBibleEndpointType(body?.toType, 'toType')
  const toId = parseBibleEndpointId(body?.toId, 'toId')

  const relationshipType =
    typeof body?.relationshipType === 'string'
      ? body.relationshipType.trim().slice(0, BIBLE_RELATIONSHIP_TYPE_MAX)
      : ''
  if (!relationshipType) {
    throw createError({ statusCode: 400, message: 'relationshipType is required' })
  }

  await assertBibleEndpointInProject(pb, userId, projectId || '', fromType, fromId)
  await assertBibleEndpointInProject(pb, userId, projectId || '', toType, toId)

  const status = parseBibleRelationshipStatus(body?.status)
  const strength = body?.strength !== undefined ? parseBibleConfidence(body.strength) : null
  const actorType = parseBibleActorType(body?.actorType)

  const payload: Record<string, unknown> = {
    owned_by: userId,
    project: projectId,
    from_type: fromType,
    from_id: fromId,
    to_type: toType,
    to_id: toId,
    relationship_type: relationshipType,
    status
  }

  if (typeof body?.role === 'string') {
    payload.role = body.role.trim().slice(0, BIBLE_RELATIONSHIP_ROLE_MAX)
  }
  if (strength !== null) payload.strength = strength
  if (typeof body?.sourceType === 'string') {
    payload.source_type = body.sourceType.trim().slice(0, BIBLE_SOURCE_TYPE_MAX)
  }
  if (typeof body?.sourceId === 'string') {
    payload.source_id = body.sourceId.trim().slice(0, BIBLE_SOURCE_ID_MAX)
  }
  if (actorType) payload.actor_type = actorType
  if (typeof body?.actorId === 'string') {
    payload.actor_id = body.actorId.trim().slice(0, BIBLE_ACTOR_ID_MAX)
  }

  try {
    const created = await pb.collection('bible_relationships').create(payload)
    return {
      relationship: pbRecordToBibleRelationship(created as Parameters<typeof pbRecordToBibleRelationship>[0])
    }
  } catch (e: unknown) {
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not create bible relationship'
    })
  }
})
