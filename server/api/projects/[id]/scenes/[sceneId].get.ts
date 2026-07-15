import { createError, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { pbRecordToCreativeScene } from '~/server/utils/creative-scene-map'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const sceneId = getRouterParam(event, 'sceneId')
  if (!projectId || !sceneId) {
    throw createError({ statusCode: 400, message: 'Missing project or scene id' })
  }

  const { pb } = await requireProjectOwner(event, projectId)

  const scene = await pb.collection('creative_scenes').getOne(sceneId)
  const mapped = pbRecordToCreativeScene(scene as Parameters<typeof pbRecordToCreativeScene>[0])
  if (mapped.projectId !== projectId) {
    throw createError({ statusCode: 400, message: 'Scene does not belong to this project' })
  }

  return {
    scene: {
      id: mapped.id,
      sortOrder: mapped.sortOrder,
      heading: mapped.heading,
      summary: mapped.summary,
      body: mapped.body
    }
  }
})
