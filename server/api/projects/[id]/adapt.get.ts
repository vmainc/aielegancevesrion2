import { createError, getRouterParam } from 'h3'
import { computeProductionSummary } from '~/lib/adapt-to-film'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { loadAdaptState } from '~/server/utils/adapt-to-film-state'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing project id' })

  const { pb } = await requireProjectOwner(event, id)
  const { state } = await loadAdaptState(pb, id)
  return {
    adapt: state,
    summary: computeProductionSummary(state)
  }
})
