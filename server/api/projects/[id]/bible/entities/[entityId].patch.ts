import { createError, getRouterParam, readBody } from 'h3'
import { requireOwnedProjectRow, requireProjectOwner } from '~/server/utils/bible-project-access'
import { pbRecordToBibleEntity, projectIdOnBibleEntityRow } from '~/server/utils/bible-entity-map'
import {
  BIBLE_ENTITY_DESCRIPTION_MAX,
  BIBLE_ENTITY_SLUG_MAX,
  BIBLE_ENTITY_SUMMARY_MAX,
  BIBLE_SOURCE_ID_MAX,
  BIBLE_SOURCE_TYPE_MAX,
  BIBLE_ACTOR_ID_MAX,
  parseBibleActorType,
  parseBibleAliases,
  parseBibleConfidence,
  parseBibleEntityStatus,
  parseBibleEntityType,
  parseBibleName,
  parseOptionalProjectId
} from '~/server/utils/bible-validation'
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'

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

  const body = await readBody<{
    projectId?: string
    type?: string
    entityType?: string
    name?: string
    slug?: string
    aliases?: string[]
    summary?: string
    description?: string
    status?: string
    confidence?: number | null
    sourceType?: string
    sourceId?: string
    actorType?: string
    actorId?: string
  }>(event).catch(() => ({}))

  parseOptionalProjectId(body?.projectId, projectId || '')

  const patch: Record<string, unknown> = {}

  if (body?.type !== undefined || body?.entityType !== undefined) {
    patch.entity_type = parseBibleEntityType(body.type || body.entityType)
  }
  if (body?.name !== undefined) {
    patch.name = parseBibleName(body.name)
  }
  if (body?.slug !== undefined && typeof body.slug === 'string') {
    patch.slug = body.slug.trim().slice(0, BIBLE_ENTITY_SLUG_MAX)
  }
  if (body?.aliases !== undefined) {
    patch.aliases = parseBibleAliases(body.aliases)
  }
  if (body?.summary !== undefined && typeof body.summary === 'string') {
    patch.summary = body.summary.trim().slice(0, BIBLE_ENTITY_SUMMARY_MAX)
  }
  if (body?.description !== undefined && typeof body.description === 'string') {
    patch.description = body.description.trim().slice(0, BIBLE_ENTITY_DESCRIPTION_MAX)
  }
  if (body?.status !== undefined) {
    patch.status = parseBibleEntityStatus(body.status, 'active')
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
    const updated = await pb.collection('bible_entities').update(entityId, patch)
    return { entity: pbRecordToBibleEntity(updated as Parameters<typeof pbRecordToBibleEntity>[0]) }
  } catch (e: unknown) {
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not update bible entity'
    })
  }
})
