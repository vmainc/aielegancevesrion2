import { createError, getRouterParam } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordOwnerId } from '~/server/utils/pb-record-owner'
import type { CreativeCharacter } from '~/types/creative-project'

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

  const rows = await pb.collection('creative_characters').getFullList({
    filter: `project="${id}"`,
    batch: 200
  })

  rows.sort((a, b) => {
    const ra = a as Record<string, unknown>
    const rb = b as Record<string, unknown>
    const pa = typeof ra.screen_share_percent === 'number' ? ra.screen_share_percent : Number(ra.screen_share_percent)
    const pb = typeof rb.screen_share_percent === 'number' ? rb.screen_share_percent : Number(rb.screen_share_percent)
    const na = Number.isFinite(pa) ? pa : -1
    const nb = Number.isFinite(pb) ? pb : -1
    if (nb !== na) return nb - na
    return String(ra.name || '').localeCompare(String(rb.name || ''))
  })

  const characters: CreativeCharacter[] = rows.map((r) => {
    const raw = r as Record<string, unknown>
    const pct = raw.screen_share_percent
    const n = typeof pct === 'number' ? pct : Number(pct)
    return {
      id: String(raw.id),
      name: String(raw.name || ''),
      roleDescription: String(raw.role_description || ''),
      screenSharePercent: Number.isFinite(n) ? Math.round(n * 100) / 100 : null
    }
  })

  return { characters }
})
