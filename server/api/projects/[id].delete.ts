import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const existing = await pb.collection('creative_projects').getOne(id)
  const owner = pbRecordOwnerId(existing as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const filter = `project="${id}"`
  try {
    const shots = await pb.collection('creative_shots').getFullList({ filter, batch: 500 })
    for (const sh of shots) {
      await pb.collection('creative_shots').delete(sh.id)
    }
  } catch {
    /* creative_shots may not exist */
  }
  const scenes = await pb.collection('creative_scenes').getFullList({ filter, batch: 500 })
  const chars = await pb.collection('creative_characters').getFullList({ filter, batch: 500 })
  for (const s of scenes) {
    await pb.collection('creative_scenes').delete(s.id)
  }
  for (const c of chars) {
    await pb.collection('creative_characters').delete(c.id)
  }
  await pb.collection('creative_projects').delete(id)

  return { ok: true }
})
