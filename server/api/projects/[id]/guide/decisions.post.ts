import { createError, getRouterParam, readBody } from 'h3'
import type { CreativeDecisionCreateInput, CreativeDecisionTargetType } from '~/types/creative-decision'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import {
  creativeDecisionInputToPbFields,
  pbRecordToCreativeDecision
} from '~/server/utils/creative-decision-map'
import { isPocketBaseMissingCollectionError } from '~/server/utils/pb-missing-collection-error'

const TARGET_TYPES = new Set<CreativeDecisionTargetType>(['project', 'director', 'character'])

function parseDecision (raw: unknown): CreativeDecisionCreateInput | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as CreativeDecisionCreateInput
  if (typeof d.sourceType !== 'string' || !d.sourceType.trim()) return null
  if (typeof d.targetType !== 'string' || !TARGET_TYPES.has(d.targetType)) return null
  if (typeof d.targetId !== 'string' || !d.targetId.trim()) return null
  if (typeof d.field !== 'string' || !d.field.trim()) return null
  if (typeof d.newValue !== 'string') return null
  return {
    sourceType: d.sourceType.trim(),
    sourceId: typeof d.sourceId === 'string' ? d.sourceId.trim() : '',
    targetType: d.targetType,
    targetId: d.targetId.trim(),
    field: d.field.trim(),
    oldValue: typeof d.oldValue === 'string' ? d.oldValue : '',
    newValue: d.newValue,
    rationale: typeof d.rationale === 'string' ? d.rationale : '',
    status: d.status === 'rejected' || d.status === 'superseded' ? d.status : 'applied'
  }
}

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { userId, pb, access } = await requireProjectOwner(event, projectId || '')

  const body = await readBody<{ decision?: unknown }>(event)
  const decision = parseDecision(body?.decision)
  if (!decision) {
    throw createError({ statusCode: 400, message: 'Invalid decision payload' })
  }

  try {
    const fields = creativeDecisionInputToPbFields({
      ownerId: access.ownerId,
      projectId: projectId || '',
      actorType: 'user',
      actorId: userId,
      decision
    })
    const created = await pb.collection('creative_decisions').create(fields)
    return {
      decision: pbRecordToCreativeDecision(created as Record<string, unknown>)
    }
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'creative_decisions collection is missing. Run npm run setup-db.'
      })
    }
    throw e
  }
})
