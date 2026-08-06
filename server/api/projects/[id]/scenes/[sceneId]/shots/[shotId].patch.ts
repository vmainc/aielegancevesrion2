import { createError, getRouterParam, readBody } from 'h3'
import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { pbRecordToCreativeShot } from '~/server/utils/creative-shot-map'
import { syncProjectToBibleSafe } from '~/server/utils/sync-project-to-bible'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const sceneId = getRouterParam(event, 'sceneId')
  const shotId = getRouterParam(event, 'shotId')
  if (!projectId || !sceneId || !shotId) {
    throw createError({ statusCode: 400, message: 'Missing ids' })
  }
  const body = await readBody(event).catch(() => null) as Record<string, unknown> | null

  const { pb, access } = await requireProjectOwner(event, projectId)

  const existing = await pb.collection('creative_shots').getOne(shotId)
  const sp =
    typeof existing.project === 'string' ? existing.project : (existing.project as { id?: string })?.id
  const ss =
    typeof existing.scene === 'string' ? existing.scene : (existing.scene as { id?: string })?.id
  if (sp !== projectId || ss !== sceneId) {
    throw createError({ statusCode: 400, message: 'Shot does not match project/scene' })
  }

  const patch: Record<string, unknown> = {}
  if (body && typeof body === 'object') {
    if (typeof body.title === 'string') patch.title = body.title.slice(0, 500)
    if (typeof body.description === 'string') patch.description = body.description.slice(0, 10000)
    if (typeof body.shotType === 'string') patch.shot_type = body.shotType.slice(0, 300)
    if (typeof body.cameraMove === 'string') patch.camera_move = body.cameraMove.slice(0, 300)
    if (typeof body.durationSeconds === 'number' && Number.isFinite(body.durationSeconds)) {
      patch.duration_seconds = snapToStoryboardClipSeconds(body.durationSeconds)
    }
    if (typeof body.imagePrompt === 'string') patch.image_prompt = body.imagePrompt.slice(0, 20000)
    if (typeof body.videoPrompt === 'string') patch.video_prompt = body.videoPrompt.slice(0, 20000)
    if (typeof body.negativePrompt === 'string') {
      patch.negative_prompt = body.negativePrompt.slice(0, 10000)
    }
    if (typeof body.sortOrder === 'number' && Number.isInteger(body.sortOrder) && body.sortOrder >= 0) {
      patch.sort_order = body.sortOrder
    }
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, message: 'No valid fields to update' })
  }

  const updated = await pb.collection('creative_shots').update(shotId, patch)
  await syncProjectToBibleSafe({
    pb,
    userId: access.ownerId,
    projectId,
    scopes: ['shots']
  })
  return { shot: pbRecordToCreativeShot(updated as Parameters<typeof pbRecordToCreativeShot>[0]) }
})
