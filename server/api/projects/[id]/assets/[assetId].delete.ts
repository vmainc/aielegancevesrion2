import { createError, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const assetId = getRouterParam(event, 'assetId')
  if (!projectId || !assetId) {
    throw createError({ statusCode: 400, message: 'Missing project or asset id' })
  }
  const { pb } = await requireProjectOwner(event, projectId)

  const existing = await pb.collection('project_assets').getOne(assetId)
  const p = typeof existing.project === 'string' ? existing.project : (existing.project as { id?: string })?.id
  if (p !== projectId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  await pb.collection('project_assets').delete(assetId)
  return { ok: true }
})
