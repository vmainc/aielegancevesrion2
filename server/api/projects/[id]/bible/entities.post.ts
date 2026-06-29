import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { pbRecordToBibleEntity } from '~/server/utils/bible-entity-map'
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
  const { userId, pb } = await requireProjectOwner(event, projectId || '')

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

  const entityType = parseBibleEntityType(body?.type || body?.entityType)
  const name = parseBibleName(body?.name)
  const status = parseBibleEntityStatus(body?.status)
  const confidence = parseBibleConfidence(body?.confidence)
  const actorType = parseBibleActorType(body?.actorType)

  const payload: Record<string, unknown> = {
    owned_by: userId,
    project: projectId,
    entity_type: entityType,
    name,
    status
  }

  if (typeof body?.slug === 'string') {
    payload.slug = body.slug.trim().slice(0, BIBLE_ENTITY_SLUG_MAX)
  }
  if (body?.aliases !== undefined) {
    payload.aliases = parseBibleAliases(body.aliases)
  }
  if (typeof body?.summary === 'string') {
    payload.summary = body.summary.trim().slice(0, BIBLE_ENTITY_SUMMARY_MAX)
  }
  if (typeof body?.description === 'string') {
    payload.description = body.description.trim().slice(0, BIBLE_ENTITY_DESCRIPTION_MAX)
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
  }

  try {
    const created = await pb.collection('bible_entities').create(payload)
    return { entity: pbRecordToBibleEntity(created as Parameters<typeof pbRecordToBibleEntity>[0]) }
  } catch (e: unknown) {
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not create bible entity'
    })
  }
})
