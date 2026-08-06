import { createError, getRouterParam, readBody } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import {
  CREATIVE_SCENE_BODY_MAX,
  CREATIVE_SCENE_HEADING_MAX,
  CREATIVE_SCENE_SUMMARY_MAX,
  creativeSceneToListItem,
  pbRecordToCreativeScene,
  projectIdOnSceneRow
} from '~/server/utils/creative-scene-map'
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'
import { syncProjectToBibleSafe } from '~/server/utils/sync-project-to-bible'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const sceneId = getRouterParam(event, 'sceneId')
  if (!projectId || !sceneId) {
    throw createError({ statusCode: 400, message: 'Missing project or scene id' })
  }

  const { pb, access } = await requireProjectOwner(event, projectId)

  const existing = await pb.collection('creative_scenes').getOne(sceneId)
  const sid = projectIdOnSceneRow(existing as Record<string, unknown>)
  if (sid !== projectId) {
    throw createError({ statusCode: 400, message: 'Scene does not belong to this project' })
  }

  const body = await readBody<{
    heading?: string
    summary?: string
    body?: string
  }>(event).catch(() => ({}))

  const patch: Record<string, unknown> = {}

  if (body && typeof body.heading === 'string') {
    const heading = body.heading.trim().slice(0, CREATIVE_SCENE_HEADING_MAX)
    if (!heading) {
      throw createError({ statusCode: 400, message: 'Heading cannot be empty' })
    }
    patch.heading = heading
  }

  if (body && typeof body.summary === 'string') {
    patch.summary = body.summary.trim().slice(0, CREATIVE_SCENE_SUMMARY_MAX)
  }

  if (body && typeof body.body === 'string') {
    patch.body = body.body.trim().slice(0, CREATIVE_SCENE_BODY_MAX)
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  try {
    const updated = await pb.collection('creative_scenes').update(sceneId, patch)
    const scene = pbRecordToCreativeScene(updated as Parameters<typeof pbRecordToCreativeScene>[0])
    await syncProjectToBibleSafe({
      pb,
      userId: access.ownerId,
      projectId,
      scopes: ['scenes', 'characters']
    })
    return {
      scene: {
        ...creativeSceneToListItem(scene),
        body: scene.body
      }
    }
  } catch (e: unknown) {
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not update scene'
    })
  }
})
