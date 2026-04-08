import { createError, getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import {
  pbRecordToCreativeCharacter,
  projectIdOnCharacterRow
} from '~/server/utils/creative-character-map'
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

function clampPct (v: unknown): number | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100))
}

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
  const owner = pbRecordOwnerId(existing as { owner?: unknown; user?: unknown })
  if (owner !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const body = await readBody<{
    name?: string
    roleDescription?: string
    screenSharePercent?: number | null
  }>(event).catch(() => ({}))

  const patch: Record<string, unknown> = {}

  if (body && typeof body.name === 'string') {
    const name = body.name.trim().slice(0, 200)
    if (!name) {
      throw createError({ statusCode: 400, message: 'Name cannot be empty' })
    }
    patch.name = name
  }

  if (body && typeof body.roleDescription === 'string') {
    patch.role_description = body.roleDescription.trim().slice(0, 10000)
  }

  if (body && 'screenSharePercent' in body) {
    const p = clampPct(body.screenSharePercent)
    if (p === null) {
      patch.screen_share_percent = null
    } else if (p !== undefined) {
      patch.screen_share_percent = p
    }
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  try {
    const updated = await pb.collection('creative_characters').update(characterId, patch)
    return { character: pbRecordToCreativeCharacter(updated as Record<string, unknown>) }
  } catch (e: unknown) {
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not update character'
    })
  }
})
