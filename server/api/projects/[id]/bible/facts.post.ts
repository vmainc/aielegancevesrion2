import { createError, getRouterParam, readBody } from 'h3'
import { requireOwnedProjectRow, requireProjectOwner } from '~/server/utils/bible-project-access'
import { pbRecordToBibleFact } from '~/server/utils/bible-fact-map'
import { projectIdOnBibleEntityRow } from '~/server/utils/bible-entity-map'
import {
  BIBLE_SOURCE_ID_MAX,
  BIBLE_SOURCE_TYPE_MAX,
  BIBLE_ACTOR_ID_MAX,
  parseBibleActorType,
  parseBibleConfidence,
  parseBibleFactStatement,
  parseBibleFactStatus,
  parseBibleScopeType,
  parseBibleStructuredValue,
  parseOptionalProjectId
} from '~/server/utils/bible-validation'
import { defaultUserAuthoredFactStatus } from '~/lib/bible-trust'
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { userId, pb, access } = await requireProjectOwner(event, projectId || '')

  const body = await readBody<{
    projectId?: string
    entityId?: string
    factType?: string
    statement?: string
    structuredValue?: Record<string, unknown>
    scopeType?: string
    scopeId?: string
    status?: string
    confidence?: number | null
    sourceType?: string
    sourceId?: string
    actorType?: string
    actorId?: string
  }>(event).catch(() => ({}))

  parseOptionalProjectId(body?.projectId, projectId || '')

  const statement = parseBibleFactStatement(body?.statement)
  const status = parseBibleFactStatus(body?.status, defaultUserAuthoredFactStatus())
  const confidence = parseBibleConfidence(body?.confidence)
  const actorType = parseBibleActorType(body?.actorType)

  const payload: Record<string, unknown> = {
    owned_by: access.ownerId,
    project: projectId,
    statement,
    status
  }

  const entityId = typeof body?.entityId === 'string' ? body.entityId.trim() : ''
  if (entityId) {
    await requireOwnedProjectRow(
      pb,
      userId,
      'bible_entities',
      entityId,
      projectId || '',
      projectIdOnBibleEntityRow,
      'Entity'
    )
    payload.entity = entityId
  }

  if (typeof body?.factType === 'string') {
    payload.fact_type = body.factType.trim().slice(0, 100)
  }
  if (body?.structuredValue !== undefined) {
    const structured = parseBibleStructuredValue(body.structuredValue)
    if (structured) payload.structured_value = structured
  }
  if (body?.scopeType !== undefined) {
    payload.scope_type = parseBibleScopeType(body.scopeType)
  }
  if (typeof body?.scopeId === 'string') {
    payload.scope_id = body.scopeId.trim().slice(0, BIBLE_SOURCE_ID_MAX)
  }
  if (confidence !== null) payload.confidence = confidence
  if (typeof body?.sourceType === 'string') {
    payload.source_type = body.sourceType.trim().slice(0, BIBLE_SOURCE_TYPE_MAX)
  }
  if (typeof body?.sourceId === 'string') {
    payload.source_id = body.sourceId.trim().slice(0, BIBLE_SOURCE_ID_MAX)
  }
  if (actorType) payload.actor_type = actorType
  if (typeof body?.actorId === 'string') {
    payload.actor_id = body.actorId.trim().slice(0, BIBLE_ACTOR_ID_MAX)
  } else if (!body?.sourceType && !actorType) {
    payload.actor_type = 'user'
    payload.actor_id = userId
  }

  try {
    const created = await pb.collection('bible_facts').create(payload)
    return { fact: pbRecordToBibleFact(created as Parameters<typeof pbRecordToBibleFact>[0]) }
  } catch (e: unknown) {
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not create bible fact'
    })
  }
})
