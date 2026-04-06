import { createError } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToCreativeProject } from '~/server/utils/creative-project-map'

export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()

  try {
    const items = await pb.collection('creative_projects').getFullList({
      filter: `owned_by = "${userId}" || owner = "${userId}" || user = "${userId}"`,
      sort: '-created',
      requestKey: `creative_my_${userId}`
    })
    return {
      items: items.map(r => pbRecordToCreativeProject(r as Parameters<typeof pbRecordToCreativeProject>[0]))
    }
  } catch (e: any) {
    const msg = e?.message || String(e)
    if (/wasn't found|not found|404/i.test(msg)) {
      throw createError({
        statusCode: 503,
        message:
          'Creative collections are missing. Run: node scripts/setup-collections.js (adds creative_projects, creative_scenes, creative_characters, creative_shots).'
      })
    }
    throw createError({
      statusCode: e?.status || 500,
      message: msg
    })
  }
})
