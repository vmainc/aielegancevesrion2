import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { projectIdOnSceneRow } from '~/server/utils/creative-scene-map'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const sceneId = getRouterParam(event, 'sceneId')
  if (!projectId || !sceneId) {
    throw createError({ statusCode: 400, message: 'Missing ids' })
  }

  const body = await readBody(event).catch(() => null) as { orderedShotIds?: unknown } | null
  const orderedShotIds = Array.isArray(body?.orderedShotIds)
    ? body!.orderedShotIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : []

  if (!orderedShotIds.length) {
    throw createError({ statusCode: 400, message: 'orderedShotIds must be a non-empty array' })
  }

  const { pb } = await requireProjectOwner(event, projectId)

  const scene = await pb.collection('creative_scenes').getOne(sceneId)
  if (projectIdOnSceneRow(scene as Record<string, unknown>) !== projectId) {
    throw createError({ statusCode: 400, message: 'Scene does not belong to this project' })
  }

  const existing = await pb.collection('creative_shots').getFullList({
    filter: `scene="${sceneId}"`,
    batch: 500
  })

  const existingIds = new Set(existing.map(r => String(r.id)))
  if (orderedShotIds.length !== existing.length) {
    throw createError({
      statusCode: 400,
      message: 'orderedShotIds must include every board in this scene'
    })
  }

  for (const id of orderedShotIds) {
    if (!existingIds.has(id)) {
      throw createError({ statusCode: 400, message: 'Invalid shot id in orderedShotIds' })
    }
  }

  await Promise.all(
    orderedShotIds.map((shotId, index) =>
      pb.collection('creative_shots').update(shotId, { sort_order: index + 1 })
    )
  )

  return { ok: true }
})
