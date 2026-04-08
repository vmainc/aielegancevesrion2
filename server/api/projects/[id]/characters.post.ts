import { createError, getRouterParam, readBody } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeCharacter } from '~/server/utils/creative-character-map'
import { formatPocketBaseRecordError } from '~/server/utils/pb-missing-collection-error'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'

function clampPct (v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100))
}

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }

  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  const project = await pb.collection('creative_projects').getOne(projectId)
  if (pbRecordOwnerId(project as { owner?: unknown; user?: unknown }) !== userId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const body = await readBody<{
    name?: string
    roleDescription?: string
    screenSharePercent?: number | null
  }>(event).catch(() => ({}))

  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 200) : ''
  if (!name) {
    throw createError({ statusCode: 400, message: 'Name is required' })
  }

  const roleDescription =
    typeof body?.roleDescription === 'string' ? body.roleDescription.trim().slice(0, 10000) : ''
  const screenSharePercent = clampPct(body?.screenSharePercent)

  const payload: Record<string, unknown> = {
    owned_by: userId,
    project: projectId,
    name,
    role_description: roleDescription
  }
  if (screenSharePercent !== null) {
    payload.screen_share_percent = screenSharePercent
  }

  try {
    const created = await pb.collection('creative_characters').create(payload)
    return { character: pbRecordToCreativeCharacter(created as Record<string, unknown>) }
  } catch (e: unknown) {
    throw createError({
      statusCode: 400,
      message: formatPocketBaseRecordError(e) || 'Could not create character'
    })
  }
})
