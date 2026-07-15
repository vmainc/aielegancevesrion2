import { createError, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const { pb, access } = await requireProjectOwner(event, id)

  const record = await pb.collection('creative_projects').getOne(id)

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
    project: pbRecordToCreativeProject(
      record as Parameters<typeof pbRecordToCreativeProject>[0],
      { accessRole: access.role }
    ),
    stats: { sceneCount, characterCount }
  }
})
