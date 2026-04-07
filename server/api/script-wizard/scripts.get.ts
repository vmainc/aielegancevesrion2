import { createError } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeScript } from '~/server/utils/creative-script-map'
import type { CreativeScript } from '~/types/creative-script'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  try {
    const rows = await pb.collection('creative_scripts').getFullList({
      filter: `owned_by = "${userId}"`,
      sort: '-updated',
      batch: 200
    })
    const items: CreativeScript[] = rows.map(r =>
      pbRecordToCreativeScript(r as Record<string, unknown>)
    )
    return { items }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/wasn't found|not found|404|Missing collection/i.test(msg)) {
      throw createError({
        statusCode: 503,
        message: 'creative_scripts collection is missing. Run: node scripts/setup-collections.js'
      })
    }
    throw createError({ statusCode: 500, message: msg })
  }
})

