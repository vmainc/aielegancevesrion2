import { createError, getRouterParam, readBody } from 'h3'
import {
  canEnterStage,
  computeProductionSummary,
  defaultProductionChecklist,
  parseAdaptState,
  validateAdaptSourceText
} from '~/lib/adapt-to-film'
import type { AdaptStage, AdaptToFilmState } from '~/types/adapt-to-film'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { loadAdaptState, saveAdaptState } from '~/server/utils/adapt-to-film-state'
import { checkRateLimit, rateLimitKey } from '~/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing project id' })

  const { userId, pb } = await requireProjectOwner(event, id)
  checkRateLimit(rateLimitKey(userId, 'adapt-to-film-save'), 40, 60_000)

  const body = await readBody<{ adapt?: unknown; stage?: string }>(event)
  const { state: current } = await loadAdaptState(pb, id)

  let next: AdaptToFilmState = current
  if (body?.adapt != null) {
    const parsed = parseAdaptState(body.adapt)
    if (!parsed) {
      throw createError({ statusCode: 400, message: 'Invalid adapt state payload.' })
    }
    // Preserve immutable original unless still empty
    const originalSourceText =
      current.originalSourceText.trim() || parsed.originalSourceText
    next = {
      ...parsed,
      originalSourceText,
      workingSourceText: parsed.workingSourceText || originalSourceText
    }
  }

  if (typeof body?.stage === 'string') {
    const stage = body.stage as AdaptStage
    const block = canEnterStage(next, stage)
    if (block) throw createError({ statusCode: 400, message: block })
    next = { ...next, stage }
  }

  if (next.stage !== 'source') {
    const err = validateAdaptSourceText(next.workingSourceText || next.originalSourceText)
    if (err) throw createError({ statusCode: 400, message: err })
  }

  if (!next.checklist.length && next.stage === 'production') {
    next = { ...next, checklist: defaultProductionChecklist(next) }
  }

  const saved = await saveAdaptState(pb, id, next)
  return {
    adapt: saved,
    summary: computeProductionSummary(saved)
  }
})
