import { createError, getRouterParam } from 'h3'
import { requireProjectOwnerOnly } from '~/server/utils/bible-project-access'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const { pb } = await requireProjectOwnerOnly(event, id)

  const filter = `project="${id}"`
  try {
    const shots = await pb.collection('creative_shots').getFullList({ filter, batch: 500 })
    for (const sh of shots) {
      await pb.collection('creative_shots').delete(sh.id)
    }
  } catch {
    /* creative_shots may not exist */
  }

  try {
    const members = await pb.collection('project_members').getFullList({ filter: `project = "${id}"`, batch: 200 })
    for (const m of members) {
      await pb.collection('project_members').delete(m.id)
    }
  } catch {
    /* project_members may not exist */
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
