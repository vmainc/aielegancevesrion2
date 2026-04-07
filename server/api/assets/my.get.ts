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

  let filter = `owned_by = "${userId}"`
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
    const status = e && typeof e === 'object' && 'status' in e ? Number((e as { status?: number }).status || 0) : 0
    if (status === 404 || /wasn't found|not found|Missing collection|missing collection context/i.test(msg)) {
      // Graceful fallback so Assets pages remain usable while PB schema is being provisioned.
      return { items: [], warning: 'project_assets collection missing' }
    }
    throw createError({ statusCode: 500, message: msg })
  }
})
