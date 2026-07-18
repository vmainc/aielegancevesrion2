import { createError, getQuery, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { buildVideoPanelPrefill } from '~/server/utils/project-video-panel-prefill'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const query = getQuery(event)
  const sceneId = typeof query.sceneId === 'string' ? query.sceneId.trim() : ''
  const shotId = typeof query.shotId === 'string' ? query.shotId.trim() : ''

  if (!projectId || !sceneId || !shotId) {
    throw createError({ statusCode: 400, message: 'Missing project, scene, or shot id' })
  }

  const { userId, pb } = await requireProjectOwner(event, projectId)

  const characterIds =
    query.characterIds !== undefined
      ? (typeof query.characterIds === 'string' ? query.characterIds : '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined

  return buildVideoPanelPrefill({
    pb,
    userId,
    projectId,
    sceneId,
    shotId,
    characterIds
  })
})
