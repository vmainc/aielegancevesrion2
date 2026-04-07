import { createError } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  try {
    const items = await pb.collection('creative_projects').getFullList({
      // Only `owned_by` exists on schema from setup-collections — OR on missing fields returns 400 from PB.
      filter: `owned_by = "${userId}"`,
      sort: '-created',
      requestKey: `creative_my_${userId}`
    })
    return {
      items: items.map(r => pbRecordToCreativeProject(r as Parameters<typeof pbRecordToCreativeProject>[0]))
    }
  } catch (e: any) {
    const msg = e?.message || String(e)
    const status = Number(e?.status || e?.statusCode || 0)
    if (status === 404 || /wasn't found|not found|missing collection context|missing collection/i.test(msg)) {
      // Graceful fallback so app remains usable even before PB collections are provisioned.
      return { items: [], warning: 'creative_projects collection missing' }
    }
    throw createError({
      statusCode: e?.status || 500,
      message: msg
    })
  }
})
