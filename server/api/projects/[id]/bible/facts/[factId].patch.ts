import { createError, getRouterParam, readBody } from 'h3'
import { requireOwnedProjectRow, requireProjectOwner } from '~/server/utils/bible-project-access'
import { pbRecordToBibleFact, projectIdOnBibleFactRow } from '~/server/utils/bible-fact-map'
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
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const factId = getRouterParam(event, 'factId')
  if (!factId) {
    throw createError({ statusCode: 400, message: 'Missing fact id' })
  }

  const { userId, pb } = await requireProjectOwner(event, projectId || '')
  await requireOwnedProjectRow(
    pb,
    userId,
    'bible_facts',
    factId,
    projectId || '',
    projectIdOnBibleFactRow,
    'Fact'
  )

  const body = await readBody<{
    projectId?: string
    entityId?: string | null
    factType?: string
    statement?: string
    structuredValue?: Record<string, unknown> | null
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

  const patch: Record<string, unknown> = {}

  if (body?.entityId !== undefined) {
    if (body.entityId === null || body.entityId === '') {
      patch.entity = null
    } else if (typeof body.entityId === 'string') {
      const entityId = body.entityId.trim()
      await requireOwnedProjectRow(
        pb,
        userId,
        'bible_entities',
        entityId,
        projectId || '',
        projectIdOnBibleEntityRow,
        'Entity'
      )
      patch.entity = entityId
    }
  }
  if (body?.statement !== undefined) {
    patch.statement = parseBibleFactStatement(body.statement)
  }
  if (body?.factType !== undefined && typeof body.factType === 'string') {
    patch.fact_type = body.factType.trim().slice(0, 100)
  }
  if (body?.structuredValue !== undefined) {
    if (body.structuredValue === null) {
      patch.structured_value = null
    } else {
      const structured = parseBibleStructuredValue(body.structuredValue)
      if (structured) patch.structured_value = structured
    }
  }
  if (body?.scopeType !== undefined) {
    patch.scope_type = parseBibleScopeType(body.scopeType)
  }
  if (body?.scopeId !== undefined && typeof body.scopeId === 'string') {
    patch.scope_id = body.scopeId.trim().slice(0, BIBLE_SOURCE_ID_MAX)
  }
  if (body?.status !== undefined) {
    patch.status = parseBibleFactStatus(body.status, 'active')
  }
  if (body?.confidence !== undefined) {
    const confidence = parseBibleConfidence(body.confidence)
    if (confidence !== null) patch.confidence = confidence
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
    const updated = await pb.collection('bible_facts').update(factId, patch)
    return { fact: pbRecordToBibleFact(updated as Parameters<typeof pbRecordToBibleFact>[0]) }
  } catch (e: unknown) {
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not update bible fact'
    })
  }
})
