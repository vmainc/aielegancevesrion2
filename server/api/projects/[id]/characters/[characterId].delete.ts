import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { projectIdOnCharacterRow } from '~/server/utils/creative-character-map'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  const characterId = getRouterParam(event, 'characterId')
  if (!projectId || !characterId) {
    throw createError({ statusCode: 400, message: 'Missing project or character id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  if (pbRecordOwnerId(project as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const existing = await pb.collection('creative_characters').getOne(characterId)
  const row = existing as Record<string, unknown>
  if (projectIdOnCharacterRow(row) !== projectId) {
    throw createError({ statusCode: 403, message: 'Character does not belong to this project' })
  }
  if (pbRecordOwnerId(existing as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  await pb.collection('creative_characters').delete(characterId)
  return { ok: true }
})
