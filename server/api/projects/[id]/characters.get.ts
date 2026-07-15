import { createError, getRouterParam } from 'h3'
import { requireProjectOwner } from '~/server/utils/bible-project-access'
import {
  pbRecordToCreativeCharacter,
  projectIdOnCharacterRow
} from '~/server/utils/creative-character-map'
import { isPocketBaseMissingCollectionError, pocketBaseErrorStatus } from '~/server/utils/pb-missing-collection-error'
import type { CreativeCharacter } from '~/types/creative-project'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing project id' })
  }
  const { pb, access } = await requireProjectOwner(event, id)

  let rows: unknown[]
  try {
    rows = await pb.collection('creative_characters').getFullList({
      filter: `project="${id}"`,
      batch: 200
    })
  } catch (e: unknown) {
    if (isPocketBaseMissingCollectionError(e)) {
      throw createError({
        statusCode: 503,
        message: 'creative_characters collection is missing or not provisioned on PocketBase.'
      })
    }
    const st = pocketBaseErrorStatus(e)
    if (st !== 400) throw e
    const all = await pb.collection('creative_characters').getFullList({
      filter: `owned_by="${access.ownerId}"`,
      batch: 400
    })
    rows = all.filter((r) => projectIdOnCharacterRow(r as Record<string, unknown>) === id)
  }

  rows.sort((a, b) => {
    const ra = a as Record<string, unknown>
    const rb = b as Record<string, unknown>
    const pa = typeof ra.screen_share_percent === 'number' ? ra.screen_share_percent : Number(ra.screen_share_percent)
    const pbPct = typeof rb.screen_share_percent === 'number' ? rb.screen_share_percent : Number(rb.screen_share_percent)
    const na = Number.isFinite(pa) ? pa : -1
    const nb = Number.isFinite(pbPct) ? pbPct : -1
    if (nb !== na) return nb - na
    return String(ra.name || '').localeCompare(String(rb.name || ''))
  })

  const characters: CreativeCharacter[] = rows.map((r) =>
    pbRecordToCreativeCharacter(r as Record<string, unknown>)
  )

  return { characters }
})
