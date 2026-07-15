import { createError, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { creativeSceneToListItem, pbRecordToCreativeScene } from '~/server/utils/creative-scene-map'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }
  const { pb } = await requireProjectOwner(event, id)

  const filter = `project="${id}"`
  const list = await pb.collection('creative_scenes').getFullList({
    filter,
    sort: 'sort_order',
    batch: 500
  })

  const shotCountBySceneId: Record<string, number> = {}
  try {
    const shotRows = await pb.collection('creative_shots').getFullList({
      filter,
      batch: 5000
    })
    for (const row of shotRows as Array<{ scene?: unknown }>) {
      const sid = typeof row.scene === 'string' ? row.scene : ''
      if (!sid) continue
      shotCountBySceneId[sid] = (shotCountBySceneId[sid] || 0) + 1
    }
  } catch {
    // If creative_shots is missing/unreadable, still return scenes with zero counts.
  }

  return {
    scenes: list.map(s => {
      const mapped = pbRecordToCreativeScene(s as Parameters<typeof pbRecordToCreativeScene>[0])
      return creativeSceneToListItem(mapped, { shotCount: shotCountBySceneId[mapped.id] || 0 })
    })
  }
})
