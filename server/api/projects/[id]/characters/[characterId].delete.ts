import { createError, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import { projectIdOnCharacterRow } from '~/server/utils/creative-character-map'
import { syncProjectToBibleSafe } from '~/server/utils/sync-project-to-bible'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const characterId = getRouterParam(event, 'characterId')
  if (!projectId || !characterId) {
    throw createError({ statusCode: 400, message: 'Missing project or character id' })
  }

  const { pb, access } = await requireProjectOwner(event, projectId)

  const existing = await pb.collection('creative_characters').getOne(characterId)
  const row = existing as Record<string, unknown>
  if (projectIdOnCharacterRow(row) !== projectId) {
    throw createError({ statusCode: 403, message: 'Character does not belong to this project' })
  }

  await pb.collection('creative_characters').delete(characterId)
  await syncProjectToBibleSafe({
    pb,
    userId: access.ownerId,
    projectId,
    scopes: ['characters', 'scenes'],
    retireCharacterIds: [characterId]
  })
  return { ok: true }
})
