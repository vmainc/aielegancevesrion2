import { createError, getRouterParam } from 'h3'
import { requireOwnedProjectRow, requireProjectOwner } from '~/server/utils/bible-project-access'
import { projectIdOnBibleFactRow } from '~/server/utils/bible-fact-map'

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

  await pb.collection('bible_facts').delete(factId)
  return { ok: true }
})
