import { createError, getQuery } from 'h3'
import { getAuthenticatedPocketBase } from '~/server/utils/pocketbase'
import { getPocketBaseUserIdFromRequest } from '~/server/utils/pocketbase-user-token'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'

/**
 * All assets for the signed-in user (across projects), for /assets hub.
 */
export default defineEventHandler(async (event) => {
  const userId = await getPocketBaseUserIdFromRequest(event)
  const pb = await getAuthenticatedPocketBase()
  const q = getQuery(event)
  const kind = typeof q.kind === 'string' ? q.kind.trim() : ''

  let filter = `(owned_by = "${userId}" || owner = "${userId}" || user = "${userId}")`
  if (kind && ['script', 'character', 'storyboard', 'video', 'other'].includes(kind)) {
    filter += ` && kind = "${kind}"`
  }

  try {
    const items = await pb.collection('project_assets').getFullList({
      filter,
      sort: '-created',
      expand: 'project',
      requestKey: `assets_my_${userId}_${kind}`
    })
    return {
      items: items.map((r) => {
        const mapped = pbRecordToProjectAsset(r as Record<string, unknown>, pb)
        const exp = (r as { expand?: { project?: { name?: string } } }).expand
        if (exp?.project?.name) {
          mapped.projectName = exp.project.name
        }
        return mapped
      })
    }
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : String(e)
    if (/wasn't found|not found|404|Missing collection/i.test(msg)) {
      throw createError({
        statusCode: 503,
        message:
          'project_assets collection is missing. Run: node scripts/setup-collections.js (adds project_assets).'
      })
    }
    throw createError({ statusCode: 500, message: msg })
  }
})
