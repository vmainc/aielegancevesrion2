import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const record = await pb.collection('creative_projects').getOne(id)
  const owner = pbRecordOwnerId(record as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  let sceneCount = 0
  let characterCount = 0
  try {
    const filter = `project="${id}"`
    const [scenesPage, charsPage] = await Promise.all([
      pb.collection('creative_scenes').getList(1, 1, { filter }),
      pb.collection('creative_characters').getList(1, 1, { filter })
    ])
    sceneCount = scenesPage.totalItems
    characterCount = charsPage.totalItems
  } catch {
    /* collections may not exist yet */
  }

  return {
    project: pbRecordToCreativeProject(record as Parameters<typeof pbRecordToCreativeProject>[0]),
    stats: { sceneCount, characterCount }
  }
})
