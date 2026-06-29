import { createError, getQuery, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { resolveProductionBibleContext } from '~/server/utils/resolve-production-bible-context'

function parseCsvIds (value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const { pb } = await requireProjectOwner(event, projectId || '')

  const query = getQuery(event)
  const sceneId = typeof query.sceneId === 'string' ? query.sceneId.trim() : ''
  const shotId = typeof query.shotId === 'string' ? query.shotId.trim() : ''
  const characterIds = parseCsvIds(query.characterIds)
  const entityIds = parseCsvIds(query.entityIds)
  const maxItemsRaw = typeof query.maxItems === 'string' ? Number(query.maxItems) : NaN
  const tokenBudgetRaw = typeof query.tokenBudget === 'string' ? Number(query.tokenBudget) : NaN
  const includeReviewFacts =
    query.includeReviewFacts === 'true' ||
    query.includeReviewFacts === '1' ||
    query.debugReview === 'true' ||
    query.debugReview === '1'

  try {
    const context = await resolveProductionBibleContext(pb, projectId || '', {
      sceneId: sceneId || undefined,
      shotId: shotId || undefined,
      characterIds: characterIds.length ? characterIds : undefined,
      entityIds: entityIds.length ? entityIds : undefined,
      maxItems: Number.isFinite(maxItemsRaw) ? Math.min(50, Math.max(1, maxItemsRaw)) : undefined,
      tokenBudget: Number.isFinite(tokenBudgetRaw) ? Math.min(4000, Math.max(200, tokenBudgetRaw)) : undefined,
      includeReviewFacts
    })
    return { context }
  } catch (e: unknown) {
    throw createError({
      statusCode: 400,
      message: e instanceof Error ? e.message : 'Could not resolve Production Bible context'
    })
  }
})
