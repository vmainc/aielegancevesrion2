import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeShot } from '~/server/utils/creative-shot-map'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const sceneId = getRouterParam(event, 'sceneId')
  if (!projectId || !sceneId) {
    throw createError({ statusCode: 400, message: 'Missing project or scene id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  const owner = typeof project.user === 'string' ? project.user : (project.user as { id?: string })?.id
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const scene = await pb.collection('creative_scenes').getOne(sceneId)
  const sceneProject =
    typeof scene.project === 'string' ? scene.project : (scene.project as { id?: string })?.id
  if (sceneProject !== projectId) {
    throw createError({ statusCode: 400, message: 'Scene does not belong to this project' })
  }

  const filter = `scene="${sceneId}"`
  const list = await pb.collection('creative_shots').getFullList({
    filter,
    sort: 'sort_order',
    batch: 200
  })

  const shots = list.map(r => pbRecordToCreativeShot(r as Parameters<typeof pbRecordToCreativeShot>[0]))
  return { shots }
})
