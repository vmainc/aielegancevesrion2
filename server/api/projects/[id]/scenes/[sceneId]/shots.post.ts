import { createError, getRouterParam, readBody } from 'h3'
import { snapToStoryboardClipSeconds } from '~/lib/storyboard-video-duration'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { createSceneShot } from '~/server/utils/persist-scene-shots'
import { projectIdOnSceneRow } from '~/server/utils/creative-scene-map'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const sceneId = getRouterParam(event, 'sceneId')
  if (!projectId || !sceneId) {
    throw createError({ statusCode: 400, message: 'Missing ids' })
  }
  const { pb, access } = await requireProjectOwner(event, projectId)
  const body = await readBody(event).catch(() => null) as Record<string, unknown> | null

  const scene = await pb.collection('creative_scenes').getOne(sceneId)
  if (projectIdOnSceneRow(scene as Record<string, unknown>) !== projectId) {
    throw createError({ statusCode: 400, message: 'Scene does not belong to this project' })
  }

  const durationRaw =
    body && typeof body.durationSeconds === 'number' && Number.isFinite(body.durationSeconds)
      ? body.durationSeconds
      : 5

  try {
    const shot = await createSceneShot(pb, access.ownerId, projectId, sceneId, {
      title: typeof body?.title === 'string' ? body.title : undefined,
      description: typeof body?.description === 'string' ? body.description : undefined,
      shot_type: typeof body?.shotType === 'string' ? body.shotType : undefined,
      camera_move: typeof body?.cameraMove === 'string' ? body.cameraMove : undefined,
      duration_seconds: snapToStoryboardClipSeconds(durationRaw),
      image_prompt: typeof body?.imagePrompt === 'string' ? body.imagePrompt : undefined,
      video_prompt: typeof body?.videoPrompt === 'string' ? body.videoPrompt : undefined,
      negative_prompt: typeof body?.negativePrompt === 'string' ? body.negativePrompt : undefined
    })
    return { shot }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/forbidden/i.test(msg)) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
    throw createError({ statusCode: 400, message: msg || 'Could not add board' })
  }
})
