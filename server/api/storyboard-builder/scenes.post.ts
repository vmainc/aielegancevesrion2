import { createError, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'
import { getOrCreateStoryboardBuilderProjectId } from '~/server/utils/get-or-create-storyboard-builder-project'
import { createSceneShot } from '~/server/utils/persist-scene-shots'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const body = await readBody<{
    heading?: string
    title?: string
    summary?: string
    description?: string
  }>(event)

  const headingRaw =
    typeof body?.heading === 'string'
      ? body.heading
      : typeof body?.title === 'string'
        ? body.title
        : ''
  const heading = headingRaw.trim().slice(0, 2000) || 'Untitled scene'
  const desc =
    typeof body?.description === 'string'
      ? body.description.trim()
      : typeof body?.summary === 'string'
        ? body.summary.trim()
        : ''
  const summary = desc.slice(0, 5000)

  const pb = await getAuthenticatedPocketBase()
  const projectId = await getOrCreateStoryboardBuilderProjectId(pb, userId)

  const top = await pb.collection('creative_scenes').getFullList({
    filter: `project="${projectId}"`,
    sort: '-sort_order',
    batch: 1
  })
  let nextOrder = 1
  if (top.length) {
    const prev = Number(top[0]!.sort_order)
    const base = Number.isFinite(prev) ? Math.max(0, Math.floor(prev)) : 0
    nextOrder = base + 1
  }

  let sceneId: string
  try {
    const created = await pb.collection('creative_scenes').create({
      owned_by: userId,
      project: projectId,
      sort_order: nextOrder,
      heading,
      summary,
      body: summary
    })
    sceneId = created.id
  } catch (e: unknown) {
    const detail = formatPocketBaseRecordError(e)
    throw createError({
      statusCode: 400,
      message: detail && detail !== 'Failed to create record.' ? detail : 'Could not create scene.'
    })
  }

  const shot = await createSceneShot(pb, userId, projectId, sceneId, {
    title: 'Board 1'
  })

  return {
    projectId,
    scene: {
      id: sceneId,
      sortOrder: nextOrder,
      heading,
      summary,
      shotCount: 1
    },
    shot
  }
})
