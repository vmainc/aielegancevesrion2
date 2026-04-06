import { createError, getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import { pbRecordToCreativeShot } from '~/server/utils/creative-shot-map'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const sceneId = getRouterParam(event, 'sceneId')
  const shotId = getRouterParam(event, 'shotId')
  if (!projectId || !sceneId || !shotId) {
    throw createError({ statusCode: 400, message: 'Missing ids' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody(event).catch(() => null) as Record<string, unknown> | null

  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  const owner = pbRecordOwnerId(project as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const existing = await pb.collection('creative_shots').getOne(shotId)
  const shotUser = pbRecordOwnerId(existing as { owner?: unknown; user?: unknown })
  if (shotUser !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
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
      patch.duration_seconds = Math.min(120, Math.max(0.5, body.durationSeconds))
    }
    if (typeof body.imagePrompt === 'string') patch.image_prompt = body.imagePrompt.slice(0, 20000)
    if (typeof body.videoPrompt === 'string') patch.video_prompt = body.videoPrompt.slice(0, 20000)
    if (typeof body.sortOrder === 'number' && Number.isInteger(body.sortOrder) && body.sortOrder >= 0) {
      patch.sort_order = body.sortOrder
    }
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, message: 'No valid fields to update' })
  }

  const updated = await pb.collection('creative_shots').update(shotId, patch)
  return { shot: pbRecordToCreativeShot(updated as Parameters<typeof pbRecordToCreativeShot>[0]) }
})
