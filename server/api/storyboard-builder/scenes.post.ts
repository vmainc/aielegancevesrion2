import { createError, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'
import { getOrCreateStoryboardBuilderProjectId } from '~/server/utils/get-or-create-storyboard-builder-project'
import { createSceneShot } from '~/server/utils/persist-scene-shots'
import {
  creativeSceneToListItem,
  nextCreativeSceneSortOrder,
  normalizeCreativeSceneForPb,
  pbRecordToCreativeScene
} from '~/server/utils/creative-scene-map'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody<{
    heading?: string
    title?: string
    summary?: string
    description?: string
  }>(event)

  const pb = await getAuthenticatedPocketBase()
  const projectId = await getOrCreateStoryboardBuilderProjectId(pb, userId)
  const normalized = normalizeCreativeSceneForPb(0, {
    title: 'Untitled scene',
    ...(body || {})
  })
  const nextOrder = await nextCreativeSceneSortOrder(pb, projectId)

  let sceneListItem: ReturnType<typeof creativeSceneToListItem> | null = null
  try {
    const created = await pb.collection('creative_scenes').create({
      owned_by: userId,
      project: projectId,
      sort_order: nextOrder,
      heading: normalized.heading,
      summary: normalized.summary,
      body: normalized.body
    })
    const mapped = pbRecordToCreativeScene(created as Parameters<typeof pbRecordToCreativeScene>[0])
    sceneListItem = creativeSceneToListItem(mapped, { shotCount: 1 })
  } catch (e: unknown) {
    const detail = formatPocketBaseRecordError(e)
    throw createError({
      statusCode: 400,
      message: detail && detail !== 'Failed to create record.' ? detail : 'Could not create scene.'
    })
  }

  if (!sceneListItem) {
    throw createError({ statusCode: 500, message: 'Scene was created but could not be mapped.' })
  }
  const shot = await createSceneShot(pb, userId, projectId, sceneListItem.id, {
    title: 'Board 1'
  })

  return {
    projectId,
    scene: sceneListItem,
    shot
  }
})
