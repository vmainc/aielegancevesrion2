import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import {
  creativeSceneToListItem,
  nextCreativeSceneSortOrder,
  normalizeCreativeSceneForPb,
  pbRecordToCreativeScene
} from '~/server/utils/creative-scene-map'
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const { pb, access } = await requireProjectOwner(event, projectId)

  const body = await readBody<{
    heading?: string
    title?: string
    summary?: string
    description?: string
    body?: string
  }>(event)

  if (!body?.heading?.trim() && !body?.title?.trim()) {
    throw createError({ statusCode: 400, message: 'Title is required' })
  }
  const normalized = normalizeCreativeSceneForPb(0, body || {})
  const nextOrder = await nextCreativeSceneSortOrder(pb, projectId)

  try {
    const created = await pb.collection('creative_scenes').create({
      owned_by: access.ownerId,
      project: projectId,
      sort_order: nextOrder,
      heading: normalized.heading,
      summary: normalized.summary,
      body: normalized.body
    })
    const scene = pbRecordToCreativeScene(created as Parameters<typeof pbRecordToCreativeScene>[0])
    return {
      scene: creativeSceneToListItem(scene)
    }
  } catch (e: unknown) {
    const detail = formatPocketBaseRecordError(e)
    throw createError({
      statusCode: 400,
      message: detail && detail !== 'Failed to create record.' ? detail : 'Could not create scene. Check PocketBase creative_scenes rules and field limits.'
    })
  }
})
